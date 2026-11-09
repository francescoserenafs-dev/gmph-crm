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
// Piano vendite buoni: previsione separata dal valore servizi (mai sommata ad esso). Salvati solo ticket medio e quantita mensili.
export type VoucherSalesPlan = { plannedTicketCents: number; monthlyCounts: number[] };

export function emptyVoucherSalesPlan(): VoucherSalesPlan {
  return { plannedTicketCents: 0, monthlyCounts: Array.from({ length: 12 }, () => 0) };
}

export function computeVoucherPlanTotals(plan: VoucherSalesPlan) {
  const monthlyValueCents = plan.monthlyCounts.map((count) => count * plan.plannedTicketCents);
  const totalCount = plan.monthlyCounts.reduce((sum, count) => sum + count, 0);
  return { monthlyCounts: plan.monthlyCounts, monthlyValueCents, totalCount, totalValueCents: totalCount * plan.plannedTicketCents };
}

export type EconomicPlan = {
  year: number;
  notes: string | null;
  services: PlanService[];
  voucherPlan: VoucherSalesPlan;
};

export const MONTH_NAMES = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

const ratio = (numerator: number, denominator: number) => (denominator > 0 ? numerator / denominator : null);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/* ---------------------------------------------------------------------------
 * Definizioni economiche condivise (Home, Analisi -> Economico). Importi sempre in centesimi interi.
 * Valore servizi = prezzo concordato + extra. Cassa = pagamenti esclusi i riscatti buono.
 * ------------------------------------------------------------------------- */

// Data di calendario Europe/Rome (YYYY-MM-DD), indipendente dal fuso del server.
export function romeDateKey(value: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

// paid_date e gia la data Europe/Rome (trigger sync_payment_dates); paid_at solo come ripiego.
export function paymentDateKey(payment: { paidDate: string | null; paidAt: string | null }): string | null {
  if (payment.paidDate) return payment.paidDate.slice(0, 10);
  return payment.paidAt ? romeDateKey(payment.paidAt) : null;
}

// Regola strutturale: categoria o buono applicato, mai il nome del metodo di pagamento.
export function isVoucherRedemption(payment: { category: string; appliedVoucherId?: string | null }): boolean {
  return payment.category === "voucher_redemption" || Boolean(payment.appliedVoucherId);
}

export function isCashPayment(payment: { category: string; appliedVoucherId?: string | null }): boolean {
  return !isVoucherRedemption(payment);
}

export function calculateSessionCommercialValue(session: { agreedPriceCents: number; extrasCents: number }): number {
  return session.agreedPriceCents + session.extrasCents;
}

// Credito nominale del buono: stesso criterio del riscatto (/api/sessions/[id]/redeem).
export function voucherCreditCents(voucher: { voucher_type: string; value_cents: number | null; purchase_price_cents: number }): number {
  return voucher.voucher_type === "value" ? voucher.value_cents ?? 0 : voucher.purchase_price_cents;
}

export type RedemptionClass = "same_year" | "prior_year" | "complimentary" | "unknown";
// purchaseDates: date Europe/Rome dei pagamenti voucher_purchase del buono (fonte dell'anno di incasso).
export type VoucherOrigin = { isComplimentary: boolean; purchaseDates: (string | null)[] };

// Confronta l'anno di incasso del buono con l'anno della sessione coperta. Dati incompleti o incoerenti -> "unknown", mai corretti.
export function classifyVoucherRedemption({ sessionDate, voucher }: { sessionDate: string | null; voucher: VoucherOrigin | null }): RedemptionClass {
  if (!voucher) return "unknown";
  if (voucher.isComplimentary) return "complimentary";
  const dates = voucher.purchaseDates;
  if (!sessionDate || dates.length === 0 || dates.some((date) => !date)) return "unknown";
  if (dates.some((date) => (date as string) > sessionDate)) return "unknown";
  const sessionYear = sessionDate.slice(0, 4);
  if (dates.every((date) => (date as string).slice(0, 4) < sessionYear)) return "prior_year";
  if (dates.every((date) => (date as string).slice(0, 4) === sessionYear)) return "same_year";
  return "unknown";
}

export type EconomicSessionPayment = { amountCents: number; category: string; appliedVoucherId: string | null };

export type EconomicSession = {
  scheduledAt: string;
  serviceTypeId: string;
  serviceName: string;
  isAddonService: boolean;
  agreedPriceCents: number;
  extrasCents: number;
  payments: EconomicSessionPayment[];
  isCancelled: boolean;
};

export type EconomicPayment = {
  amountCents: number;
  paidDate: string | null;
  paidAt: string | null;
  category: string;
  methodName: string;
  appliedVoucherId: string | null;
  voucherId: string | null;
  sessionId: string | null;
  sessionScheduledAt: string | null;
  sessionServiceName: string | null;
};

export type EconomicVoucher = VoucherOrigin & { id: string; status: string; creditCents: number };

type RedemptionTotals = { totalCents: number; sameYearCents: number; priorYearCents: number; complimentaryCents: number; unknownCents: number; unknownCount: number };
const emptyRedemptions = (): RedemptionTotals => ({ totalCents: 0, sameYearCents: 0, priorYearCents: 0, complimentaryCents: 0, unknownCents: 0, unknownCount: 0 });
const redemptionKey = { same_year: "sameYearCents", prior_year: "priorYearCents", complimentary: "complimentaryCents", unknown: "unknownCents" } as const;

function addRedemption(totals: RedemptionTotals, amountCents: number, kind: RedemptionClass) {
  totals.totalCents += amountCents;
  totals[redemptionKey[kind]] += amountCents;
  if (kind === "unknown") totals.unknownCount += 1;
}

// Come e stato coperto il valore di una sessione: denaro registrato, buoni applicati (importo effettivo), residuo.
export function calculateSessionCoverage(session: Pick<EconomicSession, "agreedPriceCents" | "extrasCents" | "payments">) {
  const valueCents = calculateSessionCommercialValue(session);
  const voucherCents = sum(session.payments.filter((payment) => isVoucherRedemption(payment)).map((payment) => payment.amountCents));
  const monetaryCents = sum(session.payments.filter((payment) => isCashPayment(payment)).map((payment) => payment.amountCents));
  return { valueCents, monetaryCents, voucherCents, residualCents: Math.max(valueCents - monetaryCents - voucherCents, 0) };
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

type Bucket = { deliveredCents: number; futureCents: number; deliveredSessions: number; futureSessions: number };
const emptyBucket = (): Bucket => ({ deliveredCents: 0, futureCents: 0, deliveredSessions: 0, futureSessions: 0 });

export type EconomicServiceSummary = {
  plannedValueCents: number | null;
  acquiredCents: number;
  deliveredCents: number;
  futureCents: number;
  deliveredSessions: number;
  futureSessions: number;
  coverage: number | null;
  toGenerateCents: number | null;
  averageTicketCents: number | null;
};
export type EconomicCashSummary = { totalCents: number; sessionCashCents: number; voucherSalesCents: number; voucherSalesCount: number };
export type VoucherRedemptionSummary = RedemptionTotals;
export type MonthlyServicePerformance = {
  month: number;
  label: string;
  plannedSessions: number | null;
  acquiredSessions: number;
  plannedValueCents: number | null;
  deliveredCents: number;
  futureCents: number;
  acquiredCents: number;
  gapCents: number | null;
  coverage: number | null;
};
export type MonthlyCashPerformance = {
  month: number;
  label: string;
  sessionCashCents: number;
  voucherSalesCents: number;
  totalCashCents: number;
  redemptionsCents: number;
  priorYearRedemptionsCents: number;
  complimentaryRedemptionsCents: number;
  plannedVoucherSalesCents: number | null;
};

// Due viste parallele, mai sommate: valore servizi per data sessione, cassa per data pagamento (Europe/Rome).
// Le sessioni di servizi is_addon (legacy, es. "Provini Extra") sono escluse da conteggi e valore servizi ma restano riconciliabili in legacyAddon.
export function computeEconomicDashboard({
  year,
  now,
  plan,
  sessions,
  payments,
  vouchers,
  serviceNames,
}: {
  year: number;
  now: Date;
  plan: EconomicPlan | null;
  sessions: EconomicSession[];
  payments: EconomicPayment[];
  vouchers: EconomicVoucher[];
  serviceNames: Map<string, string>;
}) {
  const nowTime = now.getTime();
  const voucherById = new Map(vouchers.map((voucher) => [voucher.id, voucher]));
  const classify = (sessionAt: string | null, appliedVoucherId: string | null) =>
    classifyVoucherRedemption({ sessionDate: sessionAt ? romeDateKey(sessionAt) : null, voucher: appliedVoucherId ? voucherById.get(appliedVoucherId) ?? null : null });

  const total = emptyBucket();
  const byMonth = Array.from({ length: 12 }, emptyBucket);
  const byService = new Map<string, Bucket & { name: string }>();
  const redemptions = emptyRedemptions();
  const coverage = { valueCents: 0, monetaryCents: 0, voucherCents: 0, residualCents: 0 };
  const legacyAddon = { sessions: 0, valueCents: 0 };
  let baseCents = 0;
  let extrasCents = 0;

  for (const session of sessions) {
    if (session.isCancelled) continue;
    const key = romeDateKey(session.scheduledAt);
    if (Number(key.slice(0, 4)) !== year) continue;
    const sessionCoverage = calculateSessionCoverage(session);
    coverage.valueCents += sessionCoverage.valueCents;
    coverage.monetaryCents += sessionCoverage.monetaryCents;
    coverage.voucherCents += sessionCoverage.voucherCents;
    coverage.residualCents += sessionCoverage.residualCents;
    for (const payment of session.payments) {
      if (isVoucherRedemption(payment)) addRedemption(redemptions, payment.amountCents, classify(session.scheduledAt, payment.appliedVoucherId));
    }
    if (session.isAddonService) {
      legacyAddon.sessions += 1;
      legacyAddon.valueCents += sessionCoverage.valueCents;
      continue;
    }
    const isFuture = new Date(session.scheduledAt).getTime() > nowTime;
    const service = byService.get(session.serviceTypeId) ?? { ...emptyBucket(), name: serviceNames.get(session.serviceTypeId) ?? session.serviceName };
    for (const bucket of [total, byMonth[Number(key.slice(5, 7)) - 1], service]) {
      if (isFuture) {
        bucket.futureCents += sessionCoverage.valueCents;
        bucket.futureSessions += 1;
      } else {
        bucket.deliveredCents += sessionCoverage.valueCents;
        bucket.deliveredSessions += 1;
      }
    }
    byService.set(session.serviceTypeId, service);
    baseCents += session.agreedPriceCents;
    extrasCents += session.extrasCents;
  }

  const cash: EconomicCashSummary = { totalCents: 0, sessionCashCents: 0, voucherSalesCents: 0, voucherSalesCount: 0 };
  const soldVouchers = new Set<string>();
  const cashMonths = Array.from({ length: 12 }, () => ({ sessionCashCents: 0, voucherSalesCents: 0, redemptions: emptyRedemptions() }));
  for (const payment of payments) {
    const dateKey = paymentDateKey(payment);
    if (!dateKey || Number(dateKey.slice(0, 4)) !== year) continue;
    const month = cashMonths[Number(dateKey.slice(5, 7)) - 1];
    if (isVoucherRedemption(payment)) {
      addRedemption(month.redemptions, payment.amountCents, classify(payment.sessionScheduledAt, payment.appliedVoucherId));
      continue;
    }
    cash.totalCents += payment.amountCents;
    if (payment.category === "voucher_purchase") {
      cash.voucherSalesCents += payment.amountCents;
      month.voucherSalesCents += payment.amountCents;
      if (payment.voucherId) soldVouchers.add(payment.voucherId);
    } else {
      cash.sessionCashCents += payment.amountCents;
      month.sessionCashCents += payment.amountCents;
    }
  }
  cash.voucherSalesCount = soldVouchers.size;

  const planTotals = plan ? computePlanTotals(plan.services) : null;
  const voucherPlanTotals = plan ? computeVoucherPlanTotals(plan.voucherPlan) : null;
  const plannedValueCents = planTotals?.totalValueCents ?? null;
  const acquiredCents = total.deliveredCents + total.futureCents;
  const acquiredSessions = total.deliveredSessions + total.futureSessions;
  const planServiceIds = new Set((plan?.services ?? []).map((entry) => entry.serviceTypeId));
  const activeVouchers = vouchers.filter((voucher) => voucher.status === "active");

  const services: EconomicServiceSummary = {
    plannedValueCents,
    acquiredCents,
    deliveredCents: total.deliveredCents,
    futureCents: total.futureCents,
    deliveredSessions: total.deliveredSessions,
    futureSessions: total.futureSessions,
    coverage: plannedValueCents === null ? null : ratio(acquiredCents, plannedValueCents),
    toGenerateCents: plannedValueCents === null ? null : Math.max(plannedValueCents - acquiredCents, 0),
    averageTicketCents: acquiredSessions > 0 ? Math.round(acquiredCents / acquiredSessions) : null,
  };

  const monthlyServices: MonthlyServicePerformance[] = byMonth.map((bucket, index) => {
    const planned = planTotals ? planTotals.monthlyValueCents[index] : null;
    const monthAcquired = bucket.deliveredCents + bucket.futureCents;
    return {
      month: index + 1,
      label: MONTH_NAMES[index],
      plannedSessions: planTotals ? planTotals.monthlySessions[index] : null,
      acquiredSessions: bucket.deliveredSessions + bucket.futureSessions,
      plannedValueCents: planned,
      deliveredCents: bucket.deliveredCents,
      futureCents: bucket.futureCents,
      acquiredCents: monthAcquired,
      gapCents: planned === null ? null : monthAcquired - planned,
      coverage: planned === null ? null : ratio(monthAcquired, planned),
    };
  });

  const monthlyCash: MonthlyCashPerformance[] = cashMonths.map((month, index) => ({
    month: index + 1,
    label: MONTH_NAMES[index],
    sessionCashCents: month.sessionCashCents,
    voucherSalesCents: month.voucherSalesCents,
    totalCashCents: month.sessionCashCents + month.voucherSalesCents,
    redemptionsCents: month.redemptions.totalCents,
    priorYearRedemptionsCents: month.redemptions.priorYearCents,
    complimentaryRedemptionsCents: month.redemptions.complimentaryCents,
    plannedVoucherSalesCents: voucherPlanTotals ? voucherPlanTotals.monthlyValueCents[index] : null,
  }));

  return {
    year,
    hasPlan: plan !== null,
    plan: {
      serviceValueCents: plannedValueCents,
      sessions: planTotals?.totalSessions ?? null,
      averageTicketCents: planTotals?.averageTicketCents ?? null,
      plannedServices: planTotals?.plannedServices ?? null,
      voucherSalesCount: voucherPlanTotals?.totalCount ?? null,
      voucherSalesValueCents: voucherPlanTotals?.totalValueCents ?? null,
    },
    services,
    coverage,
    legacyAddon,
    cash,
    redemptions,
    receivableCents: coverage.residualCents,
    activeVouchers: { count: activeVouchers.length, creditCents: sum(activeVouchers.map((voucher) => voucher.creditCents)) },
    monthlyServices,
    monthlyCash,
    serviceRows: [
      ...(planTotals?.services ?? []).map((target) => {
        const actual = byService.get(target.serviceTypeId);
        const acquiredValue = (actual?.deliveredCents ?? 0) + (actual?.futureCents ?? 0);
        return {
          serviceTypeId: target.serviceTypeId,
          name: serviceNames.get(target.serviceTypeId) ?? "Servizio non disponibile",
          inPlan: true,
          plannedSessions: target.sessions as number | null,
          acquiredSessions: (actual?.deliveredSessions ?? 0) + (actual?.futureSessions ?? 0),
          plannedValueCents: target.valueCents as number | null,
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
          plannedSessions: null,
          acquiredSessions: actual.deliveredSessions + actual.futureSessions,
          plannedValueCents: null,
          acquiredValueCents: actual.deliveredCents + actual.futureCents,
          gapCents: null,
        }))
        .sort((a, b) => b.acquiredValueCents - a.acquiredValueCents),
    ],
    baseVsExtra: { baseCents, extrasCents, extraShare: ratio(extrasCents, baseCents + extrasCents) },
  };
}

export type EconomicDashboard = ReturnType<typeof computeEconomicDashboard>;
