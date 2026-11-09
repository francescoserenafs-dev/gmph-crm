import type { EconomicPlan, PlanService } from "@/lib/economic-plans";

// Bozza del Piano: un'unica lista di servizi alimenta piano per servizio, distribuzione mensile e fatturato.
// ticket = ticket medio pianificato (EUR, extra inclusi); le sessioni del servizio sono la somma dei 12 mesi.
export type DraftService = { serviceTypeId: string; ticket: string; monthlySessions: string[] };

export const emptyMonthlySessions = (): string[] => Array.from({ length: 12 }, () => "0");

// Euro -> centesimi via stringa, senza aritmetica in virgola mobile. Valori non validi valgono 0.
export function euroToCents(value: string): number {
  const match = /^(\d+)(?:[.,](\d{0,2}))?$/.exec(value.trim());
  if (!match) return 0;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

export function centsToEuroInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

// Solo interi >= 0: qualsiasi altro valore conta 0.
export function toSessions(value: string): number {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : 0;
}

export function draftToServices(services: DraftService[]): PlanService[] {
  return services.map((row) => ({ serviceTypeId: row.serviceTypeId, plannedTicketCents: euroToCents(row.ticket), monthlySessions: row.monthlySessions.map(toSessions) }));
}

export function servicesToDraft(services: EconomicPlan["services"]): DraftService[] {
  return services.map((entry) => ({ serviceTypeId: entry.serviceTypeId, ticket: centsToEuroInput(entry.plannedTicketCents), monthlySessions: entry.monthlySessions.map(String) }));
}

export function addDraftService(services: DraftService[], serviceTypeId: string): DraftService[] {
  if (!serviceTypeId || services.some((row) => row.serviceTypeId === serviceTypeId)) return services;
  return [...services, { serviceTypeId, ticket: "0", monthlySessions: emptyMonthlySessions() }];
}

export function removeDraftService(services: DraftService[], serviceTypeId: string): DraftService[] {
  return services.filter((row) => row.serviceTypeId !== serviceTypeId);
}

export function updateDraftService(services: DraftService[], serviceTypeId: string, patch: Partial<Omit<DraftService, "serviceTypeId">>): DraftService[] {
  return services.map((row) => (row.serviceTypeId === serviceTypeId ? { ...row, ...patch } : row));
}

export function updateDraftServiceMonth(services: DraftService[], serviceTypeId: string, monthIndex: number, value: string): DraftService[] {
  return services.map((row) => (row.serviceTypeId === serviceTypeId
    ? { ...row, monthlySessions: row.monthlySessions.map((cell, index) => (index === monthIndex ? value : cell)) }
    : row));
}
