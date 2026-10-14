import { type NextRequest, NextResponse } from "next/server";
import { computeEconomicDashboard, type EconomicPayment, type EconomicSession } from "@/lib/economic-plans";
import { loadPlan, loadPlanYears, parseYear } from "@/lib/economic-plans-server";
import { parseLocalDateTime, toLocalDateKey } from "@/lib/datetime";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;

type SessionRow = {
  scheduled_at: string;
  service_type_id: string;
  service_name: string;
  agreed_price_cents: number;
  current_stage: { code: string } | null;
  extras: { line_total_cents: number }[];
  payments: { amount_cents: number }[];
};

type PaymentRow = { amount_cents: number; paid_date: string; category: string; applied_voucher_id: string | null; voucher_id: string | null };

async function loadPaged<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await build(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function GET(request: NextRequest) {
  const currentYear = Number(toLocalDateKey(new Date()).slice(0, 4));
  const year = parseYear(request.nextUrl.searchParams.get("year")) ?? currentYear;
  const start = parseLocalDateTime(`${year}-01-01T00:00`).toISOString();
  const end = parseLocalDateTime(`${year + 1}-01-01T00:00`).toISOString();

  try {
    const [sessionRows, paymentRows, loaded, planYears, services, firstSession] = await Promise.all([
      loadPaged<SessionRow>((from, to) => supabaseAdmin
        .from("sessions")
        .select("scheduled_at, service_type_id, service_name, agreed_price_cents, current_stage:session_stages!sessions_current_stage_id_fkey(code), extras:session_extras(line_total_cents), payments(amount_cents)")
        .gte("scheduled_at", start)
        .lt("scheduled_at", end)
        .order("scheduled_at")
        .range(from, to)),
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

    const sessions: EconomicSession[] = sessionRows.map((row) => ({
      scheduledAt: row.scheduled_at,
      serviceTypeId: row.service_type_id,
      serviceName: row.service_name,
      agreedPriceCents: row.agreed_price_cents,
      extrasCents: (row.extras ?? []).reduce((sum, extra) => sum + extra.line_total_cents, 0),
      paidCents: (row.payments ?? []).reduce((sum, payment) => sum + payment.amount_cents, 0),
      isCancelled: row.current_stage?.code === "cancelled",
    }));
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
