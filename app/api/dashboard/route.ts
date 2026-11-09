import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { expireOverdueVouchers } from "@/lib/vouchers";
import { promotePastBookedSessions } from "@/lib/sessions-server";
import { calculateSessionDue } from "@/lib/sessions";
import { addDaysToDateKey, toLocalDateKey } from "@/lib/datetime";
import { isCashPayment, paymentDateKey, voucherCreditCents } from "@/lib/economic-plans";

export const dynamic = "force-dynamic";

type DashboardSession = {
  id: string;
  scheduled_at: string;
  service_name: string;
  agreed_price_cents: number;
  current_stage: { name: string; code: string } | null;
  client: { id: string; first_name: string; last_name: string } | null;
  payments: { amount_cents: number }[];
  extras: { line_total_cents: number }[];
};

// Primo giorno (Europe/Rome) del periodo di cassa; null = sempre.
function periodStartKey(period: string): string | null {
  const today = toLocalDateKey(new Date());
  if (period === "month") return `${today.slice(0, 7)}-01`;
  if (period === "year") return `${today.slice(0, 4)}-01-01`;
  if (period === "last30") return addDaysToDateKey(today, -29);
  return null;
}

// Dovuto = prezzo + extra; i riscatti buono coprono la sessione anche senza nuova cassa.
function paymentStatus(session: DashboardSession) {
  const due = calculateSessionDue({ agreed_price_cents: session.agreed_price_cents, extras: session.extras });
  const covered = session.payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
  const status = due === 0 || covered >= due ? "settled" : covered === 0 ? "unpaid" : "partial";
  return { due, covered, status, label: status === "settled" ? "Saldata" : status === "unpaid" ? "Da saldare" : "Parzialmente pagata" };
}

export async function GET(request: NextRequest) {
  await expireOverdueVouchers();
  await promotePastBookedSessions();

  const period = request.nextUrl.searchParams.get("period") ?? "month";
  const start = periodStartKey(period);
  const nowIso = new Date().toISOString();
  const soonIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const [sessionsResult, paymentsResult, vouchersResult] = await Promise.all([
    supabaseAdmin
      .from("sessions")
      .select("id, scheduled_at, service_name, agreed_price_cents, current_stage:session_stages!sessions_current_stage_id_fkey(name,code), client:clients!sessions_client_id_fkey(id,first_name,last_name), payments(amount_cents), extras:session_extras(line_total_cents)"),
    supabaseAdmin.from("payments").select("amount_cents, paid_at, paid_date, category, applied_voucher_id, payment_method_name"),
    supabaseAdmin.from("gift_vouchers").select("status, voucher_type, value_cents, purchase_price_cents, expires_at"),
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
    .map((session) => ({
      id: session.id,
      scheduled_at: session.scheduled_at,
      service_name: session.service_name,
      client: session.client,
      stage: session.current_stage?.name ?? "-",
      status: paymentStatus(session).label,
    }));

  let receivable = 0;
  let unpaid = 0;
  let partial = 0;
  let settled = 0;
  let sessionsTotalValue = 0;
  let lateSessions = 0;
  for (const session of activeSessions) {
    const { due, covered, status } = paymentStatus(session);
    receivable += Math.max(due - covered, 0);
    if (status === "settled") settled += 1;
    else if (status === "unpaid") unpaid += 1;
    else partial += 1;
    sessionsTotalValue += due;
    if (session.current_stage?.code === "booked" && session.scheduled_at < nowIso) lateSessions += 1;
  }

  const payments = paymentsResult.data ?? [];
  const incomePayments = payments.filter((payment) => {
    if (!isCashPayment({ category: payment.category, appliedVoucherId: payment.applied_voucher_id })) return false;
    const dateKey = paymentDateKey({ paidDate: payment.paid_date, paidAt: payment.paid_at });
    return !start || (dateKey !== null && dateKey >= start);
  });
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
    activeValue: vouchers.filter((voucher) => voucher.status === "active").reduce((sum, voucher) => sum + voucherCreditCents(voucher), 0),
  };

  return NextResponse.json({
    upcoming,
    calendar: activeSessions.map((session) => ({
      id: session.id,
      scheduled_at: session.scheduled_at,
      service_name: session.service_name,
      client: session.client,
      stage: session.current_stage?.name ?? "-",
      status: paymentStatus(session).label,
    })),
    receivable,
    paymentStatus: { unpaid, partial, settled },
    sessionsTotalValue,
    lateSessions,
    income: { total: incomeTotal, byMethod: incomeByMethod },
    vouchers: voucherStats,
  });
}
