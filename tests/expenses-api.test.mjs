import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as datetime from "../lib/datetime.ts";
import * as economics from "../lib/economic-plans.ts";

function load(path, dependencies) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, require(name) { assert.ok(name in dependencies, name); return dependencies[name]; } };
  runInNewContext(source, context);
  return context.exports;
}
const pure = load("../lib/expenses.ts", { "@/lib/datetime": datetime, "@/lib/economic-plans": economics });
const next = { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } };
const categoryId = "00000000-0000-0000-0000-000000000001";
const methodId = "00000000-0000-0000-0000-000000000002";
const input = { description: "Hosting", expense_category_id: categoryId, net_amount_cents: 10000, vat_amount_cents: 2200, payment_method_id: methodId, paid_date: "2025-01-02" };

function setup({ active = true, rpcResult = { data: "rule-id", error: null }, writeResult = { data: { id: "expense-id" }, error: null } } = {}) {
  const calls = [];
  const tables = {
    expense_categories: [{ id: categoryId, name: "Sito", kind: "operating", is_marketing: false, is_active: active }],
    payment_methods: [{ id: methodId, name: "Bonifico", is_active: active, is_system: false }],
    service_types: [],
    expenses: [{ ...input, id: "expense-id" }],
    recurring_expense_rules: [{ ...input, id: "rule-id", frequency: "monthly", start_date: "2025-01-01", end_date: null, is_active: true }],
  };
  const db = {
    async rpc(name, args) { calls.push({ rpc: name, args }); return rpcResult; },
    from(table) {
      let action = "select";
      const builder = {
        select() { return this; }, eq() { return this; }, order() { return this; }, range() { return this; }, gte() { return this; }, lt() { return this; }, not() { return this; },
        insert(values) { action = "insert"; calls.push({ table, action, values }); return this; },
        update(values) { action = "update"; calls.push({ table, action, values }); return this; },
        delete() { action = "delete"; calls.push({ table, action }); return this; },
        async maybeSingle() { return action === "select" ? { data: tables[table]?.[0], error: null } : writeResult; },
        then(resolve) { return Promise.resolve({ data: tables[table] ?? [], error: null }).then(resolve); },
      };
      return builder;
    },
  };
  const server = load("../lib/expenses-server.ts", {
    "next/server": next, "@/lib/supabase/admin": { supabaseAdmin: db }, "@/lib/datetime": datetime, "@/lib/expenses": pure,
    "@/lib/economic-plans-server": {
      parseYear: value => /^\d{4}$/.test(value) && Number(value) >= 2000 && Number(value) <= 2100 ? Number(value) : null,
      loadPaged: async build => { const result = await build(0, 999); if (result.error) throw result.error; return result.data; },
      loadEconomicSessions: async () => [], loadEconomicPayments: async () => [],
    },
  });
  return { server, calls, tables };
}
const plain = value => JSON.parse(JSON.stringify(value));

test("expense POST stores canonical cents and never accepts snapshots, origin or mutable total", async () => {
  const { server, calls } = setup();
  const route = load("../app/api/expenses/route.ts", { "next/server": next, "@/lib/expenses-server": server });
  const response = await route.POST({ json: async () => ({ ...input, category_kind_snapshot: "tax_contribution", recurring_rule_id: "forged", total_paid_cents: 1 }) });
  assert.equal(response.status, 201);
  const values = calls.find(call => call.action === "insert").values;
  assert.equal(values.net_amount_cents + values.vat_amount_cents, 12200);
  for (const key of ["category_kind_snapshot", "recurring_rule_id", "total_paid_cents"]) assert.equal(key in values, false);
});

test("invalid JSON, invalid year, decimals and future paid date never write", async () => {
  const { server, calls } = setup();
  const route = load("../app/api/expenses/route.ts", { "next/server": next, "@/lib/expenses-server": server });
  assert.equal((await route.POST({ json: async () => { throw new Error("bad JSON"); } })).status, 400);
  assert.equal((await route.GET({ nextUrl: { searchParams: new URLSearchParams("year=abc") } })).status, 400);
  for (const body of [{ ...input, net_amount_cents: 1.5 }, { ...input, paid_date: "2100-12-31" }, { ...input, paid_date: "2025-02-31" }]) assert.equal((await route.POST({ json: async () => body })).status, 400);
  assert.equal(calls.length, 0);
});

test("deactivated references reject new costs, but permit unchanged references on historical corrections", async () => {
  const { server, calls } = setup({ active: false });
  await assert.rejects(server.saveExpense(input), error => error.status === 400);
  await server.saveExpense({ ...input, description: "Correzione" }, "expense-id");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, "update");
});

test("cost reads materialize first and never hide missing migration as zero", async () => {
  const { server, calls } = setup({ rpcResult: { data: null, error: { code: "PGRST202" } } });
  const route = load("../app/api/expenses/route.ts", { "next/server": next, "@/lib/expenses-server": server });
  const response = await route.GET({ nextUrl: { searchParams: new URLSearchParams("year=2025") } });
  assert.equal(response.status, 503);
  assert.equal(response.body.expenses, undefined);
  assert.equal(calls[0].rpc, "materialize_due_recurring_expenses");
});

test("recurrence API returns confirmation count without partial direct table writes", async () => {
  const { server, calls } = setup({ rpcResult: { data: null, error: { code: "P0001", details: "2" } } });
  const route = load("../app/api/recurring-expenses/route.ts", { "next/server": next, "@/lib/expenses-server": server });
  const response = await route.POST({ json: async () => ({ ...input, frequency: "monthly", start_date: "2025-01-01", is_active: true, p_today: "2000-01-01", processed_through: "2100-01-01" }) });
  assert.equal(response.status, 409);
  assert.equal(response.body.confirmationCount, 2);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].rpc, "save_recurring_expense_rule");
  assert.equal("p_today" in calls[0].args, false);
  assert.equal("processed_through" in calls[0].args.p_values, false);
});

test("confirmed recurrence creation passes the exact confirmation and schedule to atomic RPC", async () => {
  const { server, calls } = setup();
  assert.equal(await server.saveRecurringExpense({ ...input, frequency: "quarterly", start_date: "2025-01-01", confirmationCount: 6 }), "rule-id");
  assert.equal(calls[0].args.p_confirm_count, 6);
  assert.equal(calls[0].args.p_values.frequency, "quarterly");
  assert.equal(calls[0].args.p_id, null);
});

test("recurrence deactivation keeps the rule and existing movements", async () => {
  const { server, calls } = setup();
  const route = load("../app/api/recurring-expenses/[id]/route.ts", { "next/server": next, "@/lib/expenses-server": server });
  const response = await route.DELETE({}, { params: Promise.resolve({ id: "rule-id" }) });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.p_id, "rule-id");
  assert.equal(calls[0].args.p_values.is_active, false);
});

test("expense deletion reports missing row and database failure, never false success", async () => {
  for (const [result, status] of [[{ data: null, error: null }, 404], [{ data: null, error: { code: "XX000", message: "secret details" } }, 500], [{ data: { id: "expense-id" }, error: null }, 200]]) {
    const { server, calls } = setup({ writeResult: result });
    const route = load("../app/api/expenses/[id]/route.ts", { "next/server": next, "@/lib/expenses-server": server });
    const response = await route.DELETE({}, { params: Promise.resolve({ id: "expense-id" }) });
    assert.equal(response.status, status);
    assert.equal(JSON.stringify(response.body).includes("secret details"), false);
    assert.deepEqual(plain(calls), [{ table: "expenses", action: "delete" }]);
  }
});

test("categories can be renamed, sorted and deactivated but cannot change historical kind", async () => {
  const { server, calls } = setup();
  await server.saveExpenseCategory({ name: " Rinominata ", sort_order: 30, is_active: false, kind: "tax_contribution", is_marketing: true }, categoryId);
  assert.deepEqual(plain(calls[0].values), { name: "Rinominata", sort_order: 30, is_active: false });
  await assert.rejects(server.saveExpenseCategory({ name: "X", sort_order: -1, is_active: true, kind: "operating" }), error => error.status === 400);
});

test("shared cost loader deduplicates paid-year and campaign-year movements", async () => {
  const { server, tables } = setup();
  tables.expenses[0] = { ...input, id: "same-id", category_kind_snapshot: "operating", category_name_snapshot: "Sito", category_is_marketing_snapshot: false };
  const result = await server.loadCostAnalytics(2025, { sessions: [], payments: [] });
  assert.equal(result.operatingCostsCents, 12200);
  assert.equal(result.categoryBreakdown[0].count, 1);
});

test("error responses distinguish constraints, conflicts, migration and unavailable database", () => {
  const { server } = setup();
  for (const [code, status] of [["23514", 400], ["23505", 409], ["P0002", 404], ["42P01", 503], ["PGRST205", 503], ["XX000", 500]]) assert.equal(server.expenseErrorResponse({ code }).status, status);
});