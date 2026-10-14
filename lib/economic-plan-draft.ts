// Operazioni sulla bozza del Piano: un'unica lista di servizi alimenta sia "Target per servizio" sia "Distribuzione mensile sessioni".
// ticket = ticket medio base pianificato (EUR); il valore target ne deriva e non e modificabile.
export type DraftService = { serviceTypeId: string; sessions: string; ticket: string; monthlySessions: string[] };

export const emptyMonthlySessions = (): string[] => Array.from({ length: 12 }, () => "0");

export function addDraftService(services: DraftService[], serviceTypeId: string): DraftService[] {
  if (!serviceTypeId || services.some((row) => row.serviceTypeId === serviceTypeId)) return services;
  return [...services, { serviceTypeId, sessions: "0", ticket: "0", monthlySessions: emptyMonthlySessions() }];
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
