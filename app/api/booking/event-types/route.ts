import { type NextRequest, NextResponse } from "next/server";
import { EVENT_TYPE_COLUMNS, parseEventTypePayload, replaceAvailability } from "@/lib/booking-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const [eventTypes, services] = await Promise.all([
    supabaseAdmin.from("booking_event_types").select(EVENT_TYPE_COLUMNS).order("created_at", { ascending: false }),
    supabaseAdmin.from("service_types").select("id, name, suggested_price_cents").eq("is_active", true).eq("is_addon", false).order("sort_order"),
  ]);

  const error = eventTypes.error ?? services.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (eventTypes.data ?? []).map((item) => item.id);
  const bookings = ids.length
    ? await supabaseAdmin.from("sessions").select("booking_event_type_id").in("booking_event_type_id", ids)
    : { data: [], error: null };
  if (bookings.error) return NextResponse.json({ error: bookings.error.message }, { status: 500 });

  const counts = (bookings.data ?? []).reduce<Record<string, number>>((acc, row) => {
    const key = row.booking_event_type_id as string;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    eventTypes: (eventTypes.data ?? []).map((item) => ({ ...item, bookings_count: counts[item.id] ?? 0 })),
    services: services.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseEventTypePayload(body);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("booking_event_types").insert(parsed.row).select(EVENT_TYPE_COLUMNS).single();
  if (error) {
    return NextResponse.json({ error: error.code === "23505" ? "Esiste già un evento con questo slug." : error.message }, { status: error.code === "23505" ? 409 : 500 });
  }

  const failure = await replaceAvailability(data.id, parsed);
  if (failure) {
    await supabaseAdmin.from("booking_event_types").delete().eq("id", data.id);
    return failure;
  }

  return NextResponse.json({ eventType: data }, { status: 201 });
}
