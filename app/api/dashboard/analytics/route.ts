import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AnalyticsPayment = {
  amount_cents: number;
  paid_at: string;
  payment_method_name: string;
  category: string;
  session: { service_name: string } | null;
  voucher_id: string | null;
};

const monthLabels = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

export async function GET(request: NextRequest) {
  const now = new Date();
  const requestedYear = Number(request.nextUrl.searchParams.get("year"));
  const year = Number.isInteger(requestedYear) && requestedYear > 0 ? requestedYear : now.getFullYear();

  const { data: allPayments, error: allPaymentsError } = await supabaseAdmin
    .from("payments")
    .select("paid_at")
    .order("paid_at", { ascending: true })
    .limit(1);

  if (allPaymentsError) {
    return NextResponse.json({ error: "Non e stato possibile caricare le analisi." }, { status: 500 });
  }

  const earliestYear = allPayments && allPayments.length > 0 ? new Date(allPayments[0].paid_at).getFullYear() : now.getFullYear();
  const years: number[] = [];
  for (let candidateYear = now.getFullYear(); candidateYear >= earliestYear; candidateYear -= 1) {
    years.push(candidateYear);
  }
  if (!years.includes(year)) years.unshift(year);

  const yearStart = new Date(year, 0, 1).toISOString();
  const yearEnd = new Date(year + 1, 0, 1).toISOString();

  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("amount_cents, paid_at, payment_method_name, category, session:sessions!payments_session_id_fkey(service_name), voucher_id")
    .gte("paid_at", yearStart)
    .lt("paid_at", yearEnd);

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from("app_settings")
    .select("annual_budget_cents")
    .eq("id", true)
    .maybeSingle();

  if (error || settingsError) {
    return NextResponse.json({ error: "Non e stato possibile caricare le analisi." }, { status: 500 });
  }

  const incomePayments = (data ?? []).filter(
    (payment) => payment.payment_method_name !== "Buono regalo",
  ) as unknown as AnalyticsPayment[];

  const byMonthMap = new Map<number, number>();
  for (const payment of incomePayments) {
    const month = new Date(payment.paid_at).getMonth();
    byMonthMap.set(month, (byMonthMap.get(month) ?? 0) + payment.amount_cents);
  }
  const byMonth = monthLabels.map((label, index) => ({
    month: index + 1,
    label,
    total_cents: byMonthMap.get(index) ?? 0,
  }));

  let running = 0;
  const cumulative = byMonth.map((entry) => {
    running += entry.total_cents;
    return { month: entry.month, label: entry.label, total_cents: running };
  });

  const byServiceTypeMap = new Map<string, number>();
  for (const payment of incomePayments) {
    const key = payment.session ? payment.session.service_name : payment.voucher_id ? "Buoni regalo" : "Altro";
    byServiceTypeMap.set(key, (byServiceTypeMap.get(key) ?? 0) + payment.amount_cents);
  }
  const byServiceType = Array.from(byServiceTypeMap.entries())
    .map(([label, total_cents]) => ({ label, total_cents }))
    .sort((a, b) => b.total_cents - a.total_cents);

  const byMethodMap = new Map<string, number>();
  for (const payment of incomePayments) {
    byMethodMap.set(payment.payment_method_name, (byMethodMap.get(payment.payment_method_name) ?? 0) + payment.amount_cents);
  }
  const byMethod = Array.from(byMethodMap.entries())
    .map(([label, total_cents]) => ({ label, total_cents }))
    .sort((a, b) => b.total_cents - a.total_cents);

  const total = incomePayments.reduce((sum, payment) => sum + payment.amount_cents, 0);

  return NextResponse.json({ year, years, total, byMonth, byServiceType, byMethod, cumulative, annualBudgetCents: settings?.annual_budget_cents ?? 0 });
}
