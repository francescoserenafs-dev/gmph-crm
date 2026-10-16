import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { canUsePrintFulfillmentStages, hasPrintExtras, PRINT_FULFILLMENT_STAGE_CODES } from "../lib/sessions.ts";
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

test("stage PATCH accepts to-one current-stage relations for print fulfillment", async (context) => {
  const source = readFileSync(new URL("../app/api/sessions/[id]/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const prints = [{ category_snapshot: "print", quantity: 1 }];
  const cases = [
    ...PRINT_FULFILLMENT_STAGE_CODES.map((target) => ({ current: "delivered", target, extras: prints, status: 200 })),
    { current: "awaiting_print_selection", target: "print_selection_received", extras: prints, status: 200 },
    { current: "print_selection_received", target: "prints_completed", extras: prints, status: 200 },
    { current: "selection_received", target: "awaiting_print_selection", extras: prints, status: 400 },
    { current: "delivered", target: "awaiting_print_selection", extras: [], status: 400 },
    { current: null, target: "awaiting_print_selection", extras: prints, status: 400 },
  ];

  for (const scenario of cases) {
    await context.test(`${scenario.current} -> ${scenario.target}, prints=${scenario.extras.length}`, async () => {
      const updates = [];
      const session = { id: "session-1", current_stage: scenario.current ? { code: scenario.current } : null, extras: scenario.extras, icloud_event_url: "existing-event" };
      const supabaseAdmin = {
        from(table) {
          return {
            select() { return this; },
            eq() { return this; },
            order() { return this; },
            limit() { return this; },
            update(values) { updates.push({ table, values }); return this; },
            async maybeSingle() { return { data: table === "session_stages" ? { id: scenario.target, name: scenario.target, code: scenario.target } : session, error: null }; },
            then(resolve, reject) { return Promise.resolve({ error: null }).then(resolve, reject); },
          };
        },
      };
      const dependencies = {
        "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
        "@/lib/supabase/admin": { supabaseAdmin },
        "@/lib/icloud-calendar": {},
        "@/lib/sessions-server": {},
        "@/lib/datetime": {},
        "@/lib/email": {},
        "@/lib/packages": { SESSION_PACKAGE_SNAPSHOT_FIELDS: "" },
        "@/lib/sessions": { canUsePrintFulfillmentStages, PRINT_FULFILLMENT_STAGE_CODES },
      };
      const route = { exports: {}, require: (name) => { assert.ok(name in dependencies, name); return dependencies[name]; } };
      runInNewContext(compiled, route);
      const response = await route.exports.PATCH(
        { json: async () => ({ action: "updateStage", stageId: scenario.target }) },
        { params: Promise.resolve({ id: session.id }) },
      );
      assert.equal(response.status, scenario.status, response.body.error);
      const stageUpdates = updates.filter((update) => update.table === "sessions");
      assert.equal(stageUpdates.length, scenario.status === 200 ? 1 : 0);
      if (scenario.status === 200) assert.equal(stageUpdates[0].values.current_stage_id, scenario.target);
    });
  }
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