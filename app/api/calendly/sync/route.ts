import { type NextRequest, NextResponse } from "next/server";
import { listCalendlyInvitees, listCalendlyScheduledEvents, getCalendlyCurrentUser } from "@/lib/calendly";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PreviewItem = {
  eventUri: string;
  eventName: string;
  startTime: string;
  endTime: string;
  inviteeEmail: string;
  inviteeName: string;
  serviceTypeId: string;
  serviceTypeName: string;
  priceCents: number;
  clientAction: "match" | "create";
};

type UnmappedItem = { eventUri: string; eventName: string; startTime: string; calendlyEventTypeName: string };

function isWeekend(isoDate: string) {
  const day = new Date(isoDate).getDay();
  return day === 0 || day === 6;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

function extractPhone(invitee: { text_reminder_number: string | null; questions_and_answers: { question: string; answer: string }[] }) {
  if (invitee.text_reminder_number) return invitee.text_reminder_number;
  const phoneAnswer = invitee.questions_and_answers.find((entry) => /telefono|phone|cellulare/i.test(entry.question));
  return phoneAnswer?.answer.trim() || null;
}

async function collectItems() {
  const user = await getCalendlyCurrentUser();
  const [{ data: mappings }, { data: existingSessions }] = await Promise.all([
    supabaseAdmin.from("calendly_event_type_map").select("calendly_event_type_uri, calendly_event_type_name, weekday_price_cents, weekend_price_cents, service_type:service_types!calendly_event_type_map_service_type_id_fkey(id, name)"),
    supabaseAdmin.from("sessions").select("calendly_event_uri").not("calendly_event_uri", "is", null),
  ]);
  const mappingByUri = new Map((mappings ?? []).map((mapping) => [mapping.calendly_event_type_uri, mapping]));
  const importedUris = new Set((existingSessions ?? []).map((session) => session.calendly_event_uri));

  const minStartTime = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const events = await listCalendlyScheduledEvents(user.uri, minStartTime);
  const newEvents = events.filter((event) => !importedUris.has(event.uri));

  const items: PreviewItem[] = [];
  const unmapped: UnmappedItem[] = [];

  for (const event of newEvents) {
    const mapping = mappingByUri.get(event.event_type);
    if (!mapping || !mapping.service_type) {
      unmapped.push({ eventUri: event.uri, eventName: event.name, startTime: event.start_time, calendlyEventTypeName: mapping?.calendly_event_type_name ?? event.event_type });
      continue;
    }
    const invitees = await listCalendlyInvitees(event.uri);
    const invitee = invitees[0];
    if (!invitee) continue;
    const { data: existingClient } = await supabaseAdmin.from("clients").select("id").ilike("email", invitee.email).maybeSingle();
    const serviceType = mapping.service_type as unknown as { id: string; name: string };
    items.push({
      eventUri: event.uri,
      eventName: event.name,
      startTime: event.start_time,
      endTime: event.end_time,
      inviteeEmail: invitee.email,
      inviteeName: invitee.name,
      serviceTypeId: serviceType.id,
      serviceTypeName: serviceType.name,
      priceCents: isWeekend(event.start_time) ? mapping.weekend_price_cents : mapping.weekday_price_cents,
      clientAction: existingClient ? "match" : "create",
    });
  }

  return { items, unmapped };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { execute?: boolean } | null;
  try {
    const { items, unmapped } = await collectItems();
    if (!body?.execute) return NextResponse.json({ items, unmapped, total: items.length });

    const [{ data: bookedStage }, { data: completedStage }] = await Promise.all([
      supabaseAdmin.from("session_stages").select("id").eq("code", "booked").maybeSingle(),
      supabaseAdmin.from("session_stages").select("id").eq("code", "completed").maybeSingle(),
    ]);

    let created = 0;
    const errors: { eventName: string; error: string }[] = [];

    for (const item of items) {
      const { firstName, lastName } = splitName(item.inviteeName);

      let clientId: string | null = null;
      const { data: existingClient } = await supabaseAdmin.from("clients").select("id").ilike("email", item.inviteeEmail).maybeSingle();
      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const invitees = await listCalendlyInvitees(item.eventUri);
        const phone = invitees[0] ? extractPhone(invitees[0]) : null;
        const { data: newClient, error: clientError } = await supabaseAdmin.from("clients").insert({ first_name: firstName, last_name: lastName, email: item.inviteeEmail, phone }).select("id").single();
        if (clientError || !newClient) {
          errors.push({ eventName: item.eventName, error: clientError?.message ?? "Creazione cliente non riuscita." });
          continue;
        }
        clientId = newClient.id;
      }

      const durationMinutes = Math.max(Math.round((new Date(item.endTime).getTime() - new Date(item.startTime).getTime()) / 60000), 1);
      const stageId = new Date(item.startTime) >= new Date() ? bookedStage?.id : completedStage?.id;
      const { error: sessionError } = await supabaseAdmin.from("sessions").insert({
        client_id: clientId,
        service_type_id: item.serviceTypeId,
        service_name: item.serviceTypeName,
        scheduled_at: item.startTime,
        duration_minutes: durationMinutes,
        agreed_price_cents: item.priceCents,
        current_stage_id: stageId,
        notes: "Importata da Calendly",
        calendly_event_uri: item.eventUri,
      });
      if (sessionError) {
        errors.push({ eventName: item.eventName, error: sessionError.message.includes("overlaps") ? "Si sovrappone a una sessione esistente." : sessionError.message });
        continue;
      }
      created += 1;
    }

    await supabaseAdmin.from("app_settings").update({ calendly_last_sync_at: new Date().toISOString() }).eq("id", true);
    return NextResponse.json({ created, skippedUnmapped: unmapped.length, errors, total: items.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sincronizzazione Calendly non riuscita." }, { status: 502 });
  }
}
