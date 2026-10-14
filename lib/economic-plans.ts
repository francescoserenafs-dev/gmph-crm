export type MonthlyTarget = { month: number; targetCents: number };
export type ServiceTarget = { serviceTypeId: string; targetSessions: number; targetValueCents: number };
export type EconomicPlan = {
  year: number;
  annualTargetCents: number;
  expectedUpliftCents: number;
  notes: string | null;
  monthlyTargets: MonthlyTarget[];
  serviceTargets: ServiceTarget[];
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

export function planCoherence(plan: Pick<EconomicPlan, "annualTargetCents" | "expectedUpliftCents" | "monthlyTargets" | "serviceTargets">) {
  const monthlySumCents = plan.monthlyTargets.reduce((sum, entry) => sum + entry.targetCents, 0);
  const serviceValueCents = plan.serviceTargets.reduce((sum, entry) => sum + entry.targetValueCents, 0);
  const serviceSessions = plan.serviceTargets.reduce((sum, entry) => sum + entry.targetSessions, 0);
  const plannedValueCents = serviceValueCents + plan.expectedUpliftCents;
  return {
    monthlySumCents,
    monthlyDifferenceCents: monthlySumCents - plan.annualTargetCents,
    serviceValueCents,
    serviceSessions,
    plannedValueCents,
    plannedDifferenceCents: plannedValueCents - plan.annualTargetCents,
  };
}

export function impliedTicketCents(target: ServiceTarget): number | null {
  return target.targetSessions > 0 ? target.targetValueCents / target.targetSessions : null;
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
  const annualTargetCents = plan?.annualTargetCents ?? null;
  const monthlyTargets = new Map((plan?.monthlyTargets ?? []).map((entry) => [entry.month, entry.targetCents]));
  const planServiceIds = new Set((plan?.serviceTargets ?? []).map((entry) => entry.serviceTypeId));

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
      const targetCents = plan ? monthlyTargets.get(index + 1) ?? 0 : null;
      const monthAcquired = bucket.realizedCents + bucket.futureCents;
      return {
        month: index + 1,
        label: MONTH_NAMES[index],
        targetCents,
        realizedCents: bucket.realizedCents,
        futureCents: bucket.futureCents,
        acquiredCents: monthAcquired,
        gapCents: targetCents === null ? null : monthAcquired - targetCents,
        coverage: targetCents === null ? null : ratio(monthAcquired, targetCents),
      };
    }),
    services: [
      ...(plan?.serviceTargets ?? []).map((target) => {
        const actual = byService.get(target.serviceTypeId);
        const acquiredValue = (actual?.realizedCents ?? 0) + (actual?.futureCents ?? 0);
        return {
          serviceTypeId: target.serviceTypeId,
          name: serviceNames.get(target.serviceTypeId) ?? "Servizio non disponibile",
          inPlan: true,
          targetSessions: target.targetSessions as number | null,
          acquiredSessions: (actual?.realizedSessions ?? 0) + (actual?.futureSessions ?? 0),
          targetValueCents: target.targetValueCents as number | null,
          acquiredValueCents: acquiredValue,
          gapCents: (acquiredValue - target.targetValueCents) as number | null,
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
