import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: RouteContext<"/api/clients/[id]/overview">) {
  const { id } = await context.params;

  const [sessionsResult, paymentsResult, vouchersResult] = await Promise.all([
    supabaseAdmin
      .from("sessions")
      .select("id, scheduled_at, service_name, agreed_price_cents, current_stage:session_stages!sessions_current_stage_id_fkey(name,code), payments(amount_cents)")
      .eq("client_id", id)
      .order("scheduled_at", { ascending: false }),
    supabaseAdmin
      .from("payments")
      .select("id, amount_cents, paid_at, category, payment_method_name, session:sessions!payments_session_id_fkey(id,service_name,client_id), voucher:gift_vouchers!payments_voucher_id_fkey(id,code,purchaser_client_id)")
      .order("paid_at", { ascending: false }),
    supabaseAdmin
      .from("gift_vouchers")
      .select("id, code, voucher_type, service_name, value_cents, purchase_price_cents, status, expires_at, recipient:clients!gift_vouchers_recipient_client_id_fkey(id,first_name,last_name)")
      .eq("purchaser_client_id", id)
      .order("purchased_at", { ascending: false }),
  ]);

  if (sessionsResult.error) return NextResponse.json({ error: sessionsResult.error.message }, { status: 500 });
  if (paymentsResult.error) return NextResponse.json({ error: paymentsResult.error.message }, { status: 500 });
  if (vouchersResult.error) return NextResponse.json({ error: vouchersResult.error.message }, { status: 500 });

  const payments = (paymentsResult.data ?? []).filter((payment) => {
    const session = payment.session as { client_id?: string } | null;
    const voucher = payment.voucher as { purchaser_client_id?: string } | null;
    return session?.client_id === id || voucher?.purchaser_client_id === id;
  });

  return NextResponse.json({ sessions: sessionsResult.data, payments, vouchers: vouchersResult.data });
}
