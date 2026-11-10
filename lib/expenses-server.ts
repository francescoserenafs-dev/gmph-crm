import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toLocalDateKey } from "@/lib/datetime";
import { loadEconomicPayments, loadEconomicSessions, loadPaged, parseYear } from "@/lib/economic-plans-server";
import type { EconomicPayment } from "@/lib/economic-plans";
import { computeCostAnalytics, parseExpenseValues, parseRecurringSchedule, validExpenseDate, validateExpenseReferences, type CostSession, type Expense, type ExpenseCategory, type ExpenseMethod, type ExpenseOptions, type ExpenseService, type ExpenseValues, type RecurringExpenseRule } from "@/lib/expenses";

export class ExpenseRequestError extends Error {
  status: number;
  confirmationCount?: number;
  constructor(message: string, status = 400, confirmationCount?: number) {
    super(message); this.status = status; this.confirmationCount = confirmationCount;
  }
}

export function expenseErrorResponse(error: unknown) {
  if (error instanceof ExpenseRequestError) return NextResponse.json({ error: error.message, confirmationCount: error.confirmationCount }, { status: error.status });
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (["42P01", "PGRST202", "PGRST205"].includes(code)) return NextResponse.json({ error: "Gestione costi non ancora disponibile: applicare la migrazione del database." }, { status: 503 });
  if (code === "P0002") return NextResponse.json({ error: "Elemento non trovato." }, { status: 404 });
  if (code === "23505") return NextResponse.json({ error: "Esiste gia una voce con questi dati." }, { status: 409 });
  if (["23514", "23503", "23001", "22023", "22P02"].includes(code)) return NextResponse.json({ error: "Dati non validi o riferimenti non disponibili. Nessuna modifica salvata." }, { status: 400 });
  return NextResponse.json({ error: "Operazione sui costi non riuscita. Riprova." }, { status: 500 });
}

export function expenseYear(value: string | null): number {
  if (value === null || value === "") return Number(toLocalDateKey(new Date()).slice(0, 4));
  const year = parseYear(value);
  if (year === null) throw new ExpenseRequestError("Anno non valido (2000-2100).");
  return year;
}

export async function materializeDueRecurringExpenses() {
  const { error } = await supabaseAdmin.rpc("materialize_due_recurring_expenses");
  if (error) throw error;
}

export async function loadExpenseOptions(): Promise<ExpenseOptions> {
  const [categories, methods, services] = await Promise.all([
    loadPaged<ExpenseCategory>((from, to) => supabaseAdmin.from("expense_categories").select("id,name,kind,is_marketing,is_active,sort_order").order("sort_order").order("id").range(from, to)),
    loadPaged<ExpenseMethod>((from, to) => supabaseAdmin.from("payment_methods").select("id,name,is_active,is_system").eq("is_system", false).order("sort_order").order("id").range(from, to)),
    loadPaged<ExpenseService>((from, to) => supabaseAdmin.from("service_types").select("id,name,is_active,is_addon").eq("is_addon", false).order("sort_order").order("id").range(from, to)),
  ]);
  return { categories, methods, services };
}

export async function loadExpenses(year: number): Promise<Expense[]> {
  return loadPaged<Expense>((from, to) => supabaseAdmin.from("expenses").select("*").gte("paid_date", `${year}-01-01`).lt("paid_date", `${year + 1}-01-01`).order("paid_date", { ascending: false }).order("id").range(from, to));
}

export async function loadCostAnalytics(year: number, dataset?: { sessions: CostSession[]; payments: EconomicPayment[] }, now = new Date()) {
  await materializeDueRecurringExpenses();
  const [expenses, marketing, sessions, payments] = await Promise.all([
    loadExpenses(year),
    loadPaged<Expense>((from, to) => supabaseAdmin.from("expenses").select("*").eq("marketing_campaign_year", year).not("marketing_service_type_id", "is", null).order("id").range(from, to)),
    dataset ? Promise.resolve(dataset.sessions) : loadEconomicSessions(year),
    dataset ? Promise.resolve(dataset.payments) : loadEconomicPayments(year),
  ]);
  return computeCostAnalytics({ year, now, sessions, payments, expenses: Array.from(new Map([...expenses, ...marketing].map((row) => [row.id, row])).values()) });
}

export async function validatedExpenseValues(body: unknown, existing?: ExpenseValues) {
  const values = parseExpenseValues(body);
  if (typeof values === "string") throw new ExpenseRequestError(values);
  const options = await loadExpenseOptions();
  if (existing) {
    options.categories = options.categories.map((row) => row.id === existing.expense_category_id ? { ...row, is_active: true } : row);
    options.methods = options.methods.map((row) => row.id === existing.payment_method_id ? { ...row, is_active: true } : row);
    options.services = options.services.map((row) => row.id === existing.marketing_service_type_id ? { ...row, is_active: true } : row);
  }
  const error = validateExpenseReferences(values, options);
  if (error) throw new ExpenseRequestError(error);
  return values;
}

async function loadExistingExpenseValues(table: "expenses" | "recurring_expense_rules", id: string) {
  const { data, error } = await supabaseAdmin.from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new ExpenseRequestError("Elemento non trovato.", 404);
  return data as ExpenseValues;
}

export async function saveExpense(body: unknown, id?: string) {
  const values = await validatedExpenseValues(body, id ? await loadExistingExpenseValues("expenses", id) : undefined);
  const paidDate = (body as Record<string, unknown>).paid_date;
  if (!validExpenseDate(paidDate) || paidDate > toLocalDateKey(new Date())) throw new ExpenseRequestError("Indica una data pagamento valida, non futura.");
  const row = { ...values, paid_date: paidDate };
  const query = id ? supabaseAdmin.from("expenses").update(row).eq("id", id) : supabaseAdmin.from("expenses").insert(row);
  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw error;
  if (!data) throw new ExpenseRequestError("Costo non trovato.", 404);
  return data as Expense;
}

export async function deleteExpense(id: string) {
  const { data, error } = await supabaseAdmin.from("expenses").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new ExpenseRequestError("Costo non trovato.", 404);
}

export async function listRecurringExpenses() {
  await materializeDueRecurringExpenses();
  return loadPaged<RecurringExpenseRule>((from, to) => supabaseAdmin.from("recurring_expense_rules").select("*").order("created_at", { ascending: false }).order("id").range(from, to));
}

export async function saveRecurringExpense(body: unknown, id?: string) {
  if (!body || typeof body !== "object") throw new ExpenseRequestError("Dati ricorrenza non validi.");
  const input = body as Record<string, unknown>;
  let values;
  if (id && Object.keys(input).length === 1 && typeof input.is_active === "boolean") {
    const { data, error } = await supabaseAdmin.from("recurring_expense_rules").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) throw new ExpenseRequestError("Ricorrenza non trovata.", 404);
    const parsed = parseExpenseValues(data);
    const schedule = parseRecurringSchedule(data);
    if (typeof parsed === "string" || typeof schedule === "string") throw new ExpenseRequestError("Ricorrenza non valida.");
    values = { ...parsed, ...schedule, is_active: input.is_active };
  } else {
    const parsed = await validatedExpenseValues(body, id ? await loadExistingExpenseValues("recurring_expense_rules", id) : undefined);
    const schedule = parseRecurringSchedule(input);
    if (typeof schedule === "string") throw new ExpenseRequestError(schedule);
    values = { ...parsed, ...schedule };
  }
  const confirmation = Number.isInteger(input.confirmationCount) && (input.confirmationCount as number) >= 0 ? input.confirmationCount as number : null;
  const { data, error } = await supabaseAdmin.rpc("save_recurring_expense_rule", { p_values: values, p_id: id ?? null, p_confirm_count: confirmation });
  if (error?.code === "P0001" && /^\d+$/.test(error.details ?? "")) throw new ExpenseRequestError(`Questa ricorrenza generera ${error.details} costi gia maturati. Continuare?`, 409, Number(error.details));
  if (error) throw error;
  return data as string;
}

export async function saveExpenseCategory(body: unknown, id?: string) {
  if (!body || typeof body !== "object") throw new ExpenseRequestError("Dati categoria non validi.");
  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 100) throw new ExpenseRequestError("Nome categoria obbligatorio, massimo 100 caratteri.");
  if (!Number.isInteger(input.sort_order) || (input.sort_order as number) < 0 || (input.sort_order as number) > 10000) throw new ExpenseRequestError("Ordine non valido (0-10000).");
  if (typeof input.is_active !== "boolean") throw new ExpenseRequestError("Stato categoria non valido.");
  if (!id && input.kind !== "operating" && input.kind !== "tax_contribution") throw new ExpenseRequestError("Tipo categoria non valido.");
  const values = { name, sort_order: input.sort_order as number, is_active: input.is_active, ...(!id ? { kind: input.kind as string } : {}) };
  const query = id ? supabaseAdmin.from("expense_categories").update(values).eq("id", id) : supabaseAdmin.from("expense_categories").insert(values);
  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw error;
  if (!data) throw new ExpenseRequestError("Categoria non trovata.", 404);
  return data;
}