export type SessionStage = {
  id: string;
  name: string;
  code: string;
};

export const PRINT_FULFILLMENT_STAGE_CODES = ["awaiting_print_selection", "print_selection_received", "prints_completed"] as const;

export function hasPrintExtras(extras: readonly { category_snapshot: string | null; quantity: number }[]): boolean {
  return extras.some((extra) => (extra.category_snapshot === "print" || extra.category_snapshot === "album") && extra.quantity > 0);
}

export function isExtraChangeBlockedBySession(currentStageCode: string | null | undefined, extras: readonly { category_snapshot: string | null; quantity: number }[]): boolean {
  if (currentStageCode === "cancelled") return false;
  return hasPrintExtras(extras) ? currentStageCode !== "prints_completed" : currentStageCode !== "delivered";
}

export function canUsePrintFulfillmentStages(currentStageCode: string | null | undefined, extras: readonly { category_snapshot: string | null; quantity: number }[]): boolean {
  return hasPrintExtras(extras) && (currentStageCode === "delivered" || (PRINT_FULFILLMENT_STAGE_CODES as readonly string[]).includes(currentStageCode ?? ""));
}


export type SessionClient = {
  id: string;
  first_name: string;
  last_name: string;
};

export type SessionPayment = {
  id: string;
  amount_cents: number;
  voucher_unused_cents: number;
  paid_at: string | null;
  paid_date: string | null;
  category: string;
  payment_method_name: string;
  applied_voucher_id: string | null;
  reference: string | null;
  notes: string | null;
};

export type SessionExtra = {
  id: string;
  service_type_id: string | null;
  extra_product_id: string | null;
  service_name: string;
  category_snapshot: string | null;
  price_cents: number;
  quantity: number;
  line_total_cents: number;
  unit_cost_cents: number | null;
  notes: string | null;
  created_at: string;
};

export type SessionStageHistory = {
  id: string;
  stage_name: string;
  changed_at: string;
  notes: string | null;
};

export type Session = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  service_name: string;
  service_detail: string | null;
  notes: string | null;
  agreed_price_cents: number;
  is_settled: boolean;
  image_consent_granted_at: string | null;
  image_consent_revoked_at: string | null;
  service_type_id: string;
  current_stage: SessionStage | null;
  client: SessionClient | null;
  payments: SessionPayment[];
  stage_history: SessionStageHistory[];
  extras: SessionExtra[];
};

export type SessionCreateInput = {
  clientId: string;
  serviceTypeId: string;
  scheduledAt: string;
  durationMinutes: number;
  priceEuros: number;
  location?: string | null;
  notes?: string | null;
  serviceDetail?: string | null;
  imageConsentGranted?: boolean;
};

export type SessionUpdateInput = {
  action: string;
  stageId?: string;
  changedAt?: string;
  notes?: string | null;
};

export type SessionExtra_CreateInput = {
  sessionId: string;
  serviceTypeId: string;
  serviceName: string;
  priceEuros: number;
  notes?: string | null;
};

/**
 * Calculate total amount due for a session (agreed price + extras)
 */
export function calculateSessionDue(session: { agreed_price_cents: number; extras: readonly { line_total_cents: number }[] }): number {
  const extrasCents = session.extras.reduce((sum, extra) => sum + extra.line_total_cents, 0);
  return session.agreed_price_cents + extrasCents;
}

/**
 * Calculate total amount paid for a session
 */
export function calculateSessionPaid(session: Session): number {
  return session.payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
}

export function calculateRemainingBalance(totalDueCents: number, totalPaidCents: number): number {
  return Math.max(totalDueCents - totalPaidCents, 0);
}

export function calculateVoucherApplication(voucherCreditCents: number, totalDueCents: number, totalPaidCents: number) {
  const remainingCents = calculateRemainingBalance(totalDueCents, totalPaidCents);
  const amountCents = Math.min(voucherCreditCents, remainingCents);
  return { amountCents, unusedCents: voucherCreditCents - amountCents, remainingCents };
}

/**
 * Determine payment status of a session
 */
export function getSessionPaymentStatus(session: Session): "paid" | "unpaid" | "partial" {
  return sessionPaymentStatus(session);
}

export type SessionPaymentStatus = "paid" | "unpaid" | "partial";

// Unica regola di stato pagamento: dovuto = prezzo + extra; denaro e riscatti buono coprono la sessione.
export function sessionPaymentStatus(session: { agreed_price_cents: number; extras: readonly { line_total_cents: number }[]; payments: readonly { amount_cents: number }[] }): SessionPaymentStatus {
  const totalDue = calculateSessionDue(session);
  const totalPaid = session.payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
  if (totalDue === 0) return "paid"; // Zero-price sessions auto-settle
  if (totalPaid === 0) return "unpaid";
  if (totalPaid < totalDue) return "partial";
  return "paid";
}

/* ---------------------------------------------------------------------------
 * Filtri globali della pagina /sessions: un solo stato, un solo universo di sessioni
 * per Lista, Pipeline, Calendario, Riepilogo e KPI.
 * ------------------------------------------------------------------------- */

export type SessionFilters = { clientId: string; serviceTypeIds: string[]; stageIds: string[]; paymentStatuses: string[]; day: string };

export const EMPTY_SESSION_FILTERS: SessionFilters = { clientId: "", serviceTypeIds: [], stageIds: [], paymentStatuses: [], day: "" };

const listParam = (params: { get(key: string): string | null }, key: string) => params.get(key)?.split(",").filter(Boolean) ?? [];
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export function parseSessionFilters(params: { get(key: string): string | null }): SessionFilters {
  const day = params.get("day") ?? "";
  return {
    clientId: params.get("clientId") ?? "",
    serviceTypeIds: listParam(params, "serviceTypeId"),
    stageIds: listParam(params, "stageId"),
    paymentStatuses: listParam(params, "paymentStatus"),
    day: DAY_PATTERN.test(day) ? day : "",
  };
}

// Parametri omessi quando hanno il valore di default, per URL leggibili.
export function writeSessionFilters(filters: SessionFilters, params: URLSearchParams): URLSearchParams {
  if (filters.clientId) params.set("clientId", filters.clientId);
  if (filters.serviceTypeIds.length > 0) params.set("serviceTypeId", filters.serviceTypeIds.join(","));
  if (filters.stageIds.length > 0) params.set("stageId", filters.stageIds.join(","));
  if (filters.paymentStatuses.length > 0) params.set("paymentStatus", filters.paymentStatuses.join(","));
  if (filters.day) params.set("day", filters.day);
  return params;
}

export function hasActiveSessionFilters(filters: SessionFilters): boolean {
  return Boolean(filters.clientId || filters.day) || filters.serviceTypeIds.length > 0 || filters.stageIds.length > 0 || filters.paymentStatuses.length > 0;
}

// Giorno di calendario Europe/Rome (YYYY-MM-DD), indipendente dal fuso di browser e server.
export function sessionDayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function parseSessionMonth(value: string | null, fallback: string): string {
  return value && MONTH_PATTERN.test(value) ? value : fallback;
}

export function shiftSessionMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const index = year * 12 + (monthNumber - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

// Cambio mese: i filtri restano; il giorno selezionato si azzera se non appartiene al nuovo mese.
export function navigateSessionMonth(state: { month: string; filters: SessionFilters }, delta: number): { month: string; filters: SessionFilters } {
  const month = shiftSessionMonth(state.month, delta);
  return { month, filters: state.filters.day && !state.filters.day.startsWith(month) ? { ...state.filters, day: "" } : state.filters };
}

export type FilterableSession = {
  scheduled_at: string;
  service_type_id: string;
  agreed_price_cents: number;
  client: { id: string } | null;
  current_stage: { id: string; code: string; ball_owner?: string | null } | null;
  payments: readonly { amount_cents: number }[];
  extras: readonly { line_total_cents: number }[];
};

// Tutti i filtri in AND. ignoreDay serve solo ai conteggi del calendario.
export function matchesSessionFilters(session: FilterableSession, filters: SessionFilters, options: { ignoreDay?: boolean } = {}): boolean {
  if (filters.clientId && session.client?.id !== filters.clientId) return false;
  if (filters.serviceTypeIds.length > 0 && !filters.serviceTypeIds.includes(session.service_type_id)) return false;
  if (filters.stageIds.length > 0 && !(session.current_stage && filters.stageIds.includes(session.current_stage.id))) return false;
  if (filters.paymentStatuses.length > 0 && !filters.paymentStatuses.includes(sessionPaymentStatus(session))) return false;
  if (!options.ignoreDay && filters.day && sessionDayKey(session.scheduled_at) !== filters.day) return false;
  return true;
}

export type SessionsSummary = { sessions: number; unpaid: number; settled: number; valueCents: number; coveredCents: number };

// Valore = prezzo + extra; coperto = denaro + riscatti buono, al massimo il dovuto.
export function summarizeSessions(sessions: readonly FilterableSession[]): SessionsSummary {
  const summary: SessionsSummary = { sessions: sessions.length, unpaid: 0, settled: 0, valueCents: 0, coveredCents: 0 };
  for (const session of sessions) {
    const due = calculateSessionDue(session);
    const covered = session.payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
    summary.valueCents += due;
    summary.coveredCents += Math.min(covered, due);
    if (sessionPaymentStatus(session) === "paid") summary.settled += 1;
    else summary.unpaid += 1;
  }
  return summary;
}

// Ordine della lista: future in ordine cronologico, poi passate dalla piu recente.
export function sortSessionsForList<T extends { scheduled_at: string }>(sessions: T[], nowIso: string): T[] {
  return [...sessions].sort((first, second) => {
    const firstFuture = first.scheduled_at >= nowIso;
    const secondFuture = second.scheduled_at >= nowIso;
    if (firstFuture !== secondFuture) return firstFuture ? -1 : 1;
    return firstFuture ? first.scheduled_at.localeCompare(second.scheduled_at) : second.scheduled_at.localeCompare(first.scheduled_at);
  });
}

// Filtro -> ordinamento -> paginazione. Calendario: stessi filtri tranne il giorno; riepilogo: giorno selezionato oppure mese.
export function buildSessionsView<T extends FilterableSession>(rows: readonly T[], filters: SessionFilters, options: { month: string; page: number; pageSize: number; nowIso: string }) {
  const universe = rows.filter((session) => session.current_stage?.code !== "cancelled");
  const calendarSessions = universe.filter((session) => matchesSessionFilters(session, filters, { ignoreDay: true }) && sessionDayKey(session.scheduled_at).startsWith(options.month));
  const matching = sortSessionsForList(universe.filter((session) => matchesSessionFilters(session, filters)), options.nowIso);

  const calendar: Record<string, number> = {};
  for (const session of calendarSessions) {
    const key = sessionDayKey(session.scheduled_at);
    calendar[key] = (calendar[key] ?? 0) + 1;
  }

  const kpis = { you: 0, client: 0, total: 0 };
  for (const session of matching) {
    const owner = session.current_stage?.ball_owner;
    if (owner === "you" || owner === "client") {
      kpis[owner] += 1;
      kpis.total += 1;
    }
  }

  return {
    sessions: matching.slice((options.page - 1) * options.pageSize, options.page * options.pageSize),
    total: matching.length,
    matching,
    calendar,
    summary: summarizeSessions(filters.day ? matching : calendarSessions),
    kpis,
  };
}

/**
 * Check if session has image consent
 */
export function hasImageConsent(session: Session): boolean {
  return session.image_consent_granted_at !== null && session.image_consent_revoked_at === null;
}
