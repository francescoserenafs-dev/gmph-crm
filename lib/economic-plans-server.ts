import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveAnnualTarget, type EconomicPlan, type MonthlyTarget, type ServiceTarget } from "@/lib/economic-plans";

const MAX_CENTS = 1_000_000_000;
const MAX_SESSIONS = 100_000;

type PlanRow = {
  id: string;
  year: number;
  annual_target_cents: number;
  expected_uplift_cents: number;
  notes: string | null;
  monthly: { month: number; target_cents: number }[];
  services: { service_type_id: string; target_sessions: number; target_value_cents: number }[];
};

export function parseYear(value: unknown): number | null {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}

const isAmount = (value: unknown, max: number): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;

export async function loadPlan(year: number): Promise<{ id: string; plan: EconomicPlan } | null> {
  const { data, error } = await supabaseAdmin
    .from("annual_economic_plans")
    .select("id, year, annual_target_cents, expected_uplift_cents, notes, monthly:economic_plan_monthly_targets(month, target_cents), services:economic_plan_service_targets(service_type_id, target_sessions, target_value_cents)")
    .eq("year", year)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as PlanRow;
  const monthly = new Map(row.monthly.map((entry) => [entry.month, entry.target_cents]));
  return {
    id: row.id,
    plan: {
      year: row.year,
      annualTargetCents: row.annual_target_cents,
      expectedUpliftCents: row.expected_uplift_cents,
      notes: row.notes,
      monthlyTargets: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, targetCents: monthly.get(index + 1) ?? 0 })),
      serviceTargets: row.services.map((entry) => ({ serviceTypeId: entry.service_type_id, targetSessions: entry.target_sessions, targetValueCents: entry.target_value_cents })),
    },
  };
}

export async function loadPlanYears(): Promise<number[]> {
  const { data, error } = await supabaseAdmin.from("annual_economic_plans").select("year").order("year", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => row.year);
}

export type PlanPayload = Omit<EconomicPlan, "year">;

export async function parsePlanPayload(body: unknown): Promise<PlanPayload | string> {
  if (!body || typeof body !== "object") return "Dati del piano non validi.";
  const input = body as Record<string, unknown>;
  if (!isAmount(input.annualTargetCents, MAX_CENTS)) return "Il target annuale deve essere un importo valido.";
  if (!isAmount(input.expectedUpliftCents, MAX_CENTS)) return "L'uplift atteso deve essere un importo valido.";
  const notes = typeof input.notes === "string" && input.notes.trim() ? input.notes.trim().slice(0, 2000) : null;

  if (!Array.isArray(input.monthlyTargets) || input.monthlyTargets.length !== 12) return "Servono 12 target mensili.";
  const monthlyTargets: MonthlyTarget[] = [];
  for (const entry of input.monthlyTargets as Record<string, unknown>[]) {
    const month = Number(entry?.month);
    if (!Number.isInteger(month) || month < 1 || month > 12 || monthlyTargets.some((item) => item.month === month)) return "Mese non valido.";
    if (!isAmount(entry.targetCents, MAX_CENTS)) return "I target mensili devono essere importi validi.";
    monthlyTargets.push({ month, targetCents: entry.targetCents });
  }

  if (!Array.isArray(input.serviceTargets)) return "Target per servizio non validi.";
  const serviceTargets: ServiceTarget[] = [];
  for (const entry of input.serviceTargets as Record<string, unknown>[]) {
    const serviceTypeId = typeof entry?.serviceTypeId === "string" ? entry.serviceTypeId : "";
    if (!serviceTypeId || serviceTargets.some((item) => item.serviceTypeId === serviceTypeId)) return "Ogni servizio puo comparire una sola volta nel piano.";
    if (!isAmount(entry.targetSessions, MAX_SESSIONS)) return "Le sessioni target devono essere un numero intero valido.";
    if (!isAmount(entry.targetValueCents, MAX_CENTS)) return "Il valore target deve essere un importo valido.";
    serviceTargets.push({ serviceTypeId, targetSessions: entry.targetSessions, targetValueCents: entry.targetValueCents });
  }

  if (serviceTargets.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("service_types")
      .select("id")
      .in("id", serviceTargets.map((entry) => entry.serviceTypeId))
      .eq("is_addon", false);
    if (error) return "Verifica dei servizi non riuscita.";
    if ((data ?? []).length !== serviceTargets.length) return "Uno o piu servizi non sono validi.";
  }

  return {
    annualTargetCents: input.annualTargetCents,
    expectedUpliftCents: input.expectedUpliftCents,
    notes,
    monthlyTargets,
    serviceTargets,
  };
}

export const EMPTY_PLAN_PAYLOAD: PlanPayload = {
  annualTargetCents: 0,
  expectedUpliftCents: 0,
  notes: null,
  monthlyTargets: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, targetCents: 0 })),
  serviceTargets: [],
};

export type SavePlanResult = { ok: true } | { ok: false; status: number; error: string };

// Unica transazione DB (RPC save_economic_plan): o si salva tutto il piano o niente.
export async function savePlanAtomic(year: number, create: boolean, payload: PlanPayload): Promise<SavePlanResult> {
  const { error } = await supabaseAdmin.rpc("save_economic_plan", {
    p_year: year,
    p_create: create,
    p_annual_target_cents: payload.annualTargetCents,
    p_expected_uplift_cents: payload.expectedUpliftCents,
    p_notes: payload.notes,
    p_monthly: payload.monthlyTargets.map((entry) => ({ month: entry.month, target_cents: entry.targetCents })),
    p_services: payload.serviceTargets.map((entry) => ({ service_type_id: entry.serviceTypeId, target_sessions: entry.targetSessions, target_value_cents: entry.targetValueCents })),
  });
  if (!error) return { ok: true };
  if (error.code === "23505") return { ok: false, status: 409, error: `Esiste gia un piano ${year}.` };
  if (error.code === "P0002") return { ok: false, status: 404, error: `Nessun piano ${year}.` };
  if (error.code === "23514" || error.code === "23503" || error.code === "22023") return { ok: false, status: 400, error: "Dati del piano non validi: nessuna modifica e stata salvata." };
  return { ok: false, status: 500, error: "Salvataggio non riuscito: nessuna modifica e stata applicata." };
}

// Target annuale per la Home: Piano Economico dell'anno se esiste, altrimenti il budget legacy di app_settings.
export async function getAnnualTargetForYear(year: number): Promise<{ targetCents: number; source: "plan" | "legacy_budget" }> {
  const [plan, settings] = await Promise.all([
    supabaseAdmin.from("annual_economic_plans").select("annual_target_cents").eq("year", year).maybeSingle(),
    supabaseAdmin.from("app_settings").select("annual_budget_cents").eq("id", true).maybeSingle(),
  ]);
  if (settings.error && !plan.data) throw settings.error;
  return resolveAnnualTarget(plan.data?.annual_target_cents ?? null, settings.data?.annual_budget_cents ?? null);
}
