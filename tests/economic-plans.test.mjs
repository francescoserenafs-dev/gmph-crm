import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as datetime from "../lib/datetime.ts";
import * as economicPlans from "../lib/economic-plans.ts";
import { computeEconomicDashboard, planCoherence, priceListFor, resolveAnnualTarget, serviceTargetValueCents, ticketAboveListMax } from "../lib/economic-plans.ts";

function loadModule(path, dependencies) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, require: (name) => { assert.ok(name in dependencies, name); return dependencies[name]; } };
  runInNewContext(code, context);
  return context.exports;
}

// Query builder Supabase minimale: registra i filtri e risolve con resolve(calls).
function fakeSupabase(resolve) {
  return {
    from(table) {
      const calls = { table };
      const builder = {
        select(columns) { calls.select = columns; return builder; },
        gte(column, value) { calls.gte = [column, value]; return builder; },
        lt(column, value) { calls.lt = [column, value]; return builder; },
        order() { return builder; },
        limit(value) { calls.limit = value; return builder; },
        range(from, to) { calls.range = [from, to]; return builder; },
        then(onFulfilled, onRejected) { return Promise.resolve(resolve(calls)).then(onFulfilled, onRejected); },
      };
      return builder;
    },
  };
}

const homeSessions = [
  { scheduledAt: "2026-03-10T09:00:00.000Z", serviceTypeId: "famiglia", serviceName: "Famiglia", agreedPriceCents: 20000, extrasCents: 4000, paidCents: 10000, isCancelled: false },
  { scheduledAt: "2026-12-10T09:00:00.000Z", serviceTypeId: "maternita", serviceName: "Maternità", agreedPriceCents: 30000, extrasCents: 0, paidCents: 0, isCancelled: false },
  { scheduledAt: "2026-05-10T09:00:00.000Z", serviceTypeId: "ritratto", serviceName: "Ritratto", agreedPriceCents: 30000, extrasCents: 0, paidCents: 0, isCancelled: true },
  // Sabato: 220 di pacchetto + 15 di supplemento già inclusi nel prezzo concordato; saldata con buono.
  { scheduledAt: "2026-06-13T08:00:00.000Z", serviceTypeId: "famiglia", serviceName: "Famiglia", agreedPriceCents: 23500, extrasCents: 0, paidCents: 23500, isCancelled: false },
];
const homePayments = [
  { amount_cents: 10000, paid_at: "2026-03-01T11:00:00.000Z", payment_method_name: "Wise", category: "deposit", session: { service_name: "Famiglia" }, voucher_id: null },
  { amount_cents: 15000, paid_at: "2026-04-01T11:00:00.000Z", payment_method_name: "Wise", category: "voucher_purchase", session: null, voucher_id: "v1" },
  { amount_cents: 23500, paid_at: "2026-06-13T11:00:00.000Z", payment_method_name: "Buono regalo", category: "voucher_redemption", session: { service_name: "Famiglia" }, voucher_id: null },
];

async function callHomeAnalytics({ sessions = homeSessions, payments = homePayments, target }) {
  const route = loadModule("../app/api/dashboard/analytics/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } },
    "@/lib/economic-plans": economicPlans,
    "@/lib/economic-plans-server": { getAnnualTargetForYear: async () => target, loadEconomicSessions: async () => sessions },
    "@/lib/supabase/admin": { supabaseAdmin: fakeSupabase((calls) => ({ data: calls.limit ? [{ paid_at: "2025-01-10T10:00:00.000Z" }] : payments, error: null })) },
  });
  return route.GET({ nextUrl: { searchParams: new URLSearchParams("year=2026") } });
}

test("Home gauge: acquired commercial value with plan target; cash stays separate", async () => {
  const { status, body } = await callHomeAnalytics({ target: { targetCents: 1000000, source: "plan" } });
  assert.equal(status, 200);
  // 200+40 realizzata, 300 futura, 235 sabato (supplemento già nel prezzo); annullata, pagamenti e buoni esclusi.
  assert.equal(body.annualAcquiredCents, 24000 + 30000 + 23500);
  assert.equal(body.annualBudgetCents, 1000000);
  assert.equal(body.annualTargetSource, "plan");
  // Incassato invariato: caparra + vendita buono, riscatto escluso.
  assert.equal(body.total, 25000);
});

test("Home gauge with legacy fallback target still compares against acquired value", async () => {
  const { body } = await callHomeAnalytics({ target: { targetCents: 500000, source: "legacy_budget" } });
  assert.equal(body.annualBudgetCents, 500000);
  assert.equal(body.annualTargetSource, "legacy_budget");
  assert.equal(body.annualAcquiredCents, 77500);
});

test("Home gauge: payments and voucher sales never change acquired value", async () => {
  const withoutPayments = await callHomeAnalytics({ payments: [], target: { targetCents: 0, source: "legacy_budget" } });
  const withPayments = await callHomeAnalytics({ target: { targetCents: 0, source: "legacy_budget" } });
  assert.equal(withoutPayments.body.annualAcquiredCents, withPayments.body.annualAcquiredCents);
  assert.equal(withoutPayments.body.total, 0);
});

test("Home acquired equals Analisi Economico acquired on the same dataset", async () => {
  const plan = { year: 2026, annualTargetCents: 1000000, expectedUpliftCents: 0, notes: null, monthlyTargets: [], serviceTargets: [] };
  const economicPayments = homePayments.map((payment) => ({ amountCents: payment.amount_cents, paidDate: payment.paid_at.slice(0, 10), category: payment.category, isVoucherRedemption: payment.category === "voucher_redemption", voucherId: payment.voucher_id }));
  const economic = computeEconomicDashboard({ year: 2026, now: new Date(), plan, sessions: homeSessions, payments: economicPayments, serviceNames: new Map() });
  const { body } = await callHomeAnalytics({ target: { targetCents: 1000000, source: "plan" } });
  assert.equal(body.annualAcquiredCents, economic.kpis.acquiredCents);
  assert.equal(economic.kpis.coverage, body.annualAcquiredCents / body.annualBudgetCents);
});

test("shared loader: Europe/Rome year bounds and historical extra line totals", async () => {
  let sessionQuery;
  const server = loadModule("../lib/economic-plans-server.ts", {
    "@/lib/datetime": datetime,
    "@/lib/economic-plans": economicPlans,
    "@/lib/supabase/admin": { supabaseAdmin: fakeSupabase((calls) => {
      sessionQuery = calls;
      return { data: [
        { scheduled_at: "2026-03-10T09:00:00.000Z", service_type_id: "famiglia", service_name: "Famiglia", agreed_price_cents: 22000, current_stage: { code: "delivered" }, extras: [{ line_total_cents: 4000 }, { line_total_cents: 1500 }], payments: [{ amount_cents: 10000 }] },
        { scheduled_at: "2026-05-10T09:00:00.000Z", service_type_id: "ritratto", service_name: "Ritratto", agreed_price_cents: 30000, current_stage: { code: "cancelled" }, extras: [], payments: [] },
      ], error: null };
    }) },
  });
  const sessions = await server.loadEconomicSessions(2026);
  assert.deepEqual(sessionQuery.gte, ["scheduled_at", "2025-12-31T23:00:00.000Z"]);
  assert.deepEqual(sessionQuery.lt, ["scheduled_at", "2026-12-31T23:00:00.000Z"]);
  assert.match(sessionQuery.select, /extras:session_extras\(line_total_cents\)/);
  assert.equal(sessions[0].extrasCents, 5500);
  assert.equal(sessions[0].isCancelled, false);
  assert.equal(sessions[1].isCancelled, true);
  const acquired = computeEconomicDashboard({ year: 2026, now: new Date(), plan: null, sessions, payments: [], serviceNames: new Map() }).kpis.acquiredCents;
  assert.equal(acquired, 27500);
});

test("acquired year follows Europe/Rome, not UTC", () => {
  // 31/12 23:30 UTC = 1/1 00:30 a Roma.
  const sessions = [{ scheduledAt: "2026-12-31T23:30:00.000Z", serviceTypeId: "natale", serviceName: "Natale", agreedPriceCents: 13500, extrasCents: 0, paidCents: 0, isCancelled: false }];
  const acquired = (year) => computeEconomicDashboard({ year, now: new Date("2026-10-19T12:00:00Z"), plan: null, sessions, payments: [], serviceNames: new Map() }).kpis.acquiredCents;
  assert.equal(acquired(2026), 0);
  assert.equal(acquired(2027), 13500);
});

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
