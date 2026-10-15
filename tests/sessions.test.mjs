import assert from "node:assert/strict";
import test from "node:test";
import { canUsePrintFulfillmentStages, hasPrintExtras } from "../lib/sessions.ts";

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