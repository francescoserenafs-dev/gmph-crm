import assert from "node:assert/strict";
import test from "node:test";
import { computeEconomicDashboard, impliedTicketCents, planCoherence, resolveAnnualTarget } from "../lib/economic-plans.ts";

test("Home target: plan first, legacy budget fallback, 0 if neither", () => {
  assert.deepEqual(resolveAnnualTarget(1500000, null), { targetCents: 1500000, source: "plan" });
  assert.deepEqual(resolveAnnualTarget(null, 900000), { targetCents: 900000, source: "legacy_budget" });
  assert.deepEqual(resolveAnnualTarget(1500000, 900000), { targetCents: 1500000, source: "plan" });
  assert.deepEqual(resolveAnnualTarget(0, 900000), { targetCents: 0, source: "plan" });
  assert.deepEqual(resolveAnnualTarget(null, null), { targetCents: 0, source: "legacy_budget" });
});

const plan2027 = {
  year: 2027,
  annualTargetCents: 1500000,
  expectedUpliftCents: 76500,
  notes: "Piano economico centrale GMPH 2027",
  monthlyTargets: [45000, 45000, 120000, 200000, 180000, 120000, 100000, 0, 150000, 170000, 370000, 0].map((targetCents, index) => ({ month: index + 1, targetCents })),
  serviceTargets: [
    ["famiglia", 15, 360000], ["maternita", 10, 230000], ["kids", 8, 100000], ["ritratto", 6, 120000],
    ["natale", 25, 337500], ["autunno", 8, 96000], ["mamma", 6, 75000], ["battesimo", 3, 105000],
  ].map(([serviceTypeId, targetSessions, targetValueCents]) => ({ serviceTypeId, targetSessions, targetValueCents })),
};

test("2027 seed values are coherent: 15.000 monthly, 14.235 services, 765 uplift, 15.000 planned", () => {
  const summary = planCoherence(plan2027);
  assert.equal(summary.monthlySumCents, 1500000);
  assert.equal(summary.monthlyDifferenceCents, 0);
  assert.equal(summary.serviceValueCents, 1423500);
  assert.equal(summary.serviceSessions, 81);
  assert.equal(summary.plannedValueCents, 1500000);
  assert.equal(summary.plannedDifferenceCents, 0);
  assert.equal(impliedTicketCents(plan2027.serviceTargets[0]), 24000);
  assert.equal(impliedTicketCents({ serviceTypeId: "x", targetSessions: 0, targetValueCents: 1000 }), null);
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
  assert.equal(result.months[0].acquiredCents, 25000);
  assert.equal(result.months[0].gapCents, -20000);
  assert.equal(result.months[1].acquiredCents, 0);
  assert.equal(result.months[10].futureCents, 13500);

  const famiglia = result.services.find((row) => row.serviceTypeId === "famiglia");
  assert.equal(famiglia.acquiredSessions, 1);
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
  assert.ok(result.services.every((row) => !row.inPlan));
});
