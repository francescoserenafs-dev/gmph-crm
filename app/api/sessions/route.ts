import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { upsertIcloudEvent } from "@/lib/icloud-calendar";
import { promotePastBookedSessions } from "@/lib/sessions-server";
import { parseLocalDateTime, toLocalDateKey } from "@/lib/datetime";
import { LEAD_OPEN_STATUSES, type LeadStatus } from "@/lib/leads";
import { buildSessionsView, parseSessionFilters, parseSessionMonth } from "@/lib/sessions";
import { loadPaged } from "@/lib/economic-plans-server";

export const dynamic = "force-dynamic";

const sessionFields = "id, scheduled_at, duration_minutes, location, service_name, service_detail, agreed_price_cents, is_settled, booked_online_at, current_stage:session_stages!sessions_current_stage_id_fkey(id,name,code,ball_owner), client:clients!sessions_client_id_fkey(id,first_name,last_name), payments(amount_cents), extras:session_extras(line_total_cents,category_snapshot,quantity)";

type SessionRow = {
  id: string;
  scheduled_at: string;
  agreed_price_cents: number;
  is_settled: boolean;
  service_type_id: string;
  client: { id: string } | null;
  current_stage: { id: string; code: string; ball_owner: string | null } | null;
  payments: { amount_cents: number }[];
  extras: { line_total_cents: number; category_snapshot: string | null; quantity: number }[];
};

// Un solo universo filtrato per Lista, Pipeline, Calendario, Riepilogo e KPI (buildSessionsView).
export async function GET(request: NextRequest) {
  await promotePastBookedSessions();

  const params = request.nextUrl.searchParams;
  const page = Math.max(Number(params.get("page") ?? 1) || 1, 1);
  const pageSize = [10, 25, 50, 100].includes(Number(params.get("pageSize"))) ? Number(params.get("pageSize")) : 25;
  const filters = parseSessionFilters(params);
  const month = parseSessionMonth(params.get("month"), filters.day ? filters.day.slice(0, 7) : toLocalDateKey(new Date()).slice(0, 7));
  const rows = await loadPaged<SessionRow>((from, to) => supabaseAdmin.from("sessions").select(`${sessionFields}, service_type_id`).order("scheduled_at", { ascending: true }).range(from, to)).catch((reason: { message?: string }) => reason);
  if (!Array.isArray(rows)) return NextResponse.json({ error: rows.message ?? "Caricamento non riuscito." }, { status: 500 });

  const view = buildSessionsView(rows, filters, { month, page, pageSize, nowIso: new Date().toISOString() });
  if (params.get("all") === "1") return NextResponse.json({ sessions: view.matching, total: view.total });
  return NextResponse.json({
    sessions: view.sessions,
    total: view.total,
    month,
    calendar: view.calendar,
    summary: view.summary,
    kpis: view.kpis,
    ...(params.get("view") === "board" ? { pipeline: view.matching } : {}),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dati sessione non validi." }, { status: 400 });

  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  const serviceTypeId = typeof body.serviceTypeId === "string" ? body.serviceTypeId : "";
  const scheduledAt = typeof body.scheduledAt === "string" ? parseLocalDateTime(body.scheduledAt) : null;
  const durationMinutes = Number(body.durationMinutes);
  const priceEuros = Number(body.priceEuros);
  const location = typeof body.location === "string" && body.location.trim() ? body.location.trim() : null;
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  const serviceDetail = typeof body.serviceDetail === "string" && body.serviceDetail.trim() ? body.serviceDetail.trim() : null;
  const imageConsentGranted = body.imageConsentGranted === true;
  const leadId = typeof body.leadId === "string" && body.leadId ? body.leadId : null;
  const packageId = typeof body.packageId === "string" && body.packageId ? body.packageId : null;
  const includedPhotos = body.includedPhotos === undefined || body.includedPhotos === null || body.includedPhotos === "" ? null : Number(body.includedPhotos);

  if (includedPhotos !== null && (!Number.isInteger(includedPhotos) || includedPhotos < 0 || includedPhotos > 1000)) {
    return NextResponse.json({ error: "Indica un numero di foto incluse valido." }, { status: 400 });
  }

  if (!clientId || !serviceTypeId || !scheduledAt || Number.isNaN(scheduledAt.valueOf()) || !Number.isInteger(durationMinutes) || durationMinutes <= 0 || !Number.isInteger(priceEuros) || priceEuros < 0) {
    return NextResponse.json({ error: "Compila tutti i campi obbligatori con valori validi." }, { status: 400 });
  }

  let leadContactType: string | null = null;
  let linkedLeadClientId: string | null = null;
  if (leadId) {
    const { data: lead, error: leadError } = await supabaseAdmin.from("leads").select("status, contact_type, client_id").eq("id", leadId).maybeSingle();
    if (leadError) return NextResponse.json({ error: "Non e stato possibile verificare il lead." }, { status: 500 });
    if (!lead) return NextResponse.json({ error: "Lead non trovato." }, { status: 404 });
    if (!LEAD_OPEN_STATUSES.includes(lead.status as LeadStatus)) return NextResponse.json({ error: "Il lead e gia stato convertito o chiuso." }, { status: 409 });
    if (lead.contact_type === "existing_client" && (!lead.client_id || lead.client_id !== clientId)) {
      return NextResponse.json({ error: "La sessione deve usare il cliente già collegato al lead." }, { status: 409 });
    }
    leadContactType = lead.contact_type;
    linkedLeadClientId = lead.client_id;
  }

  let clientQuery = supabaseAdmin.from("clients").select("id").eq("id", clientId);
  if (leadContactType !== "existing_client") clientQuery = clientQuery.eq("is_archived", false);
  const [{ data: client }, { data: service }, { data: stage }] = await Promise.all([
    clientQuery.maybeSingle(),
    supabaseAdmin.from("service_types").select("id,name").eq("id", serviceTypeId).eq("is_active", true).eq("is_addon", false).maybeSingle(),
    supabaseAdmin.from("session_stages").select("id").eq("code", scheduledAt < new Date() ? "completed" : "booked").maybeSingle(),
  ]);

  if (!client || !service || !stage) return NextResponse.json({ error: "Cliente, servizio o avanzamento non disponibile." }, { status: 400 });

  if (packageId) {
    const { data: selectedPackage } = await supabaseAdmin.from("session_packages").select("id").eq("id", packageId).eq("service_type_id", service.id).eq("is_active", true).maybeSingle();
    if (!selectedPackage) return NextResponse.json({ error: "Pacchetto non disponibile per questo servizio." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from("sessions").insert({ client_id: client.id, service_type_id: service.id, service_name: service.name, scheduled_at: scheduledAt.toISOString(), duration_minutes: durationMinutes, agreed_price_cents: priceEuros * 100, location, notes, service_detail: serviceDetail, current_stage_id: stage.id, included_photos: includedPhotos, image_consent_granted_at: imageConsentGranted ? new Date().toISOString() : null }).select(sessionFields).single();
  if (error) return NextResponse.json({ error: error.message.includes("overlaps") ? "Questa sessione si sovrappone a un appuntamento esistente." : error.message }, { status: error.message.includes("overlaps") ? 409 : 500 });

  const created = data as unknown as SessionRow & { service_name: string; location: string | null; notes: string | null; client: { first_name: string; last_name: string } | null };

  if (packageId) {
    const { error: packageError } = await supabaseAdmin.rpc("apply_session_package", { p_session_id: created.id, p_package_id: packageId });
    if (packageError) {
      // Compensazione: nessuna sessione con pacchetto senza snapshot coerenti.
      await supabaseAdmin.from("sessions").delete().eq("id", created.id);
      return NextResponse.json({ error: "Applicazione del pacchetto non riuscita: la sessione non e stata salvata." }, { status: 500 });
    }
  }

  if (leadId) {
    const now = new Date().toISOString();
    let leadUpdate = supabaseAdmin
      .from("leads")
      .update({ status: "booked", client_id: client.id, session_id: created.id, converted_at: now, closed_at: now })
      .eq("id", leadId)
      .in("status", LEAD_OPEN_STATUSES);
    if (leadContactType === null) leadUpdate = leadUpdate.is("contact_type", null);
    else leadUpdate = leadUpdate.eq("contact_type", leadContactType);
    if (leadContactType === "existing_client") leadUpdate = leadUpdate.eq("client_id", linkedLeadClientId);
    const { data: linked, error: linkError } = await leadUpdate.select("id").maybeSingle();
    if (linkError || !linked) {
      // Compensazione: senza lead collegato la sessione appena creata non deve restare.
      await supabaseAdmin.from("sessions").delete().eq("id", created.id);
      return NextResponse.json({ error: linkError ? "Collegamento del lead non riuscito: la sessione non e stata salvata." : "Il lead e gia stato convertito o chiuso: la sessione non e stata salvata." }, { status: linkError ? 500 : 409 });
    }
  }
  const icloudEventUrl = await upsertIcloudEvent(
    { id: created.id, scheduledAt: created.scheduled_at, durationMinutes: durationMinutes, location: created.location, notes: created.notes, serviceName: created.service_name, clientName: created.client ? `${created.client.first_name} ${created.client.last_name}` : "" },
    null,
  );
  if (icloudEventUrl) await supabaseAdmin.from("sessions").update({ icloud_event_url: icloudEventUrl }).eq("id", created.id);

  return NextResponse.json({ session: data }, { status: 201 });
}