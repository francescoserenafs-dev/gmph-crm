import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("expense migration and recurrence lifecycle on isolated PostgreSQL", async (context) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create table clients(id uuid primary key); create table sessions(id uuid primary key);
      create table gift_vouchers(id uuid primary key); create table payments(id uuid primary key);
      create table payment_methods(id uuid primary key default gen_random_uuid(), name text, is_active boolean default true, is_system boolean default false);
      create table service_types(id uuid primary key default gen_random_uuid(), name text, is_active boolean default true, is_addon boolean default false);
      create function set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
    `);
    await db.exec(readFileSync(new URL("../supabase/migrations/20260828000300_add_audit_log.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("../supabase/migrations/20261110102946_expense_management.sql", import.meta.url), "utf8"));
    const category = (await db.query("select id from expense_categories where sort_order = 10")).rows[0].id;
    const method = (await db.query("insert into payment_methods(name) values ('Bonifico') returning id")).rows[0].id;
    const values = { description: "Adobe", expense_category_id: category, supplier: "Adobe", net_amount_cents: 3000, vat_amount_cents: 0, payment_method_id: method, frequency: "monthly", start_date: "2025-01-01", end_date: null, is_active: true, marketing_service_type_id: null, marketing_campaign_year: null, notes: null };
    const save = async (input, id = null, confirm = null, today = "2025-02-15") => (await db.query("select save_recurring_expense_rule($1::jsonb, $2::uuid, $3::int, $4::date) as id", [JSON.stringify(input), id, confirm, today])).rows[0].id;
    let rule;
    await context.test("backdated creation requires confirmation and leaves no partial rule", async () => {
      await assert.rejects(save(values), error => error.code === "P0001" && error.detail === "2");
      assert.equal((await db.query("select count(*)::int as count from recurring_expense_rules")).rows[0].count, 0);
      rule = await save(values, null, 2);
      assert.equal((await db.query("select count(*)::int as count from expenses")).rows[0].count, 2);
    });
    await context.test("editing a rule leaves old amounts and changes only future occurrences", async () => {
      await save({ ...values, net_amount_cents: 3500 }, rule);
      await db.query("select materialize_due_recurring_expenses($1, '2025-03-10')", [rule]);
      const rows = (await db.query("select paid_date::text, net_amount_cents from expenses order by paid_date")).rows;
      assert.deepEqual(rows.map(row => row.net_amount_cents), [3000, 3000, 3500]);
      assert.deepEqual(rows.map(row => row.paid_date), ["2025-01-01", "2025-02-01", "2025-03-01"]);
    });
    await context.test("repeated generation is idempotent and deleted occurrences do not reappear", async () => {
      await db.query("select materialize_due_recurring_expenses($1, '2025-03-10')", [rule]);
      assert.equal((await db.query("select count(*)::int as count from expenses")).rows[0].count, 3);
      await db.exec("delete from expenses where paid_date = '2025-02-01'");
      await db.query("select materialize_due_recurring_expenses($1, '2025-03-10')", [rule]);
      assert.equal((await db.query("select count(*)::int as count from expenses")).rows[0].count, 2);
      await assert.rejects(db.query("insert into expenses(description, expense_category_id, paid_date, net_amount_cents, vat_amount_cents, payment_method_id, recurring_rule_id, recurring_occurrence_date) values ('duplicate',$1,'2025-03-01',3500,0,$2,$3,'2025-03-01')", [category, method, rule]), error => error.code === "23505");
    });
    await context.test("snapshot names survive renames and unrelated expense edits", async () => {
      await db.query("update expense_categories set name = 'Software rinominato' where id = $1", [category]);
      await db.query("update payment_methods set name = 'Bonifico rinominato' where id = $1", [method]);
      await db.exec("update expenses set notes = 'Correzione', net_amount_cents = 3100 where paid_date = '2025-01-01'");
      const row = (await db.query("select * from expenses where paid_date = '2025-01-01'")).rows[0];
      assert.equal(row.category_name_snapshot, "Software e abbonamenti"); assert.equal(row.payment_method_name_snapshot, "Bonifico");
      assert.equal(row.net_amount_cents, 3100);
    });
    await context.test("disabling a rule preserves history and resuming skips paused dates", async () => {
      await save({ ...values, is_active: false }, rule, null, "2025-03-10");
      await db.query("select materialize_due_recurring_expenses($1, '2025-05-10')", [rule]);
      assert.equal((await db.query("select count(*)::int as count from expenses")).rows[0].count, 2);
      await save(values, rule, null, "2025-05-10");
      await db.query("select materialize_due_recurring_expenses($1, '2025-06-10')", [rule]);
      assert.equal((await db.query("select count(*)::int as count from expenses")).rows[0].count, 3);
      assert.equal((await db.query("select count(*)::int as count from expenses where paid_date in ('2025-04-01','2025-05-01')")).rows[0].count, 0);
    });
    await context.test("SQL schedule stays anchored on day 31, quarterly and leap-year yearly", async () => {
      const dates = async (start, frequency, end) => (await db.query("select occurrence_date::text as date from expense_occurrence_dates($1, null, $2, null, $3)", [start, frequency, end])).rows.map(row => row.date);
      assert.deepEqual(await dates("2025-01-31", "monthly", "2025-03-31"), ["2025-01-31", "2025-02-28", "2025-03-31"]);
      assert.deepEqual(await dates("2025-01-31", "quarterly", "2025-07-31"), ["2025-01-31", "2025-04-30", "2025-07-31"]);
      assert.deepEqual(await dates("2024-02-29", "yearly", "2025-03-01"), ["2024-02-29", "2025-02-28"]);
    });
    await context.test("future materialization, zero totals and negative VAT rejected", async () => {
      await assert.rejects(db.query("select materialize_due_recurring_expenses(null, current_date + 3)"), error => error.code === "22023");
      for (const [net, vat] of [[0, 0], [100, -1], [1000000000, 1]]) await assert.rejects(db.query("insert into expenses(description,expense_category_id,paid_date,net_amount_cents,vat_amount_cents,payment_method_id) values ('Invalid',$1,'2025-01-01',$2,$3,$4)", [category, net, vat, method]), error => error.code === "23514");
    });
    await context.test("inactive category and system method rejected for new manual expense", async () => {
      await db.query("update expense_categories set is_active = false where id = $1", [category]);
      await assert.rejects(db.query("insert into expenses(description,expense_category_id,paid_date,net_amount_cents,vat_amount_cents,payment_method_id) values ('Invalid',$1,'2025-01-01',100,0,$2)", [category, method]), error => error.code === "23514");
      await db.query("update expense_categories set is_active = true where id = $1", [category]);
      const gift = (await db.query("insert into payment_methods(name,is_system) values ('Buono regalo',true) returning id")).rows[0].id;
      await assert.rejects(db.query("insert into expenses(description,expense_category_id,paid_date,net_amount_cents,vat_amount_cents,payment_method_id) values ('Invalid',$1,'2025-01-01',100,0,$2)", [category, gift]), error => error.code === "23514");
    });
    await context.test("create, update and delete use existing audit log; categories referenced cannot be deleted", async () => {
      const actions = (await db.query("select distinct action from audit_log where table_name = 'expenses'")).rows.map(row => row.action).sort();
      assert.deepEqual(actions, ["delete", "insert", "update"]);
      await assert.rejects(db.query("delete from expense_categories where id = $1", [category]), error => ["23503", "23001"].includes(error.code));
      await assert.rejects(db.query("update expense_categories set kind = 'tax_contribution' where id = $1", [category]), error => error.code === "23514");
    });
    await context.test("failed rule edit rolls back both due generation and cursor advancement", async () => {
      const before = (await db.query("select processed_through::text from recurring_expense_rules where id = $1", [rule])).rows[0].processed_through;
      await assert.rejects(save({ ...values, net_amount_cents: -1 }, rule, null, "2025-07-10"), error => error.code === "23514");
      assert.equal((await db.query("select count(*)::int as count from expenses where paid_date = '2025-07-01'")).rows[0].count, 0);
      assert.equal((await db.query("select processed_through::text from recurring_expense_rules where id = $1", [rule])).rows[0].processed_through, before);
    });
    await context.test("queued repeated materialization calls create exactly one occurrence", async () => {
      const results = await Promise.all(Array.from({ length: 5 }, () => db.query("select materialize_due_recurring_expenses($1, '2025-07-10') as added", [rule])));
      assert.equal(results.reduce((sum, result) => sum + result.rows[0].added, 0), 1);
      assert.equal((await db.query("select count(*)::int as count from expenses where paid_date = '2025-07-01'")).rows[0].count, 1);
    });
    await context.test("recurrence end date is inclusive and never generates beyond it", async () => {
      const rows = (await db.query("select occurrence_date::text from expense_occurrence_dates('2025-01-15', '2025-02-15', 'monthly', null, '2025-06-01')")).rows;
      assert.deepEqual(rows.map(row => row.occurrence_date), ["2025-01-15", "2025-02-15"]);
    });
    await context.test("anonymous access to expenses and RPC is denied", async () => {
      await db.exec("set role anon");
      await assert.rejects(db.query("select * from expenses"), error => error.code === "42501");
      await assert.rejects(db.query("select materialize_due_recurring_expenses()"), error => error.code === "42501");
      await db.exec("reset role");
    });
  } finally { await db.close(); }
});