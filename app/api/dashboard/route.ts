import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { expireOverdueVouchers } from "@/lib/vouchers";

export const dynamic = "force-dynamic";

type DashboardSession = {
  id: string;
  scheduled_at: string;
  service_name: string;
  agreed_price_cents: number;
  current_stage: { name: string; code: string } | null;
  client: { id: string; first_name: string; last_name: string } | null;
  payments: { amount_cents: number }[];
};

function periodStart(period: string): string | null {
  const now = new Date();
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  if (period === "year") return new Date(now.getFullYear(), 0, 1).toISOString();
  if (period === "last30") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return null;
}

export async function GET(request: NextRequest) {
  await expireOverdueVouchers();

  const period = request.nextUrl.searchParams.get("period") ?? "month";
  const start = periodStart(period);
  const nowIso = new Date().toISOString();
  const soonIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const [sessionsResult, paymentsResult, vouchersResult] = await Promise.all([
    supabaseAdmin
      .from("sessions")
      .select("id, scheduled_at, service_name, agreed_price_cents, current_stage:session_stages!sessions_current_stage_id_fkey(name,code), client:clients!sessions_client_id_fkey(id,first_name,last_name), payments(amount_cents)"),
    supabaseAdmin.from("payments").select("amount_cents, paid_at, category, payment_method_name"),
    supabaseAdmin.from("gift_vouchers").select("status, value_cents, purchase_price_cents, expires_at"),
  ]);

  if (sessionsResult.error || paymentsResult.error || vouchersResult.error) {
    return NextResponse.json({ error: "Caricamento non riuscito." }, { status: 500 });
  }

  const sessions = (sessionsResult.data ?? []) as unknown as DashboardSession[];
  const activeSessions = sessions.filter((session) => session.current_stage?.code !== "cancelled");
  const upcoming = activeSessions
    .filter((session) => session.scheduled_at >= nowIso)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    .slice(0, 6)
    .map((session) => {
      const paid = session.payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
      return {
        id: session.id,
        scheduled_at: session.scheduled_at,
        service_name: session.service_name,
        client: session.client,
        stage: session.current_stage?.name ?? "-",
        status: paid === 0 ? "Da saldare" : paid < session.agreed_price_cents ? "Parzialmente pagata" : "Saldata",
      };
    });

  let receivable = 0;
  let unpaid = 0;
  let partial = 0;
  let settled = 0;
  for (const session of activeSessions) {
    const paid = session.payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
    const balance = session.agreed_price_cents - paid;
    if (balance > 0) receivable += balance;
    if (paid === 0) unpaid += 1;
    else if (paid < session.agreed_price_cents) partial += 1;
    else settled += 1;
  }

  const payments = paymentsResult.data ?? [];
  const incomePayments = payments.filter((payment) => payment.payment_method_name !== "Buono regalo" && (!start || payment.paid_at >= start));
  const incomeTotal = incomePayments.reduce((sum, payment) => sum + payment.amount_cents, 0);
  const incomeByMethod: Record<string, number> = {};
  for (const payment of incomePayments) {
    incomeByMethod[payment.payment_method_name] = (incomeByMethod[payment.payment_method_name] ?? 0) + payment.amount_cents;
  }

  const vouchers = vouchersResult.data ?? [];
  const voucherStats = {
    sold: vouchers.length,
    active: vouchers.filter((voucher) => voucher.status === "active").length,
    redeemed: vouchers.filter((voucher) => voucher.status === "redeemed").length,
    expired: vouchers.filter((voucher) => voucher.status === "expired").length,
    expiringSoon: vouchers.filter((voucher) => voucher.status === "active" && voucher.expires_at <= soonIso).length,
    activeValue: vouchers.filter((voucher) => voucher.status === "active").reduce((sum, voucher) => sum + (voucher.value_cents ?? voucher.purchase_price_cents), 0),
  };

  return NextResponse.json({
    upcoming,
    receivable,
    paymentStatus: { unpaid, partial, settled },
    income: { total: incomeTotal, byMethod: incomeByMethod },
    vouchers: voucherStats,
  });
}
