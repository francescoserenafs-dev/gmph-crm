import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: RouteContext<"/api/sessions/[id]/eligible-vouchers">) {
  const { id } = await context.params;

  const { data: session } = await supabaseAdmin.from("sessions").select("id").eq("id", id).maybeSingle();
  if (!session) return NextResponse.json({ error: "Sessione non trovata." }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("gift_vouchers")
    .select("id, code, voucher_type, service_name, value_cents, purchase_price_cents, service_type_id")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ vouchers: data ?? [] });
}
