import assert from "node:assert/strict";
import test from "node:test";
import { buildServiceTargets, distributedTotal, planCoherence } from "../lib/economic-plans.ts";
import { addDraftService, removeDraftService, updateDraftService, updateDraftServiceMonth } from "../lib/economic-plan-draft.ts";

// Stessa conversione del componente: la matrice e la tabella servizi leggono la stessa lista.
const toPlan = (services) => ({
  annualTargetCents: 0,
  expectedUpliftCents: 0,
  monthlyTargets: [],
  serviceTargets: services.map((row) => ({ serviceTypeId: row.serviceTypeId, targetSessions: Number(row.sessions), plannedBaseTicketCents: Number(row.ticket) * 100, targetValueCents: Number(row.sessions) * Number(row.ticket) * 100, monthlySessions: row.monthlySessions.map(Number) })),
});

const battesimo = { serviceTypeId: "battesimo", sessions: "3", ticket: "350", monthlySessions: Array(12).fill("0") };

test("1-3 add Smash Cake: appears once with 12 months at 0, target from first table", () => {
  let services = addDraftService([battesimo], "smash");
  assert.equal(services.find((row) => row.serviceTypeId === "smash").ticket, "0");
  services = updateDraftService(services, "smash", { sessions: "5", ticket: "150" });
  assert.deepEqual(services.map((row) => row.serviceTypeId), ["battesimo", "smash"]);
  const smash = services.find((row) => row.serviceTypeId === "smash");
  assert.deepEqual(smash.monthlySessions, Array(12).fill("0"));
  assert.equal(addDraftService(services, "smash").length, 2);
  const summary = planCoherence(toPlan(services));
  assert.deepEqual(summary.undistributedServices.find((entry) => entry.serviceTypeId === "smash"), { serviceTypeId: "smash", targetSessions: 5, distributedSessions: 0 });
});

test("4-5 changing target 5 -> 7 keeps the distribution and shows the gap", () => {
  let services = updateDraftService(addDraftService([], "smash"), "smash", { sessions: "5" });
  services = updateDraftServiceMonth(services, "smash", 0, "1");
  services = updateDraftServiceMonth(services, "smash", 1, "2");
  services = updateDraftServiceMonth(services, "smash", 2, "2");
  services = updateDraftService(services, "smash", { sessions: "7" });
  assert.deepEqual(services[0].monthlySessions.slice(0, 3), ["1", "2", "2"]);
  const target = toPlan(services).serviceTargets[0];
  assert.equal(distributedTotal(target), 5);
  assert.equal(target.targetSessions, 7);
  assert.deepEqual(planCoherence(toPlan(services)).undistributedServices, [{ serviceTypeId: "smash", targetSessions: 7, distributedSessions: 5 }]);
});

test("6 removing Smash Cake removes it from the single list (both tables)", () => {
  const services = removeDraftService(addDraftService([battesimo], "smash"), "smash");
  assert.deepEqual(services.map((row) => row.serviceTypeId), ["battesimo"]);
  assert.equal(toPlan(services).serviceTargets.length, 1);
});

test("7-8 Battesimo in the plan is in the distribution with 0/3 and a warning", () => {
  const summary = planCoherence(toPlan([battesimo]));
  assert.deepEqual(summary.undistributedServices, [{ serviceTypeId: "battesimo", targetSessions: 3, distributedSessions: 0 }]);
});

test("9-10 loading: missing months become 0, orphan monthly rows are ignored, order follows service targets", () => {
  const targets = buildServiceTargets(
    [
      { service_type_id: "famiglia", target_sessions: 15, target_value_cents: 360000 },
      { service_type_id: "battesimo", target_sessions: 3, target_value_cents: 105000 },
    ],
    [
      { service_type_id: "famiglia", month: 3, target_sessions: 3 },
      { service_type_id: "famiglia", month: 4, target_sessions: 3 },
      { service_type_id: "rimosso", month: 5, target_sessions: 9 },
    ],
  );
  assert.deepEqual(targets.map((entry) => entry.serviceTypeId), ["famiglia", "battesimo"]);
  assert.deepEqual(targets[0].monthlySessions, [0, 0, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(targets[1].monthlySessions, Array(12).fill(0));
  assert.ok(!targets.some((entry) => entry.serviceTypeId === "rimosso"));
});
