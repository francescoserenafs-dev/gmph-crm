import assert from "node:assert/strict";
import test from "node:test";
import { analyzeClientRetention } from "../lib/client-retention.ts";

const now = new Date("2027-12-31T23:00:00.000Z");

function session(id, clientId, date, serviceTypeId, serviceTypeName, agreedPriceCents, extrasCents = 0, options = {}) {
  return {
    id,
    clientId,
    clientName: `Cliente ${clientId}`,
    scheduledAt: date,
    serviceTypeId,
    serviceTypeName,
    serviceName: serviceTypeName,
    agreedPriceCents,
    extrasCents,
    isCancelled: false,
    isAddon: false,
    ...options,
  };
}

const sessions = [
  session("a1", "A", "2025-03-01T10:00:00.000Z", "family", "Famiglia", 10000, 1000),
  session("a2", "A", "2026-03-01T10:00:00.000Z", "christmas", "Natale", 15000, 2000),
  session("a3", "A", "2027-03-01T10:00:00.000Z", "family", "Famiglia", 20000, 3000),
  session("a4", "A", "2028-03-01T10:00:00.000Z", "family", "Famiglia", 50000),
  session("b1", "B", "2027-04-01T10:00:00.000Z", "maternity", "Maternita", 30000),
  session("b2", "B", "2028-04-01T10:00:00.000Z", "family", "Famiglia", 30000),
  session("c1", "C", "2026-02-01T10:00:00.000Z", "kids", "Kids", 10000),
  session("c2", "C", "2027-02-01T10:00:00.000Z", "christmas", "Natale", 12000),
  session("d1", "D", "2026-01-01T10:00:00.000Z", "proofs", "Provini Extra", 10000),
  session("e1", "E", "2027-05-01T10:00:00.000Z", "family", "Famiglia", 10000, 0, { isCancelled: true }),
];

test("retention 2027 separates realized activity, future bookings and legacy rows", () => {
  const result = analyzeClientRetention({ sessions, year: 2027, now, reactivationMonths: 6 });

  assert.deepEqual(result.totals, {
    servedClients: 3,
    newClients: 1,
    returningClients: 2,
    repeatClientRate: 2 / 3,
    averageSessionsPerClient: 1,
    averageCommercialValuePerClientCents: 65000 / 3,
    futureReturningClients: 2,
  });
  assert.equal(result.byMonth[1].returningClients, 1);
  assert.equal(result.byMonth[2].returningClients, 1);
  assert.equal(result.byMonth[3].newClients, 1);
  assert.equal(result.customerValue.oneSession.clients, 1);
  assert.equal(result.customerValue.oneSession.averageCents, 30000);
  assert.equal(result.customerValue.returning.clients, 2);
  assert.equal(result.customerValue.returning.averageCents, 36500);
  assert.ok(Math.abs((result.secondServiceMedianMonths ?? 0) - 12) < 0.02);
  assert.deepEqual(result.reactivationRows.map(({ clientId }) => clientId), ["C"]);
  assert.equal(result.reactivationRows[0].cumulativeValueCents, 22000);
  assert.deepEqual(result.journeys.map(({ fromName, toName, clients }) => [fromName, toName, clients]), [
    ["Famiglia", "Natale", 1],
    ["Kids", "Natale", 1],
    ["Natale", "Famiglia", 1],
  ].sort(([fromA, toA], [fromB, toB]) => fromA.localeCompare(fromB) || toA.localeCompare(toB)));
});

test("service journey filters constrain only direct consecutive transitions", () => {
  const result = analyzeClientRetention({
    sessions,
    year: 2027,
    now,
    reactivationMonths: 6,
    initialServiceId: "kids",
    nextServiceId: "christmas",
  });

  assert.deepEqual(result.journeys.map(({ fromId, toId }) => [fromId, toId]), [["kids", "christmas"]]);
});

test("zero-priced valid services count, exact duplicate bookings collapse, and distinct same-day sessions remain", () => {
  const sameDaySessions = [
    session("z1", "Z", "2027-06-10T08:00:00.000Z", "family", "Famiglia", 0),
    session("z-duplicate", "Z", "2027-06-10T08:00:00.000Z", "family", "Famiglia", 5000),
    session("z2", "Z", "2027-06-10T10:00:00.000Z", "kids", "Kids", 0),
  ];
  const result = analyzeClientRetention({ sessions: sameDaySessions, year: 2027, now, reactivationMonths: 6 });

  assert.equal(result.totals.servedClients, 1);
  assert.equal(result.totals.newClients, 1);
  assert.equal(result.totals.returningClients, 1);
  assert.equal(result.totals.averageSessionsPerClient, 2);
  assert.equal(result.totals.averageCommercialValuePerClientCents, 0);
  assert.deepEqual(result.journeys.map(({ fromName, toName }) => [fromName, toName]), [["Famiglia", "Kids"]]);
});

test("empty year returns null period metrics while journeys retain all available history", () => {
  const result = analyzeClientRetention({ sessions, year: 2030, now, reactivationMonths: 6 });

  assert.equal(result.totals.servedClients, 0);
  assert.equal(result.totals.repeatClientRate, null);
  assert.equal(result.totals.averageSessionsPerClient, null);
  assert.equal(result.totals.averageCommercialValuePerClientCents, null);
  assert.equal(result.journeys.length, 3);
});

test("returning clients are period-sensitive while repeat rate uses realized history", () => {
  const minimal = [
    session("a1", "A", "2025-03-01T10:00:00.000Z", "family", "Famiglia", 10000),
    session("a2", "A", "2026-12-01T10:00:00.000Z", "christmas", "Natale", 10000),
    session("b1", "B", "2026-04-01T10:00:00.000Z", "family", "Famiglia", 10000),
    session("c1", "C", "2026-05-01T10:00:00.000Z", "kids", "Kids", 10000),
    session("c2", "C", "2027-12-01T10:00:00.000Z", "christmas", "Natale", 10000),
  ];
  const run = (year) => analyzeClientRetention({ sessions: minimal, year, now, reactivationMonths: 6 }).totals;

  const y2025 = run(2025);
  assert.equal(y2025.servedClients, 1);
  assert.equal(y2025.newClients, 1);
  assert.equal(y2025.returningClients, 0);
  assert.equal(y2025.repeatClientRate, 1);

  const y2026 = run(2026);
  assert.equal(y2026.servedClients, 3);
  assert.equal(y2026.newClients, 2);
  assert.equal(y2026.returningClients, 1);
  assert.equal(y2026.repeatClientRate, 2 / 3);

  const y2027 = run(2027);
  assert.equal(y2027.servedClients, 1);
  assert.equal(y2027.newClients, 0);
  assert.equal(y2027.returningClients, 1);
  assert.equal(y2027.repeatClientRate, 1);
});