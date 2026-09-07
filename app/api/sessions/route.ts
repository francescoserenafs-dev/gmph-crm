import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { upsertIcloudEvent } from "@/lib/icloud-calendar";

export const dynamic = "force-dynamic";

const sessionFields = "id, scheduled_at, duration_minutes, location, service_name, service_detail, agreed_price_cents, is_settled, current_stage:session_stages!sessions_current_stage_id_fkey(id,name,code), client:clients!sessions_client_id_fkey(id,first_name,last_name), payments(amount_cents), extras:session_extras(price_cents)";

type SessionRow = {
  id: string;
  scheduled_at: string;
  agreed_price_cents: number;
  is_settled: boolean;
  service_type_id: string;
  client: { id: string } | null;
  current_stage: { id: string; code: string } | null;
  payments: { amount_cents: number }[];
  extras: { price_cents: number }[];
};

export async function GET(request: NextRequest) {
  const page = Math.max(Number(request.nextUrl.searchParams.get("page") ?? 1), 1);
  const pageSize = [10, 25, 50, 100].includes(Number(request.nextUrl.searchParams.get("pageSize"))) ? Number(request.nextUrl.searchParams.get("pageSize")) : 25;
  const clientId = request.nextUrl.searchParams.get("clientId");
  const serviceTypeIds = request.nextUrl.searchParams.get("serviceTypeId")?.split(",").filter(Boolean) ?? [];
  const stageIds = request.nextUrl.searchParams.get("stageId")?.split(",").filter(Boolean) ?? [];
  const paymentStatuses = request.nextUrl.searchParams.get("paymentStatus")?.split(",").filter(Boolean) ?? [];
  const { data, error } = await supabaseAdmin.from("sessions").select(`${sessionFields}, service_type_id`).order("scheduled_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = new Date().toISOString();
  const sessionRows = (data ?? []) as unknown as SessionRow[];
  const filteredSessions = sessionRows.filter((session) => {
    if (session.current_stage?.code === "cancelled") return false;
    if (clientId && session.client?.id !== clientId) return false;
    if (serviceTypeIds.length > 0 && !serviceTypeIds.includes(session.service_type_id)) return false;
    if (stageIds.length > 0 && !(session.current_stage && stageIds.includes(session.current_stage.id))) return false;
    const paid = session.payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
    const totalDue = session.agreed_price_cents + session.extras.reduce((sum, extra) => sum + extra.price_cents, 0);
    const status = totalDue === 0 ? "paid" : paid === 0 ? "unpaid" : paid < totalDue ? "partial" : "paid";
    return paymentStatuses.length === 0 || paymentStatuses.includes(status);
  }).sort((first, second) => {
    const firstFuture = first.scheduled_at >= now;
    const secondFuture = second.scheduled_at >= now;
    if (firstFuture && !secondFuture) return -1;
    if (!firstFuture && secondFuture) return 1;
    return firstFuture ? first.scheduled_at.localeCompare(second.scheduled_at) : second.scheduled_at.localeCompare(first.scheduled_at);
  });

  const total = filteredSessions.length;
  return NextResponse.json({ sessions: filteredSessions.slice((page - 1) * pageSize, page * pageSize), total });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dati sessione non validi." }, { status: 400 });

  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  const serviceTypeId = typeof body.serviceTypeId === "string" ? body.serviceTypeId : "";
  const scheduledAt = typeof body.scheduledAt === "string" ? new Date(body.scheduledAt) : null;
  const durationMinutes = Number(body.durationMinutes);
  const priceEuros = Number(body.priceEuros);
  const location = typeof body.location === "string" && body.location.trim() ? body.location.trim() : null;
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  const serviceDetail = typeof body.serviceDetail === "string" && body.serviceDetail.trim() ? body.serviceDetail.trim() : null;
  const imageConsentGranted = body.imageConsentGranted === true;

  if (!clientId || !serviceTypeId || !scheduledAt || Number.isNaN(scheduledAt.valueOf()) || !Number.isInteger(durationMinutes) || durationMinutes <= 0 || !Number.isInteger(priceEuros) || priceEuros < 0) {
    return NextResponse.json({ error: "Compila tutti i campi obbligatori con valori validi." }, { status: 400 });
  }

  const [{ data: client }, { data: service }, { data: stage }] = await Promise.all([
    supabaseAdmin.from("clients").select("id").eq("id", clientId).eq("is_archived", false).maybeSingle(),
    supabaseAdmin.from("service_types").select("id,name").eq("id", serviceTypeId).eq("is_active", true).eq("is_addon", false).maybeSingle(),
    supabaseAdmin.from("session_stages").select("id").eq("code", scheduledAt < new Date() ? "completed" : "booked").maybeSingle(),
  ]);

  if (!client || !service || !stage) return NextResponse.json({ error: "Cliente, servizio o avanzamento non disponibile." }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("sessions").insert({ client_id: client.id, service_type_id: service.id, service_name: service.name, scheduled_at: scheduledAt.toISOString(), duration_minutes: durationMinutes, agreed_price_cents: priceEuros * 100, location, notes, service_detail: serviceDetail, current_stage_id: stage.id, image_consent_granted_at: imageConsentGranted ? new Date().toISOString() : null }).select(sessionFields).single();
  if (error) return NextResponse.json({ error: error.message.includes("overlaps") ? "Questa sessione si sovrappone a un appuntamento esistente." : error.message }, { status: error.message.includes("overlaps") ? 409 : 500 });

  const created = data as unknown as SessionRow & { service_name: string; location: string | null; notes: string | null; client: { first_name: string; last_name: string } | null };
  const icloudEventUrl = await upsertIcloudEvent(
    { id: created.id, scheduledAt: created.scheduled_at, durationMinutes: durationMinutes, location: created.location, notes: created.notes, serviceName: created.service_name, clientName: created.client ? `${created.client.first_name} ${created.client.last_name}` : "" },
    null,
  );
  if (icloudEventUrl) await supabaseAdmin.from("sessions").update({ icloud_event_url: icloudEventUrl }).eq("id", created.id);

  return NextResponse.json({ session: data }, { status: 201 });
}