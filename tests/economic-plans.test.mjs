import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as datetime from "../lib/datetime.ts";
import * as economicPlans from "../lib/economic-plans.ts";
import {
  calculateSessionCoverage,
  classifyVoucherRedemption,
  computeEconomicDashboard,
  computePlanTotals,
  computeVoucherPlanTotals,
  emptyVoucherSalesPlan,
  isCashPayment,
  isVoucherRedemption,
  paymentDateKey,
  priceListFor,
  ticketAboveListMax,
} from "../lib/economic-plans.ts";

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
        eq(column, value) { calls.eq = [column, value]; return builder; },
        gte(column, value) { calls.gte = [column, value]; return builder; },
        lt(column, value) { calls.lt = [column, value]; return builder; },
        not() { return builder; },
        order() { return builder; },
        limit(value) { calls.limit = value; return builder; },
        range(from, to) { calls.range = [from, to]; return builder; },
        then(onFulfilled, onRejected) { return Promise.resolve(resolve(calls)).then(onFulfilled, onRejected); },
      };
      return builder;
    },
  };
}

/* --- Dati di prova ------------------------------------------------------- */

const NOW = new Date("2026-11-09T12:00:00.000Z");
const months12 = (entries) => Array.from({ length: 12 }, (_, index) => entries[index + 1] ?? 0);

const session = (overrides) => ({
  scheduledAt: "2026-03-10T09:00:00.000Z",
  serviceTypeId: "famiglia",
  serviceName: "Famiglia",
  isAddonService: false,
  agreedPriceCents: 20000,
  extrasCents: 0,
  payments: [],
  isCancelled: false,
  ...overrides,
});
const sessionPayment = (amountCents, category = "full_payment", appliedVoucherId = null) => ({ amountCents, category, appliedVoucherId });
const payment = (overrides) => ({
  amountCents: 20000,
  paidDate: "2026-03-10",
  paidAt: null,
  category: "full_payment",
  methodName: "Wise",
  appliedVoucherId: null,
  voucherId: null,
  sessionId: "s1",
  sessionScheduledAt: "2026-03-10T09:00:00.000Z",
  sessionServiceName: "Famiglia",
  ...overrides,
});
const voucher = (overrides) => ({ id: "v1", status: "redeemed", isComplimentary: false, creditCents: 20000, purchaseDates: ["2025-12-20"], ...overrides });
const run = ({ year = 2026, plan = null, sessions = [], payments = [], vouchers = [] } = {}) =>
  computeEconomicDashboard({ year, now: NOW, plan, sessions, payments, vouchers, serviceNames: new Map() });

// Sessione di settembre coperta interamente da un buono (riscatto registrato nella stessa data).
const septemberRedeemed = (amountCents = 20000, voucherId = "v1") => ({
  session: session({ scheduledAt: "2026-09-15T09:00:00.000Z", agreedPriceCents: amountCents, payments: [sessionPayment(amountCents, "voucher_redemption", voucherId)] }),
  redemption: payment({ amountCents, paidDate: "2026-09-15", category: "voucher_redemption", methodName: "Buono regalo", appliedVoucherId: voucherId, sessionScheduledAt: "2026-09-15T09:00:00.000Z" }),
});

/* --- Casi A-H: valore servizi, cassa, riscatti --------------------------- */

test("A - normal session: value 200, session cash 200, no redemptions", () => {
  const result = run({ sessions: [session({ payments: [sessionPayment(20000)] })], payments: [payment({})] });
  assert.equal(result.services.acquiredCents, 20000);
  assert.equal(result.cash.sessionCashCents, 20000);
  assert.equal(result.cash.totalCents, 20000);
  assert.equal(result.redemptions.totalCents, 0);
  assert.equal(result.receivableCents, 0);
});

test("B - voucher bought in 2025 redeemed in 2026: prior-year redemption, no new cash", () => {
  const { session: redeemed, redemption } = septemberRedeemed();
  const result = run({ sessions: [redeemed], payments: [redemption], vouchers: [voucher({ purchaseDates: ["2025-12-20"] })] });
  assert.equal(result.services.acquiredCents, 20000);
  assert.equal(result.redemptions.totalCents, 20000);
  assert.equal(result.redemptions.priorYearCents, 20000);
  assert.equal(result.cash.totalCents, 0);
  assert.equal(result.cash.sessionCashCents, 0);
  assert.equal(result.monthlyCash[8].redemptionsCents, 20000);
  assert.equal(result.monthlyCash[8].priorYearRedemptionsCents, 20000);
  assert.equal(result.monthlyCash[8].totalCashCents, 0);
});

test("C - voucher bought and redeemed in 2026: 200 cash + 200 service value, never 400 in one number", () => {
  const { session: redeemed, redemption } = septemberRedeemed();
  const sale = payment({ paidDate: "2026-01-10", category: "voucher_purchase", voucherId: "v1", sessionId: null, sessionScheduledAt: null, sessionServiceName: null });
  const result = run({ sessions: [redeemed], payments: [sale, redemption], vouchers: [voucher({ purchaseDates: ["2026-01-10"] })] });
  assert.equal(result.cash.totalCents, 20000);
  assert.equal(result.cash.voucherSalesCents, 20000);
  assert.equal(result.cash.voucherSalesCount, 1);
  assert.equal(result.services.acquiredCents, 20000);
  assert.equal(result.redemptions.sameYearCents, 20000);
  assert.equal(result.redemptions.priorYearCents, 0);
  assert.equal(result.monthlyCash[0].voucherSalesCents, 20000);
});

test("D - voucher plus top-up: value 300, redemption 200, session cash 100, residual 0", () => {
  const mixed = session({ scheduledAt: "2026-09-15T09:00:00.000Z", agreedPriceCents: 30000, payments: [sessionPayment(20000, "voucher_redemption", "v1"), sessionPayment(10000, "balance")] });
  const result = run({
    sessions: [mixed],
    payments: [
      payment({ amountCents: 20000, paidDate: "2026-09-15", category: "voucher_redemption", appliedVoucherId: "v1", sessionScheduledAt: mixed.scheduledAt }),
      payment({ amountCents: 10000, paidDate: "2026-09-15", category: "balance", sessionScheduledAt: mixed.scheduledAt }),
    ],
    vouchers: [voucher({})],
  });
  assert.equal(result.services.acquiredCents, 30000);
  assert.equal(result.redemptions.totalCents, 20000);
  assert.equal(result.redemptions.priorYearCents, 20000);
  assert.equal(result.cash.sessionCashCents, 10000);
  assert.deepEqual(result.coverage, { valueCents: 30000, monetaryCents: 10000, voucherCents: 20000, residualCents: 0 });
});

test("E - complimentary voucher: complimentary redemption, no voucher sale, no cash", () => {
  const { session: redeemed, redemption } = septemberRedeemed(15000, "gift");
  const result = run({ sessions: [redeemed], payments: [redemption], vouchers: [voucher({ id: "gift", isComplimentary: true, creditCents: 15000, purchaseDates: [] })] });
  assert.equal(result.services.acquiredCents, 15000);
  assert.equal(result.redemptions.complimentaryCents, 15000);
  assert.equal(result.cash.voucherSalesCents, 0);
  assert.equal(result.cash.totalCents, 0);
  assert.equal(result.monthlyCash[8].complimentaryRedemptionsCents, 15000);
});

test("F - unused credit: only the applied amount counts as redemption", () => {
  // Buono da 250, sessione da 200: il riscatto registrato e 200 (50 restano come credito non utilizzato).
  const { session: redeemed, redemption } = septemberRedeemed(20000);
  const result = run({ sessions: [redeemed], payments: [redemption], vouchers: [voucher({ creditCents: 25000 })] });
  assert.equal(result.redemptions.totalCents, 20000);
  assert.equal(result.coverage.voucherCents, 20000);
  assert.equal(result.services.acquiredCents, 20000);
});

test("G - future session: future and acquired value, not delivered", () => {
  const result = run({ sessions: [session({ scheduledAt: "2026-12-20T10:00:00.000Z", agreedPriceCents: 25000 })] });
  assert.equal(result.services.futureCents, 25000);
  assert.equal(result.services.acquiredCents, 25000);
  assert.equal(result.services.deliveredCents, 0);
  assert.equal(result.services.futureSessions, 1);
});

test("H - payment on 31 December 23:30 Europe/Rome stays in the Italian year and month", () => {
  // 22:30 UTC = 23:30 a Roma il 31/12; 23:30 UTC = 00:30 del 1/1 a Roma.
  assert.equal(paymentDateKey({ paidDate: null, paidAt: "2026-12-31T22:30:00.000Z" }), "2026-12-31");
  assert.equal(paymentDateKey({ paidDate: null, paidAt: "2026-12-31T23:30:00.000Z" }), "2027-01-01");
  assert.equal(paymentDateKey({ paidDate: "2026-12-31", paidAt: "2026-12-31T23:30:00.000Z" }), "2026-12-31");
  const lateDecember = payment({ paidDate: null, paidAt: "2026-12-31T22:30:00.000Z", amountCents: 5000 });
  const newYear = payment({ paidDate: null, paidAt: "2026-12-31T23:30:00.000Z", amountCents: 7000 });
  const result2026 = run({ payments: [lateDecember, newYear] });
  assert.equal(result2026.cash.totalCents, 5000);
  assert.equal(result2026.monthlyCash[11].sessionCashCents, 5000);
  assert.equal(run({ year: 2027, payments: [lateDecember, newYear] }).monthlyCash[0].sessionCashCents, 7000);
  // Anche le sessioni seguono Europe/Rome.
  const newYearSession = session({ scheduledAt: "2026-12-31T23:30:00.000Z" });
  assert.equal(run({ sessions: [newYearSession] }).services.acquiredCents, 0);
  assert.equal(run({ year: 2027, sessions: [newYearSession] }).services.acquiredCents, 20000);
});

/* --- Classificazione riscatti e dati anomali ----------------------------- */

test("redemption classification: same-year, prior-year, complimentary, unknown for anomalous data", () => {
  const sessionDate = "2026-09-15";
  const origin = (purchaseDates, isComplimentary = false) => ({ isComplimentary, purchaseDates });
  assert.equal(classifyVoucherRedemption({ sessionDate, voucher: origin(["2025-12-20"]) }), "prior_year");
  assert.equal(classifyVoucherRedemption({ sessionDate, voucher: origin(["2026-01-10"]) }), "same_year");
  assert.equal(classifyVoucherRedemption({ sessionDate, voucher: origin(["2026-01-10", "2026-02-10"]) }), "same_year");
  assert.equal(classifyVoucherRedemption({ sessionDate, voucher: origin([], true) }), "complimentary");
  assert.equal(classifyVoucherRedemption({ sessionDate, voucher: null }), "unknown"); // riscatto senza buono
  assert.equal(classifyVoucherRedemption({ sessionDate, voucher: origin([]) }), "unknown"); // nessun pagamento di acquisto
  assert.equal(classifyVoucherRedemption({ sessionDate, voucher: origin([null]) }), "unknown"); // data mancante
  assert.equal(classifyVoucherRedemption({ sessionDate, voucher: origin(["2026-10-01"]) }), "unknown"); // acquisto dopo la sessione
  assert.equal(classifyVoucherRedemption({ sessionDate, voucher: origin(["2025-12-20", "2026-01-05"]) }), "unknown"); // pagato a cavallo d'anno
  assert.equal(classifyVoucherRedemption({ sessionDate: null, voucher: origin(["2025-12-20"]) }), "unknown");
});

test("anomalous vouchers do not crash and are reported as unclassified, never corrected", () => {
  const { session: redeemed, redemption } = septemberRedeemed(20000, "missing");
  const result = run({ sessions: [redeemed], payments: [redemption], vouchers: [] });
  assert.equal(result.redemptions.totalCents, 20000);
  assert.equal(result.redemptions.unknownCents, 20000);
  assert.equal(result.redemptions.unknownCount, 1);
  assert.equal(result.redemptions.priorYearCents + result.redemptions.sameYearCents + result.redemptions.complimentaryCents, 0);
});

test("active vouchers to deliver: nominal credit of active vouchers only (complimentary included)", () => {
  const result = run({ vouchers: [voucher({ id: "a", status: "active", creditCents: 15000 }), voucher({ id: "b", status: "active", isComplimentary: true, creditCents: 5000 }), voucher({ id: "c", status: "redeemed" }), voucher({ id: "d", status: "expired" })] });
  assert.deepEqual(result.activeVouchers, { count: 2, creditCents: 20000 });
});

/* --- Riconciliazione e cassa --------------------------------------------- */

test("reconciliation: session value = monetary coverage + redemptions + residual, to the cent", () => {
  const cases = [
    session({ agreedPriceCents: 20000, extrasCents: 4500, payments: [sessionPayment(10000, "deposit")] }),
    session({ agreedPriceCents: 18000, extrasCents: 7000, payments: [sessionPayment(20000, "voucher_redemption", "v1"), sessionPayment(5000, "balance")] }),
    session({ agreedPriceCents: 30000, payments: [sessionPayment(20000, "voucher_redemption", "v1")] }),
    session({ agreedPriceCents: 0, payments: [] }),
    session({ agreedPriceCents: 13599, extrasCents: 1, payments: [sessionPayment(4000, "deposit"), sessionPayment(9600, "balance")] }),
  ];
  for (const entry of cases) {
    const coverage = calculateSessionCoverage(entry);
    assert.equal(coverage.valueCents, coverage.monetaryCents + coverage.voucherCents + coverage.residualCents);
  }
  // Extra pagati durante una sessione con buono: 180 + 70 extra, buono 200, integrazione 50.
  assert.deepEqual(calculateSessionCoverage(cases[1]), { valueCents: 25000, monetaryCents: 5000, voucherCents: 20000, residualCents: 0 });
  const result = run({ sessions: cases });
  assert.equal(result.coverage.valueCents, result.coverage.monetaryCents + result.coverage.voucherCents + result.coverage.residualCents);
  assert.equal(result.receivableCents, result.coverage.residualCents);
});

test("cash = sum of monetary payments of the year: voucher sales included, redemptions excluded by category, not by method name", () => {
  assert.equal(isVoucherRedemption({ category: "voucher_redemption", appliedVoucherId: null }), true);
  assert.equal(isVoucherRedemption({ category: "balance", appliedVoucherId: "v1" }), true);
  assert.equal(isCashPayment({ category: "voucher_purchase", appliedVoucherId: null }), true);
  const payments = [
    payment({ amountCents: 10000, category: "deposit" }),
    payment({ amountCents: 15000, category: "voucher_purchase", methodName: "Buono regalo", sessionId: null, voucherId: "v9" }),
    payment({ amountCents: 23500, category: "voucher_redemption", methodName: "Carta regalo rinominata", appliedVoucherId: "v1" }),
    payment({ amountCents: 9999, paidDate: "2025-12-31" }),
  ];
  const result = run({ payments });
  assert.equal(result.cash.totalCents, 25000);
  assert.equal(result.cash.totalCents, result.cash.sessionCashCents + result.cash.voucherSalesCents);
  assert.equal(result.monthlyCash.reduce((sum, month) => sum + month.totalCashCents, 0), result.cash.totalCents);
});

test("legacy add-on sessions (e.g. Provini Extra) are excluded from session counts but stay reconcilable", () => {
  const result = run({ sessions: [session({}), session({ serviceTypeId: "provini", serviceName: "Provini Extra", isAddonService: true, agreedPriceCents: 6400, payments: [sessionPayment(6400)] })] });
  assert.equal(result.services.acquiredCents, 20000);
  assert.equal(result.services.deliveredSessions, 1);
  assert.equal(result.services.averageTicketCents, 20000);
  assert.deepEqual(result.legacyAddon, { sessions: 1, valueCents: 6400 });
  assert.equal(result.coverage.valueCents, 26400);
  assert.ok(result.serviceRows.every((row) => row.serviceTypeId !== "provini"));
});

test("a year can have more service value than new cash (prior-year redemptions) and more cash than value (voucher sales)", () => {
  const { session: redeemed, redemption } = septemberRedeemed();
  const workYear = run({ sessions: [redeemed], payments: [redemption], vouchers: [voucher({})] });
  assert.ok(workYear.services.acquiredCents > workYear.cash.totalCents);
  const salesYear = run({ payments: [payment({ amountCents: 50000, category: "voucher_purchase", voucherId: "v2", sessionId: null })] });
  assert.ok(salesYear.cash.totalCents > salesYear.services.acquiredCents);
});

/* --- Piano servizi e piano buoni (casi J, K) ----------------------------- */

const famiglia = { serviceTypeId: "famiglia", plannedTicketCents: 24000, monthlySessions: months12({ 3: 3, 4: 3, 5: 3, 9: 3, 10: 3 }) };

test("J - service plan: 3+3+3+3+3 sessions at 240 EUR = 15 sessions, 3.600 EUR, no manual target", () => {
  const totals = computePlanTotals([famiglia]);
  assert.equal(totals.totalSessions, 15);
  assert.equal(totals.totalValueCents, 360000);
  assert.equal(totals.monthlyValueCents.reduce((sum, value) => sum + value, 0), totals.totalValueCents);
  assert.equal(totals.averageTicketCents, 24000);
  assert.equal(computePlanTotals([]).averageTicketCents, null);
});

test("K - voucher plan: 8 vouchers in December at 150 EUR = 1.200 EUR, kept separate from service value", () => {
  const voucherPlan = { plannedTicketCents: 15000, monthlyCounts: months12({ 12: 8 }) };
  const totals = computeVoucherPlanTotals(voucherPlan);
  assert.equal(totals.totalCount, 8);
  assert.equal(totals.totalValueCents, 120000);
  assert.equal(totals.monthlyValueCents[11], 120000);
  assert.equal(totals.monthlyValueCents.reduce((sum, value) => sum + value, 0), totals.totalValueCents);
  const result = run({ plan: { year: 2026, notes: null, services: [famiglia], voucherPlan } });
  assert.equal(result.plan.serviceValueCents, 360000);
  assert.equal(result.plan.voucherSalesValueCents, 120000);
  assert.equal(result.services.plannedValueCents, 360000);
  assert.equal(result.monthlyCash[11].plannedVoucherSalesCents, 120000);
  assert.equal(computeVoucherPlanTotals(emptyVoucherSalesPlan()).totalValueCents, 0);
});

test("service performance by month: plan coverage uses service value, never cash", () => {
  const voucherPlan = emptyVoucherSalesPlan();
  const plan = { year: 2026, notes: null, services: [famiglia], voucherPlan };
  const result = run({
    plan,
    sessions: [session({ agreedPriceCents: 25000, payments: [sessionPayment(25000)] })],
    payments: [payment({ amountCents: 25000 }), payment({ amountCents: 90000, category: "voucher_purchase", voucherId: "v3", sessionId: null })],
  });
  assert.equal(result.monthlyServices[2].plannedValueCents, 72000);
  assert.equal(result.monthlyServices[2].acquiredCents, 25000);
  assert.equal(result.monthlyServices[2].gapCents, 25000 - 72000);
  assert.equal(result.services.coverage, 25000 / 360000);
  assert.equal(result.services.toGenerateCents, 360000 - 25000);
  assert.equal(result.serviceRows[0].plannedSessions, 15);
});

test("year without plan: real values only, no planned value or coverage", () => {
  const result = run({ sessions: [session({})] });
  assert.equal(result.hasPlan, false);
  assert.equal(result.services.plannedValueCents, null);
  assert.equal(result.services.coverage, null);
  assert.equal(result.plan.voucherSalesValueCents, null);
  assert.equal(result.monthlyServices[0].plannedValueCents, null);
  assert.equal(result.monthlyCash[0].plannedVoucherSalesCents, null);
  assert.equal(result.services.acquiredCents, 20000);
});

test("current price list is reference only: active packages range, none for services without packages, warning above max", () => {
  const packages = [
    { serviceTypeId: "famiglia", name: "Momenti", priceCents: 17000 },
    { serviceTypeId: "famiglia", name: "Collezione", priceCents: 39000 },
  ];
  const famigliaPrices = priceListFor("famiglia", packages);
  assert.equal(famigliaPrices.minCents, 17000);
  assert.equal(famigliaPrices.maxCents, 39000);
  assert.equal(priceListFor("battesimo", packages), null);
  assert.equal(ticketAboveListMax(39000, famigliaPrices), false);
  assert.equal(ticketAboveListMax(45000, famigliaPrices), true);
  assert.equal(ticketAboveListMax(999999, null), false);
});

test("current price list includes Saturday surcharge in the maximum, keeping the base minimum", () => {
  const packages = [
    { serviceTypeId: "autunno", name: "Mini Sessione Autunno", priceCents: 11500, saturdaySurchargeCents: 2000 },
    { serviceTypeId: "ritratto", name: "Base", priceCents: 16000, saturdaySurchargeCents: 2000 },
    { serviceTypeId: "ritratto", name: "Completo", priceCents: 30000, saturdaySurchargeCents: 2000 },
    { serviceTypeId: "senza-supplemento", name: "Base", priceCents: 10000, saturdaySurchargeCents: 0 },
  ];
  const autunno = priceListFor("autunno", packages);
  assert.equal(autunno.minCents, 11500);
  assert.equal(autunno.maxCents, 13500);
  assert.equal(ticketAboveListMax(12500, autunno), false);
  const ritratto = priceListFor("ritratto", packages);
  assert.equal(ritratto.minCents, 16000);
  assert.equal(ritratto.maxCents, 32000);
  assert.equal(ticketAboveListMax(32000, ritratto), false);
  assert.equal(ticketAboveListMax(32001, ritratto), true);
  const noSurcharge = priceListFor("senza-supplemento", packages);
  assert.equal(noSurcharge.minCents, 10000);
  assert.equal(noSurcharge.maxCents, 10000);
});

/* --- Home vs Economico (caso I) ------------------------------------------ */

const homeDataset = () => {
  const { session: redeemed, redemption } = septemberRedeemed();
  return {
    sessions: [
      session({ agreedPriceCents: 20000, extrasCents: 4000, payments: [sessionPayment(10000, "deposit")] }),
      session({ scheduledAt: "2026-12-10T09:00:00.000Z", serviceTypeId: "maternita", serviceName: "Maternità", agreedPriceCents: 30000 }),
      session({ scheduledAt: "2026-05-10T09:00:00.000Z", serviceTypeId: "ritratto", agreedPriceCents: 30000, isCancelled: true }),
      redeemed,
    ],
    payments: [
      payment({ amountCents: 10000, paidDate: "2026-03-01", category: "deposit" }),
      payment({ amountCents: 15000, paidDate: "2026-04-01", category: "voucher_purchase", voucherId: "v7", sessionId: null, sessionServiceName: null }),
      redemption,
    ],
    vouchers: [voucher({})],
  };
};

async function callHomeAnalytics(plan) {
  const route = loadModule("../app/api/dashboard/analytics/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } },
    "@/lib/economic-plans": economicPlans,
    "@/lib/datetime": datetime,
    "@/lib/economic-plans-server": {
      parseYear: (value) => (Number(value) >= 2000 ? Number(value) : null),
      loadEconomicDataset: async () => homeDataset(),
      loadPlan: async () => (plan ? { id: "p", plan } : null),
    },
    "@/lib/supabase/admin": { supabaseAdmin: fakeSupabase(() => ({ data: [{ paid_date: "2025-01-10" }], error: null })) },
  });
  return route.GET({ nextUrl: { searchParams: new URLSearchParams("year=2026") } });
}

test("I - Home and Economico agree on acquired service value and cash for the same dataset", async () => {
  const plan = { year: 2026, notes: null, services: [famiglia], voucherPlan: emptyVoucherSalesPlan() };
  const { status, body } = await callHomeAnalytics(plan);
  const economic = computeEconomicDashboard({ year: 2026, now: new Date(), plan, ...homeDataset(), serviceNames: new Map() });
  assert.equal(status, 200);
  assert.equal(body.acquiredServiceValueCents, economic.services.acquiredCents);
  assert.equal(body.cashTotalCents, economic.cash.totalCents);
  // 240 (marzo) + 300 (dicembre) + 200 (settembre, coperta da buono); annullata esclusa.
  assert.equal(body.acquiredServiceValueCents, 24000 + 30000 + 20000);
  // Cassa: caparra + vendita buono; il riscatto non e cassa.
  assert.equal(body.cashTotalCents, 25000);
  assert.equal(body.byMonth.reduce((sum, month) => sum + month.total_cents, 0), body.cashTotalCents);
  assert.ok(body.byServiceType.some((row) => row.label === "Vendite buoni regalo" && row.total_cents === 15000));
  assert.ok(!body.byMethod.some((row) => row.label === "Buono regalo"));
});

test("Home gauge compares service value with the plan only; no legacy budget fallback without a plan", async () => {
  const withPlan = await callHomeAnalytics({ year: 2026, notes: null, services: [famiglia], voucherPlan: emptyVoucherSalesPlan() });
  assert.equal(withPlan.body.plannedServiceValueCents, 360000);
  const withoutPlan = await callHomeAnalytics(null);
  assert.equal(withoutPlan.body.plannedServiceValueCents, null);
  assert.equal(withoutPlan.body.acquiredServiceValueCents, withPlan.body.acquiredServiceValueCents);
});

/* --- Loader e salvataggio piano ------------------------------------------ */

test("shared loaders: Europe/Rome year bounds, add-on flag, structured payments, voucher purchase dates", async () => {
  const queries = {};
  const server = loadModule("../lib/economic-plans-server.ts", {
    "@/lib/datetime": datetime,
    "@/lib/economic-plans": economicPlans,
    "@/lib/supabase/admin": { supabaseAdmin: fakeSupabase((calls) => {
      queries[calls.table] = calls;
      if (calls.table === "sessions") return { data: [
        { scheduled_at: "2026-03-10T09:00:00.000Z", service_type_id: "famiglia", service_name: "Famiglia", agreed_price_cents: 22000, current_stage: { code: "delivered" }, service: { is_addon: false }, extras: [{ line_total_cents: 4000 }, { line_total_cents: 1500 }], payments: [{ amount_cents: 10000, category: "deposit", applied_voucher_id: null }] },
        { scheduled_at: "2026-05-10T09:00:00.000Z", service_type_id: "provini", service_name: "Provini Extra", agreed_price_cents: 6400, current_stage: { code: "cancelled" }, service: { is_addon: true }, extras: [], payments: [] },
      ], error: null };
      if (calls.table === "gift_vouchers") return { data: [
        { id: "v1", status: "redeemed", is_complimentary: false, voucher_type: "value", value_cents: 20000, purchase_price_cents: 20000, purchases: [{ paid_date: "2025-12-20", paid_at: "2025-12-20T10:00:00Z", category: "voucher_purchase" }] },
        { id: "v2", status: "active", is_complimentary: false, voucher_type: "service", value_cents: null, purchase_price_cents: 24000, purchases: [{ paid_date: null, paid_at: "2026-12-31T23:30:00Z", category: "voucher_purchase" }] },
      ], error: null };
      return { data: [], error: null };
    }) },
  });
  const sessions = await server.loadEconomicSessions(2026);
  assert.deepEqual(queries.sessions.gte, ["scheduled_at", "2025-12-31T23:00:00.000Z"]);
  assert.deepEqual(queries.sessions.lt, ["scheduled_at", "2026-12-31T23:00:00.000Z"]);
  assert.match(queries.sessions.select, /service:service_types\(is_addon\)/);
  assert.equal(sessions[0].extrasCents, 5500);
  assert.equal(JSON.stringify(sessions[0].payments), JSON.stringify([{ amountCents: 10000, category: "deposit", appliedVoucherId: null }]));
  assert.equal(sessions[1].isAddonService, true);
  assert.equal(sessions[1].isCancelled, true);

  await server.loadEconomicPayments(2026);
  assert.deepEqual(queries.payments.gte, ["paid_date", "2026-01-01"]);
  assert.deepEqual(queries.payments.lt, ["paid_date", "2027-01-01"]);

  const vouchers = await server.loadEconomicVouchers();
  assert.equal(JSON.stringify(vouchers[0].purchaseDates), JSON.stringify(["2025-12-20"]));
  assert.equal(vouchers[1].creditCents, 24000);
  assert.equal(JSON.stringify(vouchers[1].purchaseDates), JSON.stringify(["2027-01-01"]));
});

test("active package loader includes the service Saturday surcharge in the displayed price range", async () => {
  let query;
  const server = loadModule("../lib/economic-plans-server.ts", {
    "@/lib/datetime": datetime,
    "@/lib/economic-plans": economicPlans,
    "@/lib/supabase/admin": { supabaseAdmin: fakeSupabase((calls) => {
      query = calls;
      return { data: [
        { service_type_id: "autunno", name: "Mini Sessione Autunno", price_cents: 11500, service: { saturday_surcharge_cents: 2000 } },
        { service_type_id: "ritratto", name: "Completo", price_cents: 30000, service: [{ saturday_surcharge_cents: 2000 }] },
        { service_type_id: "senza-supplemento", name: "Base", price_cents: 10000, service: { saturday_surcharge_cents: 0 } },
      ], error: null };
    }) },
  });
  const packages = await server.loadActivePackages();
  assert.equal(query.table, "session_packages");
  assert.match(query.select, /service:service_types\(saturday_surcharge_cents\)/);
  assert.deepEqual(query.eq, ["is_active", true]);
  assert.equal(packages[0].saturdaySurchargeCents, 2000);
  assert.equal(priceListFor("autunno", packages).maxCents, 13500);
  assert.equal(packages[1].saturdaySurchargeCents, 2000);
  assert.equal(priceListFor("ritratto", packages).maxCents, 32000);
  assert.equal(packages[2].saturdaySurchargeCents, 0);
});

test("plan payload: only canonical data (services, tickets, monthly quantities, voucher plan) is accepted", async () => {
  const server = loadModule("../lib/economic-plans-server.ts", {
    "@/lib/datetime": datetime,
    "@/lib/economic-plans": economicPlans,
    "@/lib/supabase/admin": { supabaseAdmin: fakeSupabase(() => ({ data: [], error: null })) },
  });
  const voucherPlan = { plannedTicketCents: 15000, monthlyCounts: months12({ 12: 8 }) };
  const parsed = await server.parsePlanPayload({ notes: "  ", annualTargetCents: 999, expectedUpliftCents: 5, services: [], voucherPlan: { ...voucherPlan, totalValueCents: 1 } });
  assert.equal(JSON.stringify(parsed), JSON.stringify({ notes: null, services: [], voucherPlan }));
  const service = (monthlySessions, plannedTicketCents = 24000) => ({ notes: null, services: [{ serviceTypeId: "famiglia", plannedTicketCents, monthlySessions }], voucherPlan });
  assert.equal(typeof await server.parsePlanPayload(service([1.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])), "string");
  assert.equal(typeof await server.parsePlanPayload(service([-1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])), "string");
  assert.equal(typeof await server.parsePlanPayload(service([1, 2, 3])), "string");
  assert.equal(typeof await server.parsePlanPayload(service(Array(12).fill(0), 24000.5)), "string");
  assert.equal(typeof await server.parsePlanPayload({ notes: null, services: [], voucherPlan: { plannedTicketCents: 15000, monthlyCounts: [1, 2] } }), "string");
  assert.equal(typeof await server.parsePlanPayload({ notes: null, services: [], voucherPlan: { plannedTicketCents: 15000, monthlyCounts: months12({ 1: -2 }) } }), "string");
  assert.equal(typeof await server.parsePlanPayload({ notes: null, services: [] }), "string");
  assert.equal(JSON.stringify(server.EMPTY_PLAN_PAYLOAD), JSON.stringify({ notes: null, services: [], voucherPlan: emptyVoucherSalesPlan() }));
});
