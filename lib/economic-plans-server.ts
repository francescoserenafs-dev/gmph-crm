import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseLocalDateTime } from "@/lib/datetime";
import { buildPlanServices, computePlanTotals, computeVoucherPlanTotals, paymentDateKey, voucherCreditCents, type ActivePackage, type EconomicPayment, type EconomicPlan, type EconomicSession, type EconomicVoucher, type PlanService } from "@/lib/economic-plans";

const PAGE_SIZE = 1000;

export async function loadPaged<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await build(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

type EconomicSessionRow = {
  scheduled_at: string;
  service_type_id: string;
  service_name: string;
  agreed_price_cents: number;
  current_stage: { code: string } | null;
  service: { is_addon: boolean } | null;
  extras: { line_total_cents: number }[];
  payments: { amount_cents: number; category: string; applied_voucher_id: string | null }[];
};

const yearBounds = (year: number) => ({
  start: parseLocalDateTime(`${year}-01-01T00:00`).toISOString(),
  end: parseLocalDateTime(`${year + 1}-01-01T00:00`).toISOString(),
});

// Sessioni dell'anno (confini Europe/Rome): unica fonte del valore servizi per Home e Analisi -> Economico.
export async function loadEconomicSessions(year: number): Promise<EconomicSession[]> {
  const { start, end } = yearBounds(year);
  const rows = await loadPaged<EconomicSessionRow>((from, to) => supabaseAdmin
    .from("sessions")
    .select("scheduled_at, service_type_id, service_name, agreed_price_cents, current_stage:session_stages!sessions_current_stage_id_fkey(code), service:service_types(is_addon), extras:session_extras(line_total_cents), payments(amount_cents, category, applied_voucher_id)")
    .gte("scheduled_at", start)
    .lt("scheduled_at", end)
    .order("scheduled_at")
    .range(from, to));
  return rows.map((row) => ({
    scheduledAt: row.scheduled_at,
    serviceTypeId: row.service_type_id,
    serviceName: row.service_name,
    isAddonService: row.service?.is_addon === true,
    agreedPriceCents: row.agreed_price_cents,
    extrasCents: (row.extras ?? []).reduce((sum, extra) => sum + extra.line_total_cents, 0),
    payments: (row.payments ?? []).map((payment) => ({ amountCents: payment.amount_cents, category: payment.category, appliedVoucherId: payment.applied_voucher_id })),
    isCancelled: row.current_stage?.code === "cancelled",
  }));
}

type EconomicPaymentRow = {
  amount_cents: number;
  paid_date: string | null;
  paid_at: string | null;
  category: string;
  payment_method_name: string;
  applied_voucher_id: string | null;
  voucher_id: string | null;
  session_id: string | null;
  session: { scheduled_at: string; service_name: string } | null;
};

// Pagamenti per data di pagamento (paid_date, gia in Europe/Rome): base della cassa e dei riscatti per data.
export async function loadEconomicPayments(year: number): Promise<EconomicPayment[]> {
  const rows = await loadPaged<EconomicPaymentRow>((from, to) => supabaseAdmin
    .from("payments")
    .select("amount_cents, paid_date, paid_at, category, payment_method_name, applied_voucher_id, voucher_id, session_id, session:sessions!payments_session_id_fkey(scheduled_at, service_name)")
    .gte("paid_date", `${year}-01-01`)
    .lt("paid_date", `${year + 1}-01-01`)
    .order("paid_date")
    .range(from, to));
  return rows.map((row) => ({
    amountCents: row.amount_cents,
    paidDate: row.paid_date,
    paidAt: row.paid_at,
    category: row.category,
    methodName: row.payment_method_name,
    appliedVoucherId: row.applied_voucher_id,
    voucherId: row.voucher_id,
    sessionId: row.session_id,
    sessionScheduledAt: row.session?.scheduled_at ?? null,
    sessionServiceName: row.session?.service_name ?? null,
  }));
}

type EconomicVoucherRow = {
  id: string;
  status: string;
  is_complimentary: boolean;
  voucher_type: string;
  value_cents: number | null;
  purchase_price_cents: number;
  purchases: { paid_date: string | null; paid_at: string | null; category: string }[];
};

// Tutti i buoni con le date dei pagamenti voucher_purchase: servono a classificare i riscatti di qualsiasi anno.
export async function loadEconomicVouchers(): Promise<EconomicVoucher[]> {
  const rows = await loadPaged<EconomicVoucherRow>((from, to) => supabaseAdmin
    .from("gift_vouchers")
    .select("id, status, is_complimentary, voucher_type, value_cents, purchase_price_cents, purchases:payments!payments_voucher_id_fkey(paid_date, paid_at, category)")
    .order("created_at")
    .range(from, to));
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    isComplimentary: row.is_complimentary,
    creditCents: voucherCreditCents(row),
    purchaseDates: (row.purchases ?? [])
      .filter((payment) => payment.category === "voucher_purchase")
      .map((payment) => paymentDateKey({ paidDate: payment.paid_date, paidAt: payment.paid_at })),
  }));
}

export async function loadEconomicDataset(year: number) {
  const [sessions, payments, vouchers] = await Promise.all([loadEconomicSessions(year), loadEconomicPayments(year), loadEconomicVouchers()]);
  return { sessions, payments, vouchers };
}

const MAX_CENTS = 1_000_000_000;
const MAX_MONTHLY_SESSIONS = 10_000;
const MAX_MONTHLY_VOUCHERS = 10_000;
const MAX_TICKET_CENTS = 10_000_000;

type PlanRow = {
  id: string;
  year: number;
  notes: string | null;
  planned_voucher_ticket_cents: number;
  services: { service_type_id: string; planned_ticket_cents: number }[];
  service_months: { service_type_id: string; month: number; target_sessions: number }[];
  voucher_months: { month: number; target_count: number }[];
};

export function parseYear(value: unknown): number | null {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}

const isAmount = (value: unknown, max: number): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;

export async function loadPlan(year: number): Promise<{ id: string; plan: EconomicPlan } | null> {
  const { data, error } = await supabaseAdmin
    .from("annual_economic_plans")
    .select("id, year, notes, planned_voucher_ticket_cents, services:economic_plan_service_targets(service_type_id, planned_ticket_cents), service_months:economic_plan_monthly_service_targets(service_type_id, month, target_sessions), voucher_months:economic_plan_monthly_voucher_targets(month, target_count)")
    .eq("year", year)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as PlanRow;
  const monthlyCounts = Array.from({ length: 12 }, () => 0);
  for (const cell of row.voucher_months ?? []) {
    if (cell.month >= 1 && cell.month <= 12) monthlyCounts[cell.month - 1] = cell.target_count;
  }
  return {
    id: row.id,
    plan: {
      year: row.year,
      notes: row.notes,
      services: buildPlanServices(row.services, row.service_months ?? []),
      voucherPlan: { plannedTicketCents: row.planned_voucher_ticket_cents ?? 0, monthlyCounts },
    },
  };
}

export async function loadPlanYears(): Promise<number[]> {
  const { data, error } = await supabaseAdmin.from("annual_economic_plans").select("year").order("year", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => row.year);
}

// Listino attuale: solo pacchetti attivi con prezzo configurato in /pacchetti.
export async function loadActivePackages(): Promise<ActivePackage[]> {
  const { data, error } = await supabaseAdmin
    .from("session_packages")
    .select("service_type_id, name, price_cents")
    .eq("is_active", true)
    .not("price_cents", "is", null)
    .order("sort_order")
    .order("price_cents");
  if (error) throw error;
  return (data ?? []).map((row) => ({ serviceTypeId: row.service_type_id, name: row.name, priceCents: row.price_cents as number }));
}

export type PlanPayload = Omit<EconomicPlan, "year">;

// Solo dati canonici: i totali (sessioni, valori, mesi, anno) non vengono mai accettati dal client ne salvati.
export async function parsePlanPayload(body: unknown): Promise<PlanPayload | string> {
  if (!body || typeof body !== "object") return "Dati del piano non validi.";
  const input = body as Record<string, unknown>;
  const notes = typeof input.notes === "string" && input.notes.trim() ? input.notes.trim().slice(0, 2000) : null;

  if (!Array.isArray(input.services)) return "Servizi del piano non validi.";
  const services: PlanService[] = [];
  for (const entry of input.services as Record<string, unknown>[]) {
    const serviceTypeId = typeof entry?.serviceTypeId === "string" ? entry.serviceTypeId : "";
    if (!serviceTypeId || services.some((item) => item.serviceTypeId === serviceTypeId)) return "Ogni servizio puo comparire una sola volta nel piano.";
    if (!isAmount(entry.plannedTicketCents, MAX_TICKET_CENTS)) return "Il ticket medio pianificato deve essere un importo valido.";
    const monthlySessions = entry.monthlySessions;
    if (!Array.isArray(monthlySessions) || monthlySessions.length !== 12 || !monthlySessions.every((value) => isAmount(value, MAX_MONTHLY_SESSIONS))) return "Le sessioni mensili devono essere 12 numeri interi maggiori o uguali a 0.";
    services.push({ serviceTypeId, plannedTicketCents: entry.plannedTicketCents, monthlySessions: monthlySessions as number[] });
  }
  if (computePlanTotals(services).totalValueCents > MAX_CENTS) return "Il valore servizi pianificato risultante e troppo alto.";

  const voucherInput = input.voucherPlan as Record<string, unknown> | undefined;
  if (!voucherInput || typeof voucherInput !== "object") return "Piano vendite buoni non valido.";
  if (!isAmount(voucherInput.plannedTicketCents, MAX_TICKET_CENTS)) return "Il ticket medio buono deve essere un importo valido.";
  const monthlyCounts = voucherInput.monthlyCounts;
  if (!Array.isArray(monthlyCounts) || monthlyCounts.length !== 12 || !monthlyCounts.every((value) => isAmount(value, MAX_MONTHLY_VOUCHERS))) return "I buoni previsti per mese devono essere 12 numeri interi maggiori o uguali a 0.";
  const voucherPlan = { plannedTicketCents: voucherInput.plannedTicketCents, monthlyCounts: monthlyCounts as number[] };
  if (computeVoucherPlanTotals(voucherPlan).totalValueCents > MAX_CENTS) return "Le vendite buoni previste risultanti sono troppo alte.";

  if (services.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("service_types")
      .select("id")
      .in("id", services.map((entry) => entry.serviceTypeId))
      .eq("is_addon", false);
    if (error) return "Verifica dei servizi non riuscita.";
    if ((data ?? []).length !== services.length) return "Uno o piu servizi non sono validi.";
  }

  return { notes, services, voucherPlan };
}

export const EMPTY_PLAN_PAYLOAD: PlanPayload = { notes: null, services: [], voucherPlan: { plannedTicketCents: 0, monthlyCounts: Array.from({ length: 12 }, () => 0) } };

export type SavePlanResult = { ok: true } | { ok: false; status: number; error: string };

// Unica transazione DB (RPC save_economic_plan): o si salva tutto il piano o niente.
export async function savePlanAtomic(year: number, create: boolean, payload: PlanPayload): Promise<SavePlanResult> {
  const { error } = await supabaseAdmin.rpc("save_economic_plan", {
    p_year: year,
    p_create: create,
    p_notes: payload.notes,
    p_services: payload.services.map((entry) => ({ service_type_id: entry.serviceTypeId, planned_ticket_cents: entry.plannedTicketCents })),
    p_service_months: payload.services.flatMap((entry) => entry.monthlySessions.map((sessions, index) => ({ service_type_id: entry.serviceTypeId, month: index + 1, target_sessions: sessions }))),
    p_voucher_ticket_cents: payload.voucherPlan.plannedTicketCents,
    p_voucher_months: payload.voucherPlan.monthlyCounts.map((count, index) => ({ month: index + 1, target_count: count })),
  });
  if (!error) return { ok: true };
  if (error.code === "23505") return { ok: false, status: 409, error: `Esiste gia un piano ${year}.` };
  if (error.code === "P0002") return { ok: false, status: 404, error: `Nessun piano ${year}.` };
  if (error.code === "23514" || error.code === "23503" || error.code === "22023" || error.code === "22003") return { ok: false, status: 400, error: "Dati del piano non validi: nessuna modifica e stata salvata." };
  return { ok: false, status: 500, error: "Salvataggio non riuscito: nessuna modifica e stata applicata." };
}

// Valore servizi pianificato dell'anno, null se il Piano non esiste. Nessun ripiego su app_settings.annual_budget_cents (legacy, non piu usato).
export async function getPlannedServiceValueForYear(year: number): Promise<number | null> {
  const loaded = await loadPlan(year);
  return loaded ? computePlanTotals(loaded.plan.services).totalValueCents : null;
}
