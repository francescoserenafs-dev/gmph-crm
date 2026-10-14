import assert from "node:assert/strict";
import test from "node:test";
import { computeEconomicDashboard, planCoherence, priceListFor, resolveAnnualTarget, serviceTargetValueCents, ticketAboveListMax } from "../lib/economic-plans.ts";

test("Home target: plan first, legacy budget fallback, 0 if neither", () => {
  assert.deepEqual(resolveAnnualTarget(1500000, null), { targetCents: 1500000, source: "plan" });
  assert.deepEqual(resolveAnnualTarget(null, 900000), { targetCents: 900000, source: "legacy_budget" });
  assert.deepEqual(resolveAnnualTarget(1500000, 900000), { targetCents: 1500000, source: "plan" });
  assert.deepEqual(resolveAnnualTarget(0, 900000), { targetCents: 0, source: "plan" });
  assert.deepEqual(resolveAnnualTarget(null, null), { targetCents: 0, source: "legacy_budget" });
});

const distribution2027 = {
  famiglia: [0, 0, 3, 3, 3, 0, 0, 0, 3, 3, 0, 0],
  maternita: [1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0],
  kids: [0, 0, 0, 0, 2, 3, 3, 0, 0, 0, 0, 0],
  ritratto: [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  natale: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 25, 0],
  autunno: [0, 0, 0, 0, 0, 0, 0, 0, 3, 5, 0, 0],
  mamma: [0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0],
  battesimo: Array(12).fill(0),
};

const plan2027 = {
  year: 2027,
  annualTargetCents: 1500000,
  expectedUpliftCents: 76500,
  notes: "Piano economico centrale GMPH 2027",
  monthlyTargets: [45000, 45000, 120000, 200000, 180000, 120000, 100000, 0, 150000, 170000, 370000, 0].map((targetCents, index) => ({ month: index + 1, targetCents })),
  serviceTargets: [
    ["famiglia", 15, 24000], ["maternita", 10, 23000], ["kids", 8, 12500], ["ritratto", 6, 20000],
    ["natale", 25, 13500], ["autunno", 8, 12000], ["mamma", 6, 12500], ["battesimo", 3, 35000],
  ].map(([serviceTypeId, targetSessions, plannedBaseTicketCents]) => ({ serviceTypeId, targetSessions, plannedBaseTicketCents, targetValueCents: serviceTargetValueCents(targetSessions, plannedBaseTicketCents), monthlySessions: distribution2027[serviceTypeId] })),
};

test("2027 base value = sessions x planned base ticket, per service and in total", () => {
  const values = Object.fromEntries(plan2027.serviceTargets.map((entry) => [entry.serviceTypeId, entry.targetValueCents]));
  assert.deepEqual(values, { famiglia: 360000, maternita: 230000, kids: 100000, ritratto: 120000, natale: 337500, autunno: 96000, mamma: 75000, battesimo: 105000 });
  assert.equal(serviceTargetValueCents(18, 24000), 432000);
  assert.equal(serviceTargetValueCents(15, 22500), 337500);
  assert.equal(serviceTargetValueCents(0, 24000), 0);
});

test("current price list is reference only: active packages range, none for services without packages, warning above max", () => {
  const packages = [
    { serviceTypeId: "famiglia", name: "Momenti 2027", priceCents: 17000 },
    { serviceTypeId: "famiglia", name: "Racconto 2027", priceCents: 22000 },
    { serviceTypeId: "famiglia", name: "Ricordi", priceCents: 29000 },
    { serviceTypeId: "famiglia", name: "Collezione 2027", priceCents: 39000 },
  ];
  const famiglia = priceListFor("famiglia", packages);
  assert.equal(famiglia.minCents, 17000);
  assert.equal(famiglia.maxCents, 39000);
  assert.deepEqual(famiglia.packages.map((entry) => entry.name), ["Momenti 2027", "Racconto 2027", "Ricordi", "Collezione 2027"]);
  assert.equal(priceListFor("battesimo", packages), null);
  assert.equal(ticketAboveListMax(24000, famiglia), false);
  assert.equal(ticketAboveListMax(39000, famiglia), false);
  assert.equal(ticketAboveListMax(45000, famiglia), true);
  assert.equal(ticketAboveListMax(999999, null), false);
  // Il listino non altera il piano: il valore resta sessioni x ticket pianificato.
  assert.equal(plan2027.serviceTargets[0].targetValueCents, 360000);
});

test("2027 monthly session distribution: per-service totals, monthly totals, Battesimo warning", () => {
  const summary = planCoherence(plan2027);
  const totals = Object.fromEntries(plan2027.serviceTargets.map((entry) => [entry.serviceTypeId, entry.monthlySessions.reduce((a, b) => a + b, 0)]));
  assert.deepEqual(totals, { famiglia: 15, maternita: 10, kids: 8, ritratto: 6, natale: 25, autunno: 8, mamma: 6, battesimo: 0 });
  assert.deepEqual(summary.distributedByMonth, [2, 2, 5, 11, 7, 5, 4, 0, 7, 9, 26, 0]);
  assert.equal(summary.distributedSessions, 78);
  assert.equal(summary.serviceSessions, 81);
  assert.equal(summary.distributionDifference, -3);
  assert.deepEqual(summary.undistributedServices, [{ serviceTypeId: "battesimo", targetSessions: 3, distributedSessions: 0 }]);
});

test("2027 seed values are coherent: 15.000 monthly, 14.235 services, 765 uplift, 15.000 planned", () => {
  const summary = planCoherence(plan2027);
  assert.equal(summary.monthlySumCents, 1500000);
  assert.equal(summary.monthlyDifferenceCents, 0);
  assert.equal(summary.serviceValueCents, 1423500);
  assert.equal(summary.serviceSessions, 81);
  assert.equal(summary.plannedValueCents, 1500000);
  assert.equal(summary.plannedDifferenceCents, 0);
});

test("warnings: monthly sum or services + uplift different from annual target", () => {
  const edited = { ...plan2027, monthlyTargets: plan2027.monthlyTargets.map((entry) => (entry.month === 1 ? { ...entry, targetCents: 50000 } : entry)) };
  assert.equal(planCoherence(edited).monthlyDifferenceCents, 5000);
  const lowerUplift = { ...plan2027, expectedUpliftCents: 0 };
  assert.equal(planCoherence(lowerUplift).plannedDifferenceCents, -76500);
});

const now = new Date("2027-06-15T10:00:00.000Z");
const serviceNames = new Map([["famiglia", "Famiglia"], ["natale", "Mini Sessione Natale"], ["commerciale", "Commerciale"]]);
const sessions = [
  { scheduledAt: "2027-01-10T10:00:00.000Z", serviceTypeId: "famiglia", serviceName: "Famiglia", agreedPriceCents: 20000, extrasCents: 5000, paidCents: 25000, isCancelled: false },
  { scheduledAt: "2027-02-10T10:00:00.000Z", serviceTypeId: "famiglia", serviceName: "Famiglia", agreedPriceCents: 20000, extrasCents: 0, paidCents: 0, isCancelled: true },
  { scheduledAt: "2027-11-20T10:00:00.000Z", serviceTypeId: "natale", serviceName: "Mini Sessione Natale", agreedPriceCents: 13500, extrasCents: 0, paidCents: 13500, isCancelled: false },
  { scheduledAt: "2027-03-05T10:00:00.000Z", serviceTypeId: "commerciale", serviceName: "Commerciale", agreedPriceCents: 30000, extrasCents: 0, paidCents: 10000, isCancelled: false },
  { scheduledAt: "2026-12-20T10:00:00.000Z", serviceTypeId: "famiglia", serviceName: "Famiglia", agreedPriceCents: 99900, extrasCents: 0, paidCents: 0, isCancelled: false },
];
const payments = [
  { amountCents: 25000, paidDate: "2027-01-10", category: "full_payment", isVoucherRedemption: false, voucherId: null },
  { amountCents: 10000, paidDate: "2027-03-01", category: "deposit", isVoucherRedemption: false, voucherId: null },
  { amountCents: 13500, paidDate: "2027-05-01", category: "voucher_purchase", isVoucherRedemption: false, voucherId: "v1" },
  { amountCents: 13500, paidDate: "2027-11-20", category: "voucher_redemption", isVoucherRedemption: true, voucherId: null },
];

test("dashboard with plan: cancelled excluded, extras included, future separated, cash separated, vouchers not double counted", () => {
  const result = computeEconomicDashboard({ year: 2027, now, plan: plan2027, sessions, payments, serviceNames });

  assert.equal(result.kpis.realizedCents, 55000);
  assert.equal(result.kpis.futureCents, 13500);
  assert.equal(result.kpis.acquiredCents, 68500);
  assert.equal(result.kpis.realizedSessions, 2);
  assert.equal(result.kpis.futureSessions, 1);
  assert.equal(result.kpis.coverage, 68500 / 1500000);
  assert.equal(result.kpis.toGenerateCents, 1500000 - 68500);
  assert.equal(result.kpis.averageTicketCents, 68500 / 3);
  assert.equal(result.kpis.cashInCents, 48500);
  assert.equal(result.cash.voucherSalesCents, 13500);
  assert.equal(result.cash.voucherSalesCount, 1);
  assert.equal(result.cash.receivableCents, 20000);
  assert.deepEqual(result.baseVsExtra, { baseCents: 63500, extrasCents: 5000, extraShare: 5000 / 68500 });

  assert.equal(result.months[0].targetCents, 45000);
  assert.equal(result.months[0].targetSessions, 2);
  assert.equal(result.months[0].acquiredSessions, 1);
  assert.equal(result.months[3].targetSessions, 11);
  assert.equal(result.months[10].targetSessions, 26);
  assert.equal(result.months[10].acquiredSessions, 1);
  assert.equal(result.months[1].acquiredSessions, 0);
  assert.equal(result.months[0].acquiredCents, 25000);
  assert.equal(result.months[0].gapCents, -20000);
  assert.equal(result.months[1].acquiredCents, 0);
  assert.equal(result.months[10].futureCents, 13500);

  const famiglia = result.services.find((row) => row.serviceTypeId === "famiglia");
  assert.equal(famiglia.acquiredSessions, 1);
  assert.equal(famiglia.distributedSessions, 15);
  assert.equal(result.services.find((row) => row.serviceTypeId === "battesimo").distributedSessions, 0);
  assert.equal(famiglia.acquiredValueCents, 25000);
  assert.equal(famiglia.gapCents, 25000 - 360000);
  const outside = result.services.find((row) => row.serviceTypeId === "commerciale");
  assert.equal(outside.inPlan, false);
  assert.equal(outside.acquiredValueCents, 30000);
});

test("year without plan still reports real values and no target KPIs", () => {
  const result = computeEconomicDashboard({ year: 2027, now, plan: null, sessions, payments, serviceNames });
  assert.equal(result.hasPlan, false);
  assert.equal(result.kpis.annualTargetCents, null);
  assert.equal(result.kpis.coverage, null);
  assert.equal(result.kpis.toGenerateCents, null);
  assert.equal(result.kpis.acquiredCents, 68500);
  assert.equal(result.kpis.cashInCents, 48500);
  assert.equal(result.months[0].targetCents, null);
  assert.equal(result.months[0].targetSessions, null);
  assert.ok(result.services.every((row) => !row.inPlan));
});
