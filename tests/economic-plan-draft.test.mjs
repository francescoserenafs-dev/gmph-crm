import assert from "node:assert/strict";
import test from "node:test";
import { buildPlanServices, computePlanTotals } from "../lib/economic-plans.ts";
import { addDraftService, centsToEuroInput, draftToServices, draftToVoucherPlan, euroToCents, removeDraftService, servicesToDraft, toSessions, updateDraftService, updateDraftServiceMonth, voucherPlanToDraft } from "../lib/economic-plan-draft.ts";

const battesimo = { serviceTypeId: "battesimo", ticket: "350", monthlySessions: Array(12).fill("0") };

test("adding a service: appears once with ticket 0 and 12 months at 0, in every computed table", () => {
  const services = addDraftService([battesimo], "smash");
  assert.deepEqual(services.map((row) => row.serviceTypeId), ["battesimo", "smash"]);
  assert.deepEqual(services[1], { serviceTypeId: "smash", ticket: "0", monthlySessions: Array(12).fill("0") });
  assert.equal(addDraftService(services, "smash").length, 2);
  const totals = computePlanTotals(draftToServices(services));
  assert.deepEqual(totals.services.map((row) => row.serviceTypeId), ["battesimo", "smash"]);
  assert.equal(totals.totalValueCents, 0);
});

test("monthly sessions are the only session source: service total follows the months", () => {
  let services = updateDraftService(addDraftService([], "smash"), "smash", { ticket: "150" });
  services = updateDraftServiceMonth(services, "smash", 0, "1");
  services = updateDraftServiceMonth(services, "smash", 1, "2");
  services = updateDraftServiceMonth(services, "smash", 2, "2");
  const totals = computePlanTotals(draftToServices(services));
  assert.equal(totals.services[0].sessions, 5);
  assert.equal(totals.services[0].valueCents, 75000);
  assert.deepEqual(totals.monthlyValueCents.slice(0, 3), [15000, 30000, 30000]);
});

test("removing a service excludes it and its distribution from totals", () => {
  const withSmash = updateDraftServiceMonth(updateDraftService(addDraftService([battesimo], "smash"), "smash", { ticket: "150" }), "smash", 4, "3");
  const services = removeDraftService(withSmash, "smash");
  assert.deepEqual(services.map((row) => row.serviceTypeId), ["battesimo"]);
  assert.equal(computePlanTotals(draftToServices(services)).totalValueCents, 0);
});

test("euro amounts convert to integer cents without floating point errors", () => {
  assert.equal(euroToCents("240"), 24000);
  assert.equal(euroToCents("0.29"), 29);
  assert.equal(euroToCents("19,99"), 1999);
  assert.equal(euroToCents("1.1"), 110);
  assert.equal(euroToCents(""), 0);
  assert.equal(euroToCents("abc"), 0);
  assert.equal(centsToEuroInput(24000), "240");
  assert.equal(centsToEuroInput(1999), "19.99");
  assert.equal(centsToEuroInput(5), "0.05");
  // 3 x 0,10 + ... resta esatto in centesimi.
  assert.equal(computePlanTotals([{ serviceTypeId: "x", plannedTicketCents: euroToCents("0.10"), monthlySessions: [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }]).totalValueCents, 30);
});

test("sessions accept only integers >= 0", () => {
  assert.equal(toSessions("3"), 3);
  assert.equal(toSessions(""), 0);
  assert.equal(toSessions("-2"), 0);
  assert.equal(toSessions("1.5"), 0);
});

test("loading: missing months become 0, orphan monthly rows are ignored, draft round-trips", () => {
  const services = buildPlanServices(
    [
      { service_type_id: "famiglia", planned_ticket_cents: 24000 },
      { service_type_id: "battesimo", planned_ticket_cents: 35000 },
    ],
    [
      { service_type_id: "famiglia", month: 3, target_sessions: 3 },
      { service_type_id: "famiglia", month: 4, target_sessions: 3 },
      { service_type_id: "rimosso", month: 5, target_sessions: 9 },
    ],
  );
  assert.deepEqual(services.map((entry) => entry.serviceTypeId), ["famiglia", "battesimo"]);
  assert.deepEqual(services[0].monthlySessions, [0, 0, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(services[1].monthlySessions, Array(12).fill(0));
  assert.deepEqual(draftToServices(servicesToDraft(services)), services);
});

test("voucher plan draft: exact cents, integer monthly counts, round-trip", () => {
  const plan = { plannedTicketCents: 14999, monthlyCounts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 8] };
  const draft = voucherPlanToDraft(plan);
  assert.equal(draft.ticket, "149.99");
  assert.deepEqual(draftToVoucherPlan(draft), plan);
  assert.deepEqual(draftToVoucherPlan({ ticket: "150,5", monthlyCounts: ["2", "", "1.5", "-1", ...Array(8).fill("0")] }).monthlyCounts.slice(0, 4), [2, 0, 0, 0]);
  assert.equal(draftToVoucherPlan({ ticket: "150,5", monthlyCounts: Array(12).fill("0") }).plannedTicketCents, 15050);
});
