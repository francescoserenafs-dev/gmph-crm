import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("calendly_event_type_map")
    .select("id, calendly_event_type_uri, calendly_event_type_name, weekday_price_cents, weekend_price_cents, service_type:service_types!calendly_event_type_map_service_type_id_fkey(id,name)")
    .order("calendly_event_type_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mappings: data });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const calendlyEventTypeUri = typeof body?.calendlyEventTypeUri === "string" ? body.calendlyEventTypeUri : "";
  const calendlyEventTypeName = typeof body?.calendlyEventTypeName === "string" ? body.calendlyEventTypeName.trim() : "";
  const serviceTypeId = typeof body?.serviceTypeId === "string" ? body.serviceTypeId : "";
  const weekdayPriceEuros = Number(body?.weekdayPriceEuros);
  const weekendPriceEuros = Number(body?.weekendPriceEuros);
  if (!calendlyEventTypeUri || !calendlyEventTypeName || !serviceTypeId || !Number.isInteger(weekdayPriceEuros) || weekdayPriceEuros < 0 || !Number.isInteger(weekendPriceEuros) || weekendPriceEuros < 0) {
    return NextResponse.json({ error: "Seleziona un evento Calendly, un tipo di servizio e prezzi feriale/festivo validi." }, { status: 400 });
  }

  const { data: service } = await supabaseAdmin.from("service_types").select("id").eq("id", serviceTypeId).maybeSingle();
  if (!service) return NextResponse.json({ error: "Tipo di servizio non disponibile." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("calendly_event_type_map")
    .upsert({ calendly_event_type_uri: calendlyEventTypeUri, calendly_event_type_name: calendlyEventTypeName, service_type_id: serviceTypeId, weekday_price_cents: weekdayPriceEuros * 100, weekend_price_cents: weekendPriceEuros * 100 }, { onConflict: "calendly_event_type_uri" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ mapping: data }, { status: 201 });
}
