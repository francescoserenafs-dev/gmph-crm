import { type NextRequest, NextResponse } from "next/server";
import type { BookingEventType } from "@/lib/booking";
import { EVENT_TYPE_COLUMNS, resolveAvailableDays } from "@/lib/booking-server";
import { addDaysToDateKey, toLocalDateKey } from "@/lib/datetime";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest, context: RouteContext<"/api/booking/event-types/[id]/slots">) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);

  const today = toLocalDateKey(new Date());
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const rangeStart = fromParam && DATE_PATTERN.test(fromParam) ? fromParam : today;
  const rangeEnd = toParam && DATE_PATTERN.test(toParam) ? toParam : addDaysToDateKey(rangeStart, 60);
  if (rangeEnd < rangeStart) return NextResponse.json({ error: "Intervallo di date non valido." }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("booking_event_types").select(EVENT_TYPE_COLUMNS).eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Evento non trovato." }, { status: 404 });

  const days = await resolveAvailableDays(data as BookingEventType, rangeStart, rangeEnd);
  if (typeof days === "string") return NextResponse.json({ error: days }, { status: 500 });

  return NextResponse.json({ days, rangeStart, rangeEnd });
}
