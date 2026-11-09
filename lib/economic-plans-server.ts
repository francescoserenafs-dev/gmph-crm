import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseLocalDateTime } from "@/lib/datetime";
import { buildPlanServices, computePlanTotals, resolveAnnualTarget, type ActivePackage, type EconomicPlan, type EconomicSession, type PlanService } from "@/lib/economic-plans";

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
  extras: { line_total_cents: number }[];
  payments: { amount_cents: number }[];
};

// Sessioni dell'anno (confini Europe/Rome) nella forma usata da computeEconomicDashboard: unica fonte del valore commerciale.
export async function loadEconomicSessions(year: number): Promise<EconomicSession[]> {
  const start = parseLocalDateTime(`${year}-01-01T00:00`).toISOString();
  const end = parseLocalDateTime(`${year + 1}-01-01T00:00`).toISOString();
  const rows = await loadPaged<EconomicSessionRow>((from, to) => supabaseAdmin
    .from("sessions")
    .select("scheduled_at, service_type_id, service_name, agreed_price_cents, current_stage:session_stages!sessions_current_stage_id_fkey(code), extras:session_extras(line_total_cents), payments(amount_cents)")
    .gte("scheduled_at", start)
    .lt("scheduled_at", end)
    .order("scheduled_at")
    .range(from, to));
  return rows.map((row) => ({
    scheduledAt: row.scheduled_at,
    serviceTypeId: row.service_type_id,
    serviceName: row.service_name,
    agreedPriceCents: row.agreed_price_cents,
    extrasCents: (row.extras ?? []).reduce((sum, extra) => sum + extra.line_total_cents, 0),
    paidCents: (row.payments ?? []).reduce((sum, payment) => sum + payment.amount_cents, 0),
    isCancelled: row.current_stage?.code === "cancelled",
  }));
}

const MAX_CENTS = 1_000_000_000;
const MAX_MONTHLY_SESSIONS = 10_000;
const MAX_TICKET_CENTS = 10_000_000;

type PlanRow = {
  id: string;
  year: number;
  notes: string | null;
  services: { service_type_id: string; planned_ticket_cents: number }[];
  service_months: { service_type_id: string; month: number; target_sessions: number }[];
};

export function parseYear(value: unknown): number | null {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}

const isAmount = (value: unknown, max: number): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;

export async function loadPlan(year: number): Promise<{ id: string; plan: EconomicPlan } | null> {
  const { data, error } = await supabaseAdmin
    .from("annual_economic_plans")
    .select("id, year, notes, services:economic_plan_service_targets(service_type_id, planned_ticket_cents), service_months:economic_plan_monthly_service_targets(service_type_id, month, target_sessions)")
    .eq("year", year)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as PlanRow;
  return {
    id: row.id,
    plan: { year: row.year, notes: row.notes, services: buildPlanServices(row.services, row.service_months ?? []) },
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
  if (computePlanTotals(services).totalValueCents > MAX_CENTS) return "Il fatturato pianificato risultante e troppo alto.";

  if (services.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("service_types")
      .select("id")
      .in("id", services.map((entry) => entry.serviceTypeId))
      .eq("is_addon", false);
    if (error) return "Verifica dei servizi non riuscita.";
    if ((data ?? []).length !== services.length) return "Uno o piu servizi non sono validi.";
  }

  return { notes, services };
}

export const EMPTY_PLAN_PAYLOAD: PlanPayload = { notes: null, services: [] };

export type SavePlanResult = { ok: true } | { ok: false; status: number; error: string };

// Unica transazione DB (RPC save_economic_plan): o si salva tutto il piano o niente.
export async function savePlanAtomic(year: number, create: boolean, payload: PlanPayload): Promise<SavePlanResult> {
  const { error } = await supabaseAdmin.rpc("save_economic_plan", {
    p_year: year,
    p_create: create,
    p_notes: payload.notes,
    p_services: payload.services.map((entry) => ({ service_type_id: entry.serviceTypeId, planned_ticket_cents: entry.plannedTicketCents })),
    p_service_months: payload.services.flatMap((entry) => entry.monthlySessions.map((sessions, index) => ({ service_type_id: entry.serviceTypeId, month: index + 1, target_sessions: sessions }))),
  });
  if (!error) return { ok: true };
  if (error.code === "23505") return { ok: false, status: 409, error: `Esiste gia un piano ${year}.` };
  if (error.code === "P0002") return { ok: false, status: 404, error: `Nessun piano ${year}.` };
  if (error.code === "23514" || error.code === "23503" || error.code === "22023" || error.code === "22003") return { ok: false, status: 400, error: "Dati del piano non validi: nessuna modifica e stata salvata." };
  return { ok: false, status: 500, error: "Salvataggio non riuscito: nessuna modifica e stata applicata." };
}

// Target annuale per la Home: fatturato pianificato derivato dal Piano dell'anno, altrimenti il budget legacy di app_settings.
export async function getAnnualTargetForYear(year: number): Promise<{ targetCents: number; source: "plan" | "legacy_budget" }> {
  const [loaded, settings] = await Promise.all([
    loadPlan(year),
    supabaseAdmin.from("app_settings").select("annual_budget_cents").eq("id", true).maybeSingle(),
  ]);
  if (settings.error && !loaded) throw settings.error;
  return resolveAnnualTarget(loaded ? computePlanTotals(loaded.plan.services).totalValueCents : null, settings.data?.annual_budget_cents ?? null);
}
