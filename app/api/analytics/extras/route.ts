import { type NextRequest, NextResponse } from "next/server";
import { parseLocalDateTime, toLocalDateKey } from "@/lib/datetime";
import { EXTRA_CATEGORIES, type ExtraCategory } from "@/lib/extra-products";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ExtraLine = { line_total_cents: number; quantity: number; unit_cost_cents: number | null; category_snapshot: ExtraCategory | null };
type SessionRow = {
  service_type_id: string;
  service_name: string;
  scheduled_at: string;
  agreed_price_cents: number;
  current_stage: { code: string } | null;
  extras: ExtraLine[];
};
type AnalyzedSession = { serviceTypeId: string; serviceName: string; month: number; baseCents: number; extrasCents: number };
type Group = { sessions: number; withExtras: number; baseCents: number; extrasCents: number };

const ratio = (numerator: number, denominator: number) => (denominator > 0 ? numerator / denominator : null);

function summarize(group: Group) {
  return {
    sessions: group.sessions,
    withExtras: group.withExtras,
    upsellRate: ratio(group.withExtras, group.sessions),
    extrasCents: group.extrasCents,
    averageExtraPerSessionCents: ratio(group.extrasCents, group.sessions),
    averageExtraPerBuyerCents: ratio(group.extrasCents, group.withExtras),
    averageInitialTicketCents: ratio(group.baseCents, group.sessions),
    averageFinalTicketCents: ratio(group.baseCents + group.extrasCents, group.sessions),
  };
}

function addSession(group: Group, session: AnalyzedSession) {
  group.sessions += 1;
  group.baseCents += session.baseCents;
  group.extrasCents += session.extrasCents;
  if (session.extrasCents > 0) group.withExtras += 1;
}

const emptyGroup = (): Group => ({ sessions: 0, withExtras: 0, baseCents: 0, extrasCents: 0 });

export async function GET(request: NextRequest) {
  const currentYear = Number(toLocalDateKey(new Date()).slice(0, 4));
  const requestedYear = Number(request.nextUrl.searchParams.get("year"));
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : currentYear;
  const serviceTypeId = request.nextUrl.searchParams.get("serviceTypeId") ?? "";
  const requestedCategory = request.nextUrl.searchParams.get("category") ?? "";
  const category = (EXTRA_CATEGORIES as readonly string[]).includes(requestedCategory) ? (requestedCategory as ExtraCategory) : null;

  const periodStart = parseLocalDateTime(`${year}-01-01T00:00`).toISOString();
  const periodEnd = parseLocalDateTime(`${year + 1}-01-01T00:00`).toISOString();

  let sessionsQuery = supabaseAdmin
    .from("sessions")
    .select("service_type_id, service_name, scheduled_at, agreed_price_cents, current_stage:session_stages!sessions_current_stage_id_fkey(code), extras:session_extras(line_total_cents, quantity, unit_cost_cents, category_snapshot)")
    .gte("scheduled_at", periodStart)
    .lt("scheduled_at", periodEnd);
  if (serviceTypeId) sessionsQuery = sessionsQuery.eq("service_type_id", serviceTypeId);

  const [sessionsResult, firstSessionResult, servicesResult] = await Promise.all([
    sessionsQuery,
    supabaseAdmin.from("sessions").select("scheduled_at").order("scheduled_at", { ascending: true }).limit(1),
    supabaseAdmin.from("service_types").select("id, name, is_addon").order("sort_order"),
  ]);

  if (sessionsResult.error || firstSessionResult.error || servicesResult.error) {
    return NextResponse.json({ error: "Non e stato possibile caricare le analisi extra." }, { status: 500 });
  }

  const services = servicesResult.data ?? [];
  const serviceNames = new Map(services.map((service) => [service.id, service.name]));
  // Stesso criterio di dashboard e lista sessioni: le annullate non contano.
  const validSessions = ((sessionsResult.data ?? []) as unknown as SessionRow[]).filter((session) => session.current_stage?.code !== "cancelled");

  const total = emptyGroup();
  const byMonth = Array.from({ length: 12 }, emptyGroup);
  const byService = new Map<string, { label: string; group: Group }>();
  const byCategory = new Map<ExtraCategory | "none", { lines: number; quantity: number; valueCents: number }>();
  const margin = { revenueCents: 0, registeredCostCents: 0, revenueWithCostCents: 0 };

  for (const session of validSessions) {
    // Con categoria filtrata il ticket finale include solo gli extra di quella categoria.
    const lines = category ? session.extras.filter((line) => line.category_snapshot === category) : session.extras;
    const analyzed: AnalyzedSession = {
      serviceTypeId: session.service_type_id,
      serviceName: serviceNames.get(session.service_type_id) ?? session.service_name,
      month: Number(toLocalDateKey(new Date(session.scheduled_at)).slice(5, 7)) - 1,
      baseCents: session.agreed_price_cents,
      extrasCents: lines.reduce((sum, line) => sum + line.line_total_cents, 0),
    };

    addSession(total, analyzed);
    addSession(byMonth[analyzed.month], analyzed);
    if (!byService.has(analyzed.serviceTypeId)) byService.set(analyzed.serviceTypeId, { label: analyzed.serviceName, group: emptyGroup() });
    addSession(byService.get(analyzed.serviceTypeId)!.group, analyzed);

    for (const line of lines) {
      const key = line.category_snapshot ?? "none";
      const bucket = byCategory.get(key) ?? { lines: 0, quantity: 0, valueCents: 0 };
      bucket.lines += 1;
      bucket.quantity += line.quantity;
      bucket.valueCents += line.line_total_cents;
      byCategory.set(key, bucket);

      margin.revenueCents += line.line_total_cents;
      if (line.unit_cost_cents !== null) {
        margin.registeredCostCents += line.unit_cost_cents * line.quantity;
        margin.revenueWithCostCents += line.line_total_cents;
      }
    }
  }

  const firstYear = firstSessionResult.data?.[0] ? Number(toLocalDateKey(new Date(firstSessionResult.data[0].scheduled_at)).slice(0, 4)) : currentYear;
  const years: number[] = [];
  for (let candidate = Math.max(currentYear, year); candidate >= Math.min(firstYear, year); candidate -= 1) years.push(candidate);

  const totals = summarize(total);
  const marginCents = margin.revenueCents - margin.registeredCostCents;

  return NextResponse.json({
    year,
    years,
    services: services.filter((service) => !service.is_addon).map(({ id, name }) => ({ id, name })),
    totals: {
      ...totals,
      ticketIncreaseCents: totals.averageFinalTicketCents === null || totals.averageInitialTicketCents === null ? null : totals.averageFinalTicketCents - totals.averageInitialTicketCents,
      ticketIncreaseRate: totals.averageInitialTicketCents ? (totals.averageFinalTicketCents ?? 0) / totals.averageInitialTicketCents - 1 : null,
    },
    byMonth: byMonth.map((group, index) => ({ month: index + 1, extrasCents: group.extrasCents, upsellRate: ratio(group.withExtras, group.sessions), sessions: group.sessions })),
    byService: Array.from(byService.entries())
      .map(([id, { label, group }]) => ({ id, label, ...summarize(group) }))
      .sort((a, b) => b.sessions - a.sessions || a.label.localeCompare(b.label)),
    byCategory: Array.from(byCategory.entries())
      .map(([key, bucket]) => ({ category: key === "none" ? null : key, ...bucket, share: ratio(bucket.valueCents, margin.revenueCents) }))
      .sort((a, b) => b.valueCents - a.valueCents),
    margin: {
      revenueCents: margin.revenueCents,
      registeredCostCents: margin.registeredCostCents,
      marginCents,
      marginRate: ratio(marginCents, margin.revenueCents),
      costCoverage: ratio(margin.revenueWithCostCents, margin.revenueCents),
    },
  });
}
