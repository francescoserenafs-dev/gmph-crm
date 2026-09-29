import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: RouteContext<"/api/sessions/[id]/extras">) {
  const { id } = await context.params;

  const { data, error } = await supabaseAdmin
    .from("session_extras")
    .select("id, service_type_id, service_name, price_cents, quantity, notes, created_at")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ extras: data });
}

export async function POST(request: NextRequest, context: RouteContext<"/api/sessions/[id]/extras">) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dati non validi." }, { status: 400 });

  const serviceTypeId = typeof body.serviceTypeId === "string" ? body.serviceTypeId : "";
  const priceEuros = Number(body.priceEuros);
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

  if (!serviceTypeId || !Number.isInteger(priceEuros) || priceEuros < 0) {
    return NextResponse.json({ error: "Seleziona un servizio extra e indica un prezzo valido." }, { status: 400 });
  }

  const [{ data: session }, { data: service }] = await Promise.all([
    supabaseAdmin.from("sessions").select("id").eq("id", id).maybeSingle(),
    supabaseAdmin.from("service_types").select("id, name").eq("id", serviceTypeId).eq("is_active", true).eq("is_addon", true).maybeSingle(),
  ]);

  if (!session) return NextResponse.json({ error: "Sessione non trovata." }, { status: 404 });
  if (!service) return NextResponse.json({ error: "Servizio extra non disponibile." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("session_extras")
    .insert({ session_id: id, service_type_id: service.id, service_name: service.name, price_cents: priceEuros * 100, notes })
    .select("id, service_type_id, service_name, price_cents, notes, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ extra: data }, { status: 201 });
}
