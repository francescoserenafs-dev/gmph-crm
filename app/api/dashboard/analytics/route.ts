import { type NextRequest, NextResponse } from "next/server";
import { computeEconomicDashboard, isCashPayment } from "@/lib/economic-plans";
import { loadEconomicDataset, loadPlan, parseYear } from "@/lib/economic-plans-server";
import { toLocalDateKey } from "@/lib/datetime";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const grouped = (entries: [string, number][]) => {
  const map = new Map<string, number>();
  for (const [label, cents] of entries) map.set(label, (map.get(label) ?? 0) + cents);
  return Array.from(map.entries()).map(([label, total_cents]) => ({ label, total_cents })).sort((a, b) => b.total_cents - a.total_cents);
};

// Stesse definizioni di Analisi -> Economico: cassa per data pagamento Europe/Rome esclusi i riscatti; valore servizi vs piano.
export async function GET(request: NextRequest) {
  const currentYear = Number(toLocalDateKey(new Date()).slice(0, 4));
  const year = parseYear(request.nextUrl.searchParams.get("year")) ?? currentYear;

  try {
    const [firstPayment, dataset, loaded] = await Promise.all([
      supabaseAdmin.from("payments").select("paid_date").not("paid_date", "is", null).order("paid_date", { ascending: true }).limit(1),
      loadEconomicDataset(year),
      loadPlan(year),
    ]);
    if (firstPayment.error) throw firstPayment.error;

    const earliestYear = firstPayment.data?.[0]?.paid_date ? Number(firstPayment.data[0].paid_date.slice(0, 4)) : currentYear;
    const years: number[] = [];
    for (let candidate = currentYear; candidate >= earliestYear; candidate -= 1) years.push(candidate);
    if (!years.includes(year)) years.unshift(year);

    const economic = computeEconomicDashboard({ year, now: new Date(), plan: loaded?.plan ?? null, ...dataset, serviceNames: new Map() });
    const byMonth = economic.monthlyCash.map((month) => ({ month: month.month, label: month.label, total_cents: month.totalCashCents }));
    let running = 0;
    const cumulative = byMonth.map((entry) => {
      running += entry.total_cents;
      return { month: entry.month, label: entry.label, total_cents: running };
    });
    const cashPayments = dataset.payments.filter((payment) => isCashPayment(payment));

    return NextResponse.json({
      year,
      years,
      cashTotalCents: economic.cash.totalCents,
      byMonth,
      cumulative,
      byServiceType: grouped(cashPayments.map((payment) => [payment.category === "voucher_purchase" ? "Vendite buoni regalo" : payment.sessionServiceName ?? "Altro", payment.amountCents])),
      byMethod: grouped(cashPayments.map((payment) => [payment.methodName, payment.amountCents])),
      plannedServiceValueCents: economic.services.plannedValueCents,
      acquiredServiceValueCents: economic.services.acquiredCents,
    });
  } catch {
    return NextResponse.json({ error: "Non e stato possibile caricare le analisi." }, { status: 500 });
  }
}
