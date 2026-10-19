import { type NextRequest, NextResponse } from "next/server";
import { computeEconomicDashboard, type EconomicPayment } from "@/lib/economic-plans";
import { loadEconomicSessions, loadPaged, loadPlan, loadPlanYears, parseYear } from "@/lib/economic-plans-server";
import { toLocalDateKey } from "@/lib/datetime";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PaymentRow = { amount_cents: number; paid_date: string; category: string; applied_voucher_id: string | null; voucher_id: string | null };

export async function GET(request: NextRequest) {
  const currentYear = Number(toLocalDateKey(new Date()).slice(0, 4));
  const year = parseYear(request.nextUrl.searchParams.get("year")) ?? currentYear;

  try {
    const [sessions, paymentRows, loaded, planYears, services, firstSession] = await Promise.all([
      loadEconomicSessions(year),
      loadPaged<PaymentRow>((from, to) => supabaseAdmin
        .from("payments")
        .select("amount_cents, paid_date, category, applied_voucher_id, voucher_id")
        .gte("paid_date", `${year}-01-01`)
        .lt("paid_date", `${year + 1}-01-01`)
        .order("paid_date")
        .range(from, to)),
      loadPlan(year),
      loadPlanYears(),
      supabaseAdmin.from("service_types").select("id, name"),
      supabaseAdmin.from("sessions").select("scheduled_at").order("scheduled_at").limit(1),
    ]);
    if (services.error || firstSession.error) throw services.error ?? firstSession.error;

    const payments: EconomicPayment[] = paymentRows.map((row) => ({
      amountCents: row.amount_cents,
      paidDate: row.paid_date,
      category: row.category,
      isVoucherRedemption: row.applied_voucher_id !== null || row.category === "voucher_redemption",
      voucherId: row.voucher_id,
    }));

    const firstYear = firstSession.data?.[0] ? Number(toLocalDateKey(new Date(firstSession.data[0].scheduled_at)).slice(0, 4)) : currentYear;
    const years = new Set<number>([...planYears, year, currentYear]);
    for (let candidate = firstYear; candidate <= currentYear; candidate += 1) years.add(candidate);

    const dashboard = computeEconomicDashboard({
      year,
      now: new Date(),
      plan: loaded?.plan ?? null,
      sessions,
      payments,
      serviceNames: new Map((services.data ?? []).map((service) => [service.id, service.name])),
    });

    return NextResponse.json({ ...dashboard, years: Array.from(years).sort((a, b) => b - a), planYears });
  } catch {
    return NextResponse.json({ error: "Non e stato possibile caricare l'analisi economica." }, { status: 500 });
  }
}
