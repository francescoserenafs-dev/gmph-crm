// Unici dati salvati per servizio: ticket medio pianificato (extra inclusi) e sessioni dei 12 mesi (gen..dic).
export type PlanService = { serviceTypeId: string; plannedTicketCents: number; monthlySessions: number[] };

// Unica logica di calcolo del piano (UI, dashboard, Home): tutti i totali derivano da sessioni mensili x ticket, in centesimi interi.
export function computePlanTotals(services: PlanService[]) {
  const rows = services.map((service) => {
    const monthlyValueCents = service.monthlySessions.map((sessions) => sessions * service.plannedTicketCents);
    const sessions = service.monthlySessions.reduce((sum, value) => sum + value, 0);
    return { serviceTypeId: service.serviceTypeId, sessions, valueCents: sessions * service.plannedTicketCents, monthlyValueCents };
  });
  const monthlySessions = Array.from({ length: 12 }, (_, index) => services.reduce((sum, service) => sum + (service.monthlySessions[index] ?? 0), 0));
  const monthlyValueCents = Array.from({ length: 12 }, (_, index) => rows.reduce((sum, row) => sum + (row.monthlyValueCents[index] ?? 0), 0));
  const totalSessions = rows.reduce((sum, row) => sum + row.sessions, 0);
  const totalValueCents = rows.reduce((sum, row) => sum + row.valueCents, 0);
  return {
    services: rows,
    monthlySessions,
    monthlyValueCents,
    totalSessions,
    totalValueCents,
    averageTicketCents: totalSessions > 0 ? Math.round(totalValueCents / totalSessions) : null,
    plannedServices: rows.filter((row) => row.sessions > 0).length,
  };
}

export type ActivePackage = { serviceTypeId: string; name: string; priceCents: number };

// Listino attuale come solo riferimento visivo: non alimenta mai il piano.
export function priceListFor(serviceTypeId: string, packages: ActivePackage[]) {
  const own = packages.filter((entry) => entry.serviceTypeId === serviceTypeId);
  if (own.length === 0) return null;
  const prices = own.map((entry) => entry.priceCents);
  return { minCents: Math.min(...prices), maxCents: Math.max(...prices), packages: own };
}

export function ticketAboveListMax(plannedTicketCents: number, priceList: { maxCents: number } | null): boolean {
  return priceList !== null && plannedTicketCents > priceList.maxCents;
}
export type EconomicPlan = {
  year: number;
  notes: string | null;
  services: PlanService[];
};

export type EconomicSession = {
  scheduledAt: string;
  serviceTypeId: string;
  serviceName: string;
  agreedPriceCents: number;
  extrasCents: number;
  paidCents: number;
  isCancelled: boolean;
};

export type EconomicPayment = {
  amountCents: number;
  paidDate: string;
  category: string;
  isVoucherRedemption: boolean;
  voucherId: string | null;
};

export const MONTH_NAMES = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

const ratio = (numerator: number, denominator: number) => (denominator > 0 ? numerator / denominator : null);

function localDateKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

// Mesi mancanti valgono 0; righe mensili di servizi non (piu) nel piano vengono ignorate.
export function buildPlanServices(
  services: { service_type_id: string; planned_ticket_cents: number }[],
  serviceMonths: { service_type_id: string; month: number; target_sessions: number }[],
): PlanService[] {
  return services.map((service) => {
    const monthlySessions = Array.from({ length: 12 }, () => 0);
    for (const cell of serviceMonths) {
      if (cell.service_type_id === service.service_type_id && cell.month >= 1 && cell.month <= 12) monthlySessions[cell.month - 1] = cell.target_sessions;
    }
    return { serviceTypeId: service.service_type_id, plannedTicketCents: service.planned_ticket_cents, monthlySessions };
  });
}

export function resolveAnnualTarget(planTargetCents: number | null, legacyBudgetCents: number | null): { targetCents: number; source: "plan" | "legacy_budget" } {
  if (planTargetCents !== null) return { targetCents: planTargetCents, source: "plan" };
  return { targetCents: legacyBudgetCents ?? 0, source: "legacy_budget" };
}

type Bucket = { realizedCents: number; futureCents: number; realizedSessions: number; futureSessions: number };
const emptyBucket = (): Bucket => ({ realizedCents: 0, futureCents: 0, realizedSessions: 0, futureSessions: 0 });

export function computeEconomicDashboard({
  year,
  now,
  plan,
  sessions,
  payments,
  serviceNames,
}: {
  year: number;
  now: Date;
  plan: EconomicPlan | null;
  sessions: EconomicSession[];
  payments: EconomicPayment[];
  serviceNames: Map<string, string>;
}) {
  const nowTime = now.getTime();
  const total = emptyBucket();
  const byMonth = Array.from({ length: 12 }, emptyBucket);
  const byService = new Map<string, Bucket & { name: string }>();
  let baseCents = 0;
  let extrasCents = 0;
  let receivableCents = 0;

  for (const session of sessions) {
    if (session.isCancelled) continue;
    const date = new Date(session.scheduledAt);
    const key = localDateKey(date);
    if (Number(key.slice(0, 4)) !== year) continue;
    const valueCents = session.agreedPriceCents + session.extrasCents;
    const isFuture = date.getTime() > nowTime;
    const service = byService.get(session.serviceTypeId) ?? { ...emptyBucket(), name: serviceNames.get(session.serviceTypeId) ?? session.serviceName };
    for (const bucket of [total, byMonth[Number(key.slice(5, 7)) - 1], service]) {
      if (isFuture) {
        bucket.futureCents += valueCents;
        bucket.futureSessions += 1;
      } else {
        bucket.realizedCents += valueCents;
        bucket.realizedSessions += 1;
      }
    }
    byService.set(session.serviceTypeId, service);
    baseCents += session.agreedPriceCents;
    extrasCents += session.extrasCents;
    receivableCents += Math.max(valueCents - session.paidCents, 0);
  }

  // Cassa: i riscatti buono non sono nuovo incasso (il buono e gia stato incassato all'acquisto).
  const cashPayments = payments.filter((payment) => !payment.isVoucherRedemption && Number(payment.paidDate.slice(0, 4)) === year);
  const voucherPurchases = cashPayments.filter((payment) => payment.category === "voucher_purchase");

  const acquiredCents = total.realizedCents + total.futureCents;
  const acquiredSessions = total.realizedSessions + total.futureSessions;
  const planTotals = plan ? computePlanTotals(plan.services) : null;
  const annualTargetCents = planTotals?.totalValueCents ?? null;
  const planServiceIds = new Set((plan?.services ?? []).map((entry) => entry.serviceTypeId));

  return {
    year,
    hasPlan: plan !== null,
    kpis: {
      annualTargetCents,
      acquiredCents,
      realizedCents: total.realizedCents,
      futureCents: total.futureCents,
      coverage: annualTargetCents === null ? null : ratio(acquiredCents, annualTargetCents),
      toGenerateCents: annualTargetCents === null ? null : Math.max(annualTargetCents - acquiredCents, 0),
      cashInCents: cashPayments.reduce((sum, payment) => sum + payment.amountCents, 0),
      averageTicketCents: ratio(acquiredCents, acquiredSessions),
      realizedSessions: total.realizedSessions,
      futureSessions: total.futureSessions,
    },
    months: byMonth.map((bucket, index) => {
      const targetCents = planTotals ? planTotals.monthlyValueCents[index] : null;
      const monthAcquired = bucket.realizedCents + bucket.futureCents;
      return {
        month: index + 1,
        label: MONTH_NAMES[index],
        targetSessions: planTotals ? planTotals.monthlySessions[index] : null,
        acquiredSessions: bucket.realizedSessions + bucket.futureSessions,
        targetCents,
        realizedCents: bucket.realizedCents,
        futureCents: bucket.futureCents,
        acquiredCents: monthAcquired,
        gapCents: targetCents === null ? null : monthAcquired - targetCents,
        coverage: targetCents === null ? null : ratio(monthAcquired, targetCents),
      };
    }),
    services: [
      ...(planTotals?.services ?? []).map((target) => {
        const actual = byService.get(target.serviceTypeId);
        const acquiredValue = (actual?.realizedCents ?? 0) + (actual?.futureCents ?? 0);
        return {
          serviceTypeId: target.serviceTypeId,
          name: serviceNames.get(target.serviceTypeId) ?? "Servizio non disponibile",
          inPlan: true,
          targetSessions: target.sessions as number | null,
          acquiredSessions: (actual?.realizedSessions ?? 0) + (actual?.futureSessions ?? 0),
          targetValueCents: target.valueCents as number | null,
          acquiredValueCents: acquiredValue,
          gapCents: (acquiredValue - target.valueCents) as number | null,
        };
      }),
      ...Array.from(byService.entries())
        .filter(([serviceTypeId]) => !planServiceIds.has(serviceTypeId))
        .map(([serviceTypeId, actual]) => ({
          serviceTypeId,
          name: actual.name,
          inPlan: false,
          targetSessions: null,
          acquiredSessions: actual.realizedSessions + actual.futureSessions,
          targetValueCents: null,
          acquiredValueCents: actual.realizedCents + actual.futureCents,
          gapCents: null,
        }))
        .sort((a, b) => b.acquiredValueCents - a.acquiredValueCents),
    ],
    baseVsExtra: { baseCents, extrasCents, extraShare: ratio(extrasCents, baseCents + extrasCents) },
    cash: {
      collectedCents: cashPayments.reduce((sum, payment) => sum + payment.amountCents, 0),
      receivableCents,
      voucherSalesCents: voucherPurchases.reduce((sum, payment) => sum + payment.amountCents, 0),
      voucherSalesCount: new Set(voucherPurchases.map((payment) => payment.voucherId)).size,
    },
  };
}
