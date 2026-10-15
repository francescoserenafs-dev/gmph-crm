import assert from "node:assert/strict";
import test from "node:test";
import { canUsePrintFulfillmentStages, hasPrintExtras } from "../lib/sessions.ts";
import { sessionSaturdaySurchargeCents, suggestedSessionPrice } from "../lib/datetime.ts";

test("print fulfillment applies only to sessions with positive print extras", () => {
  assert.equal(hasPrintExtras([{ category_snapshot: "print", quantity: 1 }]), true);
  assert.equal(hasPrintExtras([{ category_snapshot: "print", quantity: 0 }]), false);
  assert.equal(hasPrintExtras([{ category_snapshot: "album", quantity: 1 }]), false);
  assert.equal(hasPrintExtras([{ category_snapshot: null, quantity: 2 }]), false);
  assert.equal(hasPrintExtras([]), false);
});

test("print fulfillment starts only after delivery and can continue through its own stages", () => {
  const prints = [{ category_snapshot: "print", quantity: 1 }];
  assert.equal(canUsePrintFulfillmentStages("delivered", prints), true);
  assert.equal(canUsePrintFulfillmentStages("awaiting_print_selection", prints), true);
  assert.equal(canUsePrintFulfillmentStages("print_selection_received", prints), true);
  assert.equal(canUsePrintFulfillmentStages("prints_completed", prints), true);
  assert.equal(canUsePrintFulfillmentStages("selection_received", prints), false);
  assert.equal(canUsePrintFulfillmentStages("delivered", []), false);
});

test("Saturday surcharge is applied only to Saturdays in Europe/Rome", () => {
  assert.equal(suggestedSessionPrice({ packagePriceCents: 22000, scheduledAt: "2027-01-09T10:00", saturdaySurchargeCents: 1500 }), 23500);
  assert.equal(suggestedSessionPrice({ packagePriceCents: 22000, scheduledAt: "2027-01-08T10:00", saturdaySurchargeCents: 1500 }), 22000);
  assert.equal(sessionSaturdaySurchargeCents("2027-01-09T22:30:00Z", 1500), 1500);
  assert.equal(sessionSaturdaySurchargeCents("2027-01-09T23:30:00Z", 1500), 0);
  assert.equal(sessionSaturdaySurchargeCents("", 1500), 0);
  assert.equal(suggestedSessionPrice({ packagePriceCents: 13500, scheduledAt: "2027-12-25T10:00", saturdaySurchargeCents: 2500 }), 16000);
  assert.equal(suggestedSessionPrice({ packagePriceCents: null, scheduledAt: "2027-01-09T10:00", saturdaySurchargeCents: 1500 }), null);
});

test("approved 2027 package examples produce the expected manual-session prices", () => {
  const cases = [
    [17000, "2027-01-08T10:00", 1500, 17000],
    [17000, "2027-01-09T10:00", 1500, 18500],
    [22000, "2027-01-09T10:00", 1500, 23500],
    [22500, "2027-01-09T10:00", 1500, 24000],
    [11500, "2027-01-08T10:00", 1500, 11500],
    [11500, "2027-01-09T10:00", 1500, 13000],
    [13500, "2027-12-24T10:00", 2500, 13500],
    [13500, "2027-12-25T10:00", 2500, 16000],
    [11000, "2027-01-09T10:00", 0, 11000],
  ];

  for (const [packagePriceCents, scheduledAt, saturdaySurchargeCents, expected] of cases) {
    assert.equal(suggestedSessionPrice({ packagePriceCents, scheduledAt, saturdaySurchargeCents }), expected);
  }
});