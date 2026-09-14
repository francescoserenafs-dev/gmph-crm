import { type NextRequest, NextResponse } from "next/server";
import { EVENT_TYPE_COLUMNS, parseEventTypePayload, replaceAvailability } from "@/lib/booking-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function queryConfiguration() {
  return Promise.all([
    supabaseAdmin.from("booking_event_types").select(`${EVENT_TYPE_COLUMNS}, sessions(count)`).order("created_at", { ascending: false }),
    supabaseAdmin.from("service_types").select("id, name, suggested_price_cents").eq("is_active", true).eq("is_addon", false).order("sort_order"),
  ]);
}

function isTransientFailure(status: number, message: string): boolean {
  return [502, 503, 504].includes(status) || /gateway|timeout|temporar|fetch failed|connection/i.test(message);
}

export async function GET() {
  let [eventTypes, services] = await queryConfiguration();
  const firstError = eventTypes.error ?? services.error;
  const firstStatus = eventTypes.error ? eventTypes.status : services.status;

  if (firstError && isTransientFailure(firstStatus, firstError.message)) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    [eventTypes, services] = await queryConfiguration();
  }

  const error = eventTypes.error ?? services.error;
  if (error) {
    const status = eventTypes.error ? eventTypes.status : services.status;
    return NextResponse.json(
      { error: isTransientFailure(status, error.message) ? "Il servizio dati non risponde. Riprova tra qualche istante." : error.message },
      { status: isTransientFailure(status, error.message) ? 503 : 500 },
    );
  }

  return NextResponse.json({
    eventTypes: (eventTypes.data ?? []).map(({ sessions, ...item }) => ({ ...item, bookings_count: sessions[0]?.count ?? 0 })),
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
