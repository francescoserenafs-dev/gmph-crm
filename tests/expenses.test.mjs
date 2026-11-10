import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as datetime from "../lib/datetime.ts";
import * as economics from "../lib/economic-plans.ts";

const source = readFileSync(new URL("../lib/expenses.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const context = { exports: {}, require: (name) => { if (name === "@/lib/datetime") return datetime; if (name === "@/lib/economic-plans") return economics; throw new Error(name); } };
runInNewContext(compiled, context);
const { calculateSessionDirectCost, calculateSessionDirectMargin, computeCostAnalytics, recurringDatesDue, nextRecurringOccurrence, parseExpenseValues, validateExpenseReferences, parseRecurringSchedule, validExpenseDate } = context.exports;
const session = (patch = {}) => ({ scheduledAt: "2027-01-15T10:00:00Z", serviceTypeId: "service", serviceName: "Famiglia", isAddonService: false, agreedPriceCents: 25000, extrasCents: 0, payments: [], isCancelled: false, extraCosts: [], inclusionCosts: [], ...patch });
const expense = (patch = {}) => ({ id: "expense", description: "Costo", expense_category_id: "cat", category_name_snapshot: "Software", category_kind_snapshot: "operating", category_is_marketing_snapshot: false, paid_date: "2027-01-10", net_amount_cents: 10000, vat_amount_cents: 2200, marketing_service_type_id: null, marketing_campaign_year: null, ...patch });
const analytics = (patch = {}) => computeCostAnalytics({ year: 2027, now: new Date("2027-03-10T12:00:00Z"), sessions: [], payments: [], expenses: [], ...patch });
const schedule = (patch = {}) => ({ start_date: "2027-01-01", end_date: null, frequency: "monthly", is_active: true, processed_through: null, ...patch });

test("100 EUR net plus 22 VAT costs 122; VAT is not deducted", () => {
  const result = analytics({ expenses: [expense()] });
  assert.equal(result.operatingCostsCents, 12200); assert.equal(result.vatCents, 2200); assert.equal(result.totalManagementCostsCents, 12200);
});
test("taxes are separate from operating expenses", () => {
  const result = analytics({ expenses: [expense({ category_kind_snapshot: "tax_contribution", net_amount_cents: 50000, vat_amount_cents: 0 })] });
  assert.equal(result.operatingCostsCents, 0); assert.equal(result.taxContributionCostsCents, 50000); assert.equal(result.totalManagementCostsCents, 50000); assert.equal(result.operatingResultCents, 0); assert.equal(result.finalResultCents, -50000);
});
test("sold extras use historical line total and snapshot cost", () => {
  const result = calculateSessionDirectMargin(session({ extrasCents: 4000, extraCosts: [{ quantity: 1, unitCostCents: 500 }] }));
  assert.equal(result.valueCents, 29000); assert.equal(result.knownCostCents, 500); assert.equal(result.marginCents, 28500);
});
test("package inclusions and sold extras count once, never generate expenses", () => {
  const row = session({ agreedPriceCents: 30000, inclusionCosts: [{ quantity: 1, unitCostCents: 3000 }, { quantity: 1, unitCostCents: 500 }] });
  assert.equal(calculateSessionDirectMargin(row).marginCents, 26500);
  assert.equal(calculateSessionDirectCost({ ...row, extraCosts: [{ quantity: 1, unitCostCents: 500 }] }).knownCostCents, 4000);
  const result = analytics({ sessions: [row] });
  assert.equal(result.operatingCostsCents, 0); assert.equal(result.directCostsKnownCents, 3500); assert.equal(result.totalManagementCostsCents, 3500);
});
test("unknown costs are incomplete, known zero is complete, quantities multiply", () => {
  const result = calculateSessionDirectCost({ inclusionCosts: [{ quantity: 3, unitCostCents: null }, { quantity: 2, unitCostCents: 0 }, { quantity: 3, unitCostCents: 500 }] });
  assert.equal(result.knownCostCents, 1500); assert.equal(result.missingCostItems, 1); assert.equal(result.totalCostItems, 3); assert.equal(result.isComplete, false);
  assert.equal(calculateSessionDirectCost({ extraCosts: [{ quantity: 1, unitCostCents: 0 }] }).isComplete, true);
  assert.equal(calculateSessionDirectMargin(session({ agreedPriceCents: 0 })).marginRate, null);
});
test("annual hosting is paid entirely in January", () => {
  const result = analytics({ expenses: [expense({ net_amount_cents: 24000, vat_amount_cents: 0 })] });
  assert.equal(result.monthlyCosts[0].operatingCostsCents, 24000);
  assert.ok(result.monthlyCosts.slice(1).every(row => row.totalPaidCents === 0));
});
test("campaign marketing attributed to service/year, generic marketing stays unallocated", () => {
  const campaign = expense({ category_is_marketing_snapshot: true, marketing_service_type_id: "service", marketing_campaign_year: 2027, net_amount_cents: 50000, vat_amount_cents: 0 });
  const result = analytics({ sessions: [session({ agreedPriceCents: 400000, extraCosts: [{ quantity: 1, unitCostCents: 30000 }] })], expenses: [campaign, expense({ category_is_marketing_snapshot: true, net_amount_cents: 10000, vat_amount_cents: 0 })] });
  assert.equal(result.operatingCostsCents, 60000); assert.equal(result.campaignMargins[0].marketingCents, 50000); assert.equal(result.campaignMargins[0].resultCents, 320000); assert.equal(result.campaignMargins[0].marginRate, 0.8);
});
test("campaign year can differ from payment year without changing paid totals", () => {
  const result = analytics({ expenses: [expense({ paid_date: "2026-12-01", category_is_marketing_snapshot: true, marketing_service_type_id: "service", marketing_campaign_year: 2027 })] });
  assert.equal(result.operatingCostsCents, 0); assert.equal(result.campaignMargins[0].marketingCents, 12200); assert.equal(result.campaignMargins[0].marginRate, null);
});
test("general costs never allocate to services; operating and final results remain distinct", () => {
  const result = analytics({ sessions: [session({ agreedPriceCents: 1000000, extraCosts: [{ quantity: 1, unitCostCents: 50000 }] })], expenses: [expense({ net_amount_cents: 200000, vat_amount_cents: 0 }), expense({ category_kind_snapshot: "tax_contribution", net_amount_cents: 100000, vat_amount_cents: 0 })] });
  assert.equal(result.directMarginCents, 950000); assert.equal(result.operatingResultCents, 750000); assert.equal(result.finalResultCents, 650000); assert.equal(result.serviceMargins[0].directMarginCents, 950000);
});
test("cash excludes redemptions and does not subtract direct costs twice", () => {
  const payment = { amountCents: 20000, category: "voucher_purchase", appliedVoucherId: null, paidDate: "2027-01-01", paidAt: null };
  const result = analytics({ sessions: [session({ extraCosts: [{ quantity: 1, unitCostCents: 5000 }] })], expenses: [expense()], payments: [payment, { ...payment, category: "voucher_redemption", appliedVoucherId: "voucher" }] });
  assert.equal(result.cashCents, 20000); assert.equal(result.cashBalanceCents, 7800);
});
test("cancelled and addon sessions excluded; future costs remain separate", () => {
  const extraCosts = [{ quantity: 1, unitCostCents: 500 }];
  const result = analytics({ sessions: [session({ isCancelled: true, extraCosts }), session({ isAddonService: true, extraCosts }), session({ scheduledAt: "2027-12-01T10:00:00Z", extraCosts })] });
  assert.equal(result.deliveredValueCents, 0); assert.equal(result.directCostsKnownCents, 0); assert.equal(result.future.directCostsKnownCents, 500); assert.equal(result.serviceMargins[0].sessions, 0);
});
test("Rome dates, not server timezone, assign costs and service years", () => {
  const result = analytics({ now: new Date("2028-01-01T10:00:00Z"), expenses: [expense({ paid_date: "2027-12-31" })], sessions: [session({ scheduledAt: "2026-12-31T23:30:00Z" }), session({ scheduledAt: "2027-12-31T23:30:00Z" })] });
  assert.equal(result.monthlyCosts[11].totalPaidCents, 12200); assert.equal(result.monthlyCosts[0].deliveredValueCents, 25000); assert.equal(result.deliveredValueCents, 25000);
});
test("monthly recurrence only produces dates already due, with persistent idempotency cursor", () => {
  const dates = recurringDatesDue(schedule(), "2027-03-10");
  assert.deepEqual(Array.from(dates), ["2027-01-01", "2027-02-01", "2027-03-01"]);
  assert.equal(recurringDatesDue(schedule({ processed_through: "2027-03-10" }), "2027-03-10").length, 0);
  assert.equal(recurringDatesDue(schedule({ is_active: false }), "2027-03-10").length, 0);
});
test("recurrence dates stay anchored after February, support quarterly and leap year", () => {
  assert.deepEqual(Array.from(recurringDatesDue(schedule({ start_date: "2027-01-31" }), "2027-03-31")), ["2027-01-31", "2027-02-28", "2027-03-31"]);
  assert.deepEqual(Array.from(recurringDatesDue(schedule({ start_date: "2027-01-31", frequency: "quarterly" }), "2027-08-01")), ["2027-01-31", "2027-04-30", "2027-07-31"]);
  assert.deepEqual(Array.from(recurringDatesDue(schedule({ start_date: "2024-02-29", frequency: "yearly", end_date: "2026-02-28" }), "2027-12-01")), ["2024-02-29", "2025-02-28", "2026-02-28"]);
  assert.equal(nextRecurringOccurrence(schedule({ start_date: "2027-01-31" }), "2027-02-28"), "2027-03-31");
  assert.equal(nextRecurringOccurrence(schedule({ end_date: "2027-03-01" }), "2027-03-10"), null);
});

const categoryId = "00000000-0000-0000-0000-000000000001";
const methodId = "00000000-0000-0000-0000-000000000002";
const validInput = { description: "Adobe", expense_category_id: categoryId, net_amount_cents: 10000, vat_amount_cents: 2200, payment_method_id: methodId };
test("expense payload rejects invalid amounts, zero totals, bad dates and long notes", () => {
  assert.equal(typeof parseExpenseValues(validInput), "object");
  for (const patch of [{ description: " " }, { net_amount_cents: -1 }, { vat_amount_cents: -1 }, { net_amount_cents: 1.5 }, { net_amount_cents: "100" }, { net_amount_cents: 0, vat_amount_cents: 0 }, { net_amount_cents: 1000000000 }, { notes: "x".repeat(2001) }]) assert.equal(typeof parseExpenseValues({ ...validInput, ...patch }), "string");
  assert.equal(validExpenseDate("2027-02-29"), false); assert.equal(validExpenseDate("2028-02-29"), true); assert.equal(validExpenseDate("2027-12-31T23:00Z"), false);
  assert.equal(typeof parseRecurringSchedule({ start_date: "2027-01-01", frequency: "daily" }), "string");
  assert.equal(typeof parseRecurringSchedule({ start_date: "2027-01-01", end_date: "2026-12-31", frequency: "monthly" }), "string");
});
test("reference validation rejects disabled categories, gift voucher methods and non-marketing attribution", () => {
  const options = { categories: [{ id: categoryId, kind: "operating", is_active: true, is_marketing: false }], methods: [{ id: methodId, is_active: true, is_system: false }], services: [] };
  const values = parseExpenseValues(validInput);
  assert.equal(validateExpenseReferences(values, options), null);
  assert.ok(validateExpenseReferences(values, { ...options, categories: [{ ...options.categories[0], is_active: false }] }));
  assert.ok(validateExpenseReferences(values, { ...options, methods: [{ ...options.methods[0], is_system: true }] }));
  assert.ok(validateExpenseReferences({ ...values, marketing_service_type_id: "service", marketing_campaign_year: 2027 }, options));
});