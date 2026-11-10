import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = readFileSync(new URL("../app/api/vouchers/[id]/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function loadDeleteRoute(result) {
  const calls = [];
  const dependencies = {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    "@/lib/supabase/admin": {
      supabaseAdmin: {
        async rpc(name, args) { calls.push({ name, args }); return result; },
        from() { assert.fail("Deletion must use a single atomic RPC, not separate table requests"); },
      },
    },
    "@/lib/vouchers": { expireOverdueVouchers() { assert.fail("Deletion must not run lazy updates"); } },
  };
  const route = { exports: {}, require: (name) => { assert.ok(name in dependencies, name); return dependencies[name]; } };
  runInNewContext(compiled, route);
  return { handler: route.exports.DELETE, calls };
}

test("voucher DELETE delegates to a single atomic RPC", async () => {
  const { handler, calls } = loadDeleteRoute({ data: true, error: null });
  const response = await handler({}, { params: Promise.resolve({ id: "voucher-1" }) });
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ name: "delete_unredeemed_voucher", args: { p_voucher_id: "voucher-1" } }]);
});

for (const scenario of [
  { name: "missing voucher", result: { data: false, error: null }, status: 404 },
  { name: "redeemed voucher", result: { data: null, error: { code: "P0001" } }, status: 409 },
  { name: "linked records", result: { data: null, error: { code: "23503" } }, status: 409 },
  { name: "unapplied migration", result: { data: null, error: { code: "PGRST202" } }, status: 503 },
  { name: "database failure", result: { data: null, error: { code: "XX000", message: "private database details" } }, status: 500 },
]) {
  test(`voucher DELETE handles ${scenario.name} without reporting success`, async () => {
    const { handler, calls } = loadDeleteRoute(scenario.result);
    const response = await handler({}, { params: Promise.resolve({ id: "voucher-1" }) });
    assert.equal(response.status, scenario.status);
    assert.equal(response.body.success, undefined);
    assert.ok(response.body.error);
    assert.equal(response.body.error.includes("private database details"), false);
    assert.equal(calls.length, 1);
  });
}

test("voucher deletion migration locks and checks redemption before deleting purchase payments", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261111000100_delete_unredeemed_voucher.sql", import.meta.url), "utf8");
  const lock = sql.indexOf("for update;");
  const guard = sql.indexOf("if target_voucher.status = 'redeemed'");
  const payments = sql.indexOf("delete from public.payments where voucher_id = p_voucher_id;");
  const voucher = sql.indexOf("delete from public.gift_vouchers where id = p_voucher_id;");
  assert.ok(lock > 0 && guard > lock && payments > guard && voucher > payments);
  assert.match(sql, /redeemed_session_id is not null/);
  assert.match(sql, /redeemed_at is not null/);
  assert.match(sql, /exists \(select 1 from public.payments where applied_voucher_id = p_voucher_id\)/);
  assert.match(sql, /revoke all .* from public, anon, authenticated;/);
  assert.match(sql, /grant execute .* to service_role;/);
  assert.doesNotMatch(sql, /exception\s+when|commit;/i);
});

test("delete button is available for unredeemed vouchers and absent for redeemed or linked vouchers", () => {
  const require = createRequire(import.meta.url);
  const source = readFileSync(new URL("../components/vouchers/delete-voucher-button.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const component = { exports: {}, require };
  runInNewContext(compiled, component);
  const voucher = { id: "voucher-1", code: "TEST-1", status: "active", redeemed_session_id: null };
  const render = (overrides = {}, props = {}) => renderToStaticMarkup(createElement(component.exports.DeleteVoucherButton, {
    voucher: { ...voucher, ...overrides }, onDeleted() {}, onError() {}, ...props,
  }));
  for (const status of ["active", "expired", "cancelled"]) {
    assert.match(render({ status }), /aria-label="Elimina buono TEST-1"/);
  }
  assert.equal(render({ status: "redeemed" }), "");
  assert.equal(render({ redeemed_session_id: "session-1" }), "");
  assert.equal(render({ redemptions: [{ id: "payment-1" }] }), "");
  assert.match(render({}, { compact: true }), /title="Elimina buono"/);
  assert.match(render({}, { disabled: true }), /disabled=""/);
});

for (const scenario of [
  { name: "cancel confirmation", confirm: false, disabled: false, status: 200, requests: 0, deleted: 0 },
  { name: "disabled action", confirm: true, disabled: true, status: 200, requests: 0, deleted: 0 },
  { name: "confirmed deletion", confirm: true, disabled: false, status: 200, requests: 1, deleted: 1 },
  { name: "redemption conflict", confirm: true, disabled: false, status: 409, requests: 1, deleted: 0 },
  { name: "server failure", confirm: true, disabled: false, status: 500, requests: 1, deleted: 0 },
]) {
  test(`delete button interaction: ${scenario.name}`, async () => {
    const require = createRequire(import.meta.url);
    const source = readFileSync(new URL("../components/vouchers/delete-voucher-button.tsx", import.meta.url), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const states = [];
    const errors = [];
    const requests = [];
    const confirmations = [];
    let deleted = 0;
    let finishRequest;
    const response = new Promise((resolve) => { finishRequest = resolve; });
    const context = {
      exports: {},
      require: (name) => name === "react" ? { useState: () => [false, (value) => states.push(value)] } : require(name),
      window: { confirm: (message) => { confirmations.push(message); return scenario.confirm; } },
      fetch: (url, options) => { requests.push({ url, method: options.method }); return response; },
    };
    runInNewContext(compiled, context);
    const button = context.exports.DeleteVoucherButton({
      voucher: { id: "voucher-1", code: "TEST-1", status: "active", redeemed_session_id: null },
      disabled: scenario.disabled,
      onDeleted: () => { deleted++; },
      onError: (message) => errors.push(message),
    });
    const pending = button.props.onClick();
    assert.equal(requests.length, scenario.requests);
    if (scenario.requests) {
      assert.deepEqual(states, [true]);
      assert.equal(deleted, 0);
      assert.deepEqual(requests, [{ url: "/api/vouchers/voucher-1", method: "DELETE" }]);
    }
    finishRequest({ ok: scenario.status === 200, json: async () => scenario.status === 200 ? { success: true } : { error: "Eliminazione bloccata." } });
    await pending;
    assert.equal(deleted, scenario.deleted);
    assert.deepEqual(states, scenario.requests ? [true, false] : []);
    assert.deepEqual(errors, !scenario.requests ? [] : scenario.status === 200 ? [null] : [null, "Eliminazione bloccata."]);
    assert.equal(confirmations.length, scenario.disabled ? 0 : 1);
    if (confirmations.length) {
      assert.match(confirmations[0], /TEST-1/);
      assert.match(confirmations[0], /pagamenti di acquisto/);
      assert.match(confirmations[0], /non registra un rimborso/);
    }
  });
}