import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSessionsView,
  EMPTY_SESSION_FILTERS,
  hasActiveSessionFilters,
  matchesSessionFilters,
  navigateSessionMonth,
  parseSessionFilters,
  sessionDayKey,
  writeSessionFilters,
} from "../lib/sessions.ts";

const NOW = "2026-11-09T12:00:00.000Z";
const stages = {
  booked: { id: "st-booked", code: "booked", ball_owner: "you" },
  proofs: { id: "st-proofs", code: "proofs_sent", ball_owner: "client" },
  delivered: { id: "st-delivered", code: "delivered", ball_owner: "none" },
  cancelled: { id: "st-cancelled", code: "cancelled", ball_owner: "none" },
};
let sequence = 0;
// Sessione di prova: 10:00 ora italiana del giorno indicato.
const session = ({ day = "2026-11-14", service = "natale", client = "rossi", stage = "booked", price = 13500, paid = 0, extras = 0 } = {}) => ({
  id: `s${(sequence += 1)}`,
  scheduled_at: `${day}T09:00:00.000Z`,
  service_type_id: service,
  agreed_price_cents: price,
  client: { id: client },
  current_stage: stages[stage],
  payments: paid ? [{ amount_cents: paid }] : [],
  extras: extras ? [{ line_total_cents: extras }] : [],
});
const filters = (patch = {}) => ({ ...EMPTY_SESSION_FILTERS, ...patch });
const view = (rows, activeFilters, options = {}) => buildSessionsView(rows, activeFilters, { month: "2026-11", page: 1, pageSize: 25, nowIso: NOW, ...options });
const ids = (rows) => rows.map((row) => row.id).sort();

// Lista (tutte le pagine) = Pipeline = riepilogo; il calendario usa gli stessi filtri ma ignora il giorno.
function assertCoherent(result, activeFilters) {
  assert.deepEqual(ids(result.sessions), ids(result.matching.slice(0, result.sessions.length)));
  assert.equal(result.total, result.matching.length);
  const calendarTotal = Object.values(result.calendar).reduce((sum, count) => sum + count, 0);
  if (activeFilters.day) {
    assert.equal(result.summary.sessions, result.matching.length);
    assert.equal(result.calendar[activeFilters.day] ?? 0, result.matching.length);
  } else {
    assert.equal(result.summary.sessions, calendarTotal);
  }
}

test("1 - service filter: list, pipeline, summary and calendar all show only that service", () => {
  const rows = [session({ day: "2026-11-14" }), session({ day: "2026-11-14" }), session({ day: "2026-11-14", service: "famiglia" })];
  const active = filters({ serviceTypeIds: ["natale"] });
  const result = view(rows, active);
  assert.equal(result.sessions.length, 2);
  assert.equal(result.matching.length, 2);
  assert.equal(result.summary.sessions, 2);
  assert.deepEqual(result.calendar, { "2026-11-14": 2 });
  assertCoherent(result, active);
});

test("2 - service + day: list/pipeline/summary narrow to the day, calendar keeps every day of the month", () => {
  const rows = [session({ day: "2026-11-11" }), session({ day: "2026-11-14" }), session({ day: "2026-11-14" }), session({ day: "2026-11-14", service: "famiglia" })];
  const active = filters({ serviceTypeIds: ["natale"], day: "2026-11-14" });
  const result = view(rows, active);
  assert.equal(result.sessions.length, 2);
  assert.equal(result.matching.length, 2);
  assert.equal(result.summary.sessions, 2);
  assert.deepEqual(result.calendar, { "2026-11-11": 1, "2026-11-14": 2 });
  assertCoherent(result, active);
});

test("3 - payment filter uses the shared payment status (price + extras, vouchers included)", () => {
  const rows = [
    session({ day: "2026-11-11", paid: 13500 }),
    session({ day: "2026-11-13" }),
    session({ day: "2026-11-14", paid: 13500, extras: 2000 }),
  ];
  const active = filters({ paymentStatuses: ["unpaid", "partial"] });
  const result = view(rows, active);
  assert.equal(result.matching.length, 2);
  assert.equal(result.summary.sessions, 2);
  assert.equal(result.summary.unpaid, 2);
  assert.deepEqual(result.calendar, { "2026-11-13": 1, "2026-11-14": 1 });
  assertCoherent(result, active);
  const unpaidOnly = view(rows, filters({ paymentStatuses: ["unpaid"] }));
  assert.equal(unpaidOnly.matching.length, 1);
});

test("4 - stage filter: list and pipeline share the same dataset, KPIs follow it", () => {
  const rows = [session({ stage: "booked" }), session({ stage: "proofs" }), session({ stage: "proofs", day: "2026-11-20" }), session({ stage: "delivered" })];
  const active = filters({ stageIds: ["st-proofs"] });
  const result = view(rows, active, { pageSize: 10 });
  assert.deepEqual(ids(result.sessions), ids(result.matching));
  assert.equal(result.matching.length, 2);
  assert.deepEqual(result.kpis, { you: 0, client: 2, total: 2 });
  assertCoherent(result, active);
  assert.deepEqual(view(rows, filters()).kpis, { you: 1, client: 2, total: 3 });
});

test("5 - client filter restricts every widget", () => {
  const rows = [session({ client: "rossi" }), session({ client: "bianchi", day: "2026-11-11" }), session({ client: "rossi", day: "2026-11-20", stage: "proofs" })];
  const active = filters({ clientId: "rossi" });
  const result = view(rows, active);
  assert.equal(result.matching.length, 2);
  assert.equal(result.summary.sessions, 2);
  assert.deepEqual(result.calendar, { "2026-11-14": 1, "2026-11-20": 1 });
  assert.deepEqual(result.kpis, { you: 1, client: 1, total: 2 });
  assertCoherent(result, active);
});

test("6 - combined filters are applied in AND", () => {
  const rows = [
    session({ day: "2026-11-14", client: "rossi" }),
    session({ day: "2026-11-14", client: "rossi", paid: 13500 }),
    session({ day: "2026-11-14", client: "rossi", service: "famiglia" }),
    session({ day: "2026-11-13", client: "rossi" }),
    session({ day: "2026-11-14", client: "verdi" }),
  ];
  const active = filters({ clientId: "rossi", serviceTypeIds: ["natale"], paymentStatuses: ["unpaid"], day: "2026-11-14" });
  const result = view(rows, active);
  assert.equal(result.matching.length, 1);
  assert.equal(result.matching[0].id, rows[0].id);
  assert.deepEqual(result.calendar, { "2026-11-13": 1, "2026-11-14": 1 });
  assertCoherent(result, active);
});

test("7 - month navigation clears a day of another month and keeps every other filter", () => {
  const active = filters({ serviceTypeIds: ["natale"], paymentStatuses: ["unpaid"], day: "2026-11-14" });
  const next = navigateSessionMonth({ month: "2026-11", filters: active }, 1);
  assert.equal(next.month, "2026-12");
  assert.equal(next.filters.day, "");
  assert.deepEqual(next.filters.serviceTypeIds, ["natale"]);
  assert.deepEqual(next.filters.paymentStatuses, ["unpaid"]);
  assert.equal(navigateSessionMonth({ month: "2026-01", filters: filters() }, -1).month, "2025-12");
  const unchanged = filters({ serviceTypeIds: ["natale"] });
  assert.equal(navigateSessionMonth({ month: "2026-11", filters: unchanged }, 1).filters, unchanged);
});

test("8 - reset clears commercial and date filters; the calendar month is navigation and is not touched", () => {
  const active = filters({ clientId: "rossi", serviceTypeIds: ["natale"], stageIds: ["st-booked"], paymentStatuses: ["unpaid"], day: "2026-11-14" });
  assert.equal(hasActiveSessionFilters(active), true);
  assert.equal(hasActiveSessionFilters(EMPTY_SESSION_FILTERS), false);
  const state = { month: "2026-12", filters: active };
  const reset = { ...state, filters: { ...EMPTY_SESSION_FILTERS } };
  assert.equal(reset.month, "2026-12");
  assert.equal(writeSessionFilters(reset.filters, new URLSearchParams()).toString(), "");
});

test("9 - filters apply before pagination: page 1 = 10 rows, calendar and summary = all 20", () => {
  const rows = Array.from({ length: 20 }, (_, index) => session({ day: `2026-11-${String(index + 1).padStart(2, "0")}` }));
  rows.push(session({ service: "famiglia" }));
  const active = filters({ serviceTypeIds: ["natale"] });
  const result = view(rows, active, { pageSize: 10 });
  assert.equal(result.sessions.length, 10);
  assert.equal(result.total, 20);
  assert.equal(result.summary.sessions, 20);
  assert.equal(Object.values(result.calendar).reduce((sum, count) => sum + count, 0), 20);
  assert.equal(view(rows, active, { pageSize: 10, page: 2 }).sessions.length, 10);
  // Il filtro giorno e applicato prima della paginazione: nessuna pagina incompleta.
  const dayOnly = view(rows, filters({ day: "2026-11-14" }), { pageSize: 10 });
  assert.equal(dayOnly.sessions.length, 2);
});

test("calendar exception: counts ignore the selected day but respect every other filter", () => {
  const rows = [session({ day: "2026-11-11" }), session({ day: "2026-11-14" }), session({ day: "2026-11-14", service: "famiglia" })];
  const withDay = view(rows, filters({ serviceTypeIds: ["natale"], day: "2026-11-14" }));
  const withoutDay = view(rows, filters({ serviceTypeIds: ["natale"] }));
  assert.deepEqual(withDay.calendar, withoutDay.calendar);
  assert.notEqual(withDay.matching.length, withoutDay.matching.length);
  assert.equal(matchesSessionFilters(rows[0], filters({ day: "2026-11-14" }), { ignoreDay: true }), true);
  assert.equal(matchesSessionFilters(rows[0], filters({ day: "2026-11-14" })), false);
});

test("empty results: zero everywhere, no errors; cancelled sessions never appear", () => {
  const rows = [session({}), session({ stage: "cancelled" })];
  const result = view(rows, filters({ day: "2026-11-02" }));
  assert.equal(result.sessions.length, 0);
  assert.equal(result.total, 0);
  assert.deepEqual(result.summary, { sessions: 0, unpaid: 0, settled: 0, valueCents: 0, coveredCents: 0 });
  assert.deepEqual(result.calendar, { "2026-11-14": 1 });
  assert.equal(view(rows, filters()).total, 1);
});

test("summary uses shared definitions: value = price + extras, covered = money + vouchers capped at due", () => {
  const rows = [session({ price: 20000, extras: 5000, paid: 30000 }), session({ price: 10000, paid: 4000 }), session({ price: 0 })];
  const { summary } = view(rows, filters());
  assert.deepEqual(summary, { sessions: 3, unpaid: 1, settled: 2, valueCents: 35000, coveredCents: 29000 });
});

test("day and month use Europe/Rome, not the server timezone", () => {
  assert.equal(sessionDayKey("2026-11-30T23:30:00.000Z"), "2026-12-01");
  const rows = [{ ...session({}), scheduled_at: "2026-11-30T23:30:00.000Z" }];
  assert.deepEqual(view(rows, filters()).calendar, {});
  assert.deepEqual(view(rows, filters(), { month: "2026-12" }).calendar, { "2026-12-01": 1 });
});

test("filters round-trip through the URL without default values", () => {
  const active = filters({ clientId: "c1", serviceTypeIds: ["a", "b"], stageIds: ["s"], paymentStatuses: ["unpaid"], day: "2026-11-14" });
  const params = writeSessionFilters(active, new URLSearchParams());
  assert.equal(params.toString(), "clientId=c1&serviceTypeId=a%2Cb&stageId=s&paymentStatus=unpaid&day=2026-11-14");
  assert.deepEqual(parseSessionFilters(params), active);
  assert.equal(parseSessionFilters(new URLSearchParams("day=14-11-2026")).day, "");
});

test("list order is unchanged by filters: future ascending, then past descending", () => {
  const rows = [session({ day: "2026-11-01" }), session({ day: "2026-11-20" }), session({ day: "2026-11-05" }), session({ day: "2026-11-12" })];
  const order = view(rows, filters()).matching.map((row) => row.scheduled_at.slice(0, 10));
  assert.deepEqual(order, ["2026-11-12", "2026-11-20", "2026-11-05", "2026-11-01"]);
  const filtered = view(rows, filters({ serviceTypeIds: ["natale"] })).matching.map((row) => row.scheduled_at.slice(0, 10));
  assert.deepEqual(filtered, order);
});
