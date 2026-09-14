import { type NextRequest, NextResponse } from "next/server";
import { EVENT_TYPE_COLUMNS, parseEventTypePayload, replaceAvailability, sanitizeBookingDescription } from "@/lib/booking-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: RouteContext<"/api/booking/event-types/[id]">) {
  const { id } = await context.params;

  const [eventType, rules, exceptions] = await Promise.all([
    supabaseAdmin.from("booking_event_types").select(EVENT_TYPE_COLUMNS).eq("id", id).maybeSingle(),
    supabaseAdmin.from("booking_availability_rules").select("id, event_type_id, weekday, start_time, end_time").eq("event_type_id", id).order("weekday").order("start_time"),
    supabaseAdmin.from("booking_availability_exceptions").select("id, event_type_id, exception_date, is_closed, start_time, end_time, note").eq("event_type_id", id).order("exception_date"),
  ]);

  const error = eventType.error ?? rules.error ?? exceptions.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!eventType.data) return NextResponse.json({ error: "Evento non trovato." }, { status: 404 });

  return NextResponse.json({ eventType: { ...eventType.data, description: sanitizeBookingDescription(eventType.data.description) }, rules: rules.data ?? [], exceptions: exceptions.data ?? [] });
}

export async function PATCH(request: NextRequest, context: RouteContext<"/api/booking/event-types/[id]">) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseEventTypePayload(body);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("booking_event_types").update(parsed.row).eq("id", id).select(EVENT_TYPE_COLUMNS).single();
  if (error) {
    return NextResponse.json({ error: error.code === "23505" ? "Esiste già un evento con questo slug." : error.message }, { status: error.code === "23505" ? 409 : 500 });
  }

  const failure = await replaceAvailability(id, parsed);
  if (failure) return failure;

  return NextResponse.json({ eventType: data });
}

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/booking/event-types/[id]">) {
  const { id } = await context.params;
  const { error } = await supabaseAdmin.from("booking_event_types").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
