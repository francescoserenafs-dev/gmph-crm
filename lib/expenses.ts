import { addMonthsToDateKey, toLocalDateKey } from "@/lib/datetime";
import { calculateSessionCommercialValue, isCashPayment, paymentDateKey, MONTH_NAMES, type EconomicPayment, type EconomicSession } from "@/lib/economic-plans";

export const MAX_EXPENSE_CENTS = 1_000_000_000;
export const EXPENSE_KINDS = ["operating", "tax_contribution"] as const;
export type ExpenseKind = typeof EXPENSE_KINDS[number];
export const FREQUENCIES = { monthly: "Mensile", quarterly: "Trimestrale", yearly: "Annuale" } as const;
export type ExpenseFrequency = keyof typeof FREQUENCIES;
export type ExpenseCategory = { id: string; name: string; kind: ExpenseKind; is_marketing: boolean; is_active: boolean; sort_order: number };
export type ExpenseMethod = { id: string; name: string; is_active: boolean; is_system: boolean };
export type ExpenseService = { id: string; name: string; is_active: boolean; is_addon: boolean };
export type ExpenseOptions = { categories: ExpenseCategory[]; methods: ExpenseMethod[]; services: ExpenseService[] };
export type ExpenseValues = {
  description: string;
  expense_category_id: string;
  supplier: string | null;
  net_amount_cents: number;
  vat_amount_cents: number;
  payment_method_id: string;
  notes: string | null;
  marketing_service_type_id: string | null;
  marketing_campaign_year: number | null;
};
export type Expense = ExpenseValues & {
  id: string;
  paid_date: string;
  category_name_snapshot: string;
  category_kind_snapshot: ExpenseKind;
  category_is_marketing_snapshot: boolean;
  payment_method_name_snapshot: string;
  marketing_service_name_snapshot: string | null;
  recurring_rule_id: string | null;
  recurring_occurrence_date: string | null;
};
export type RecurringExpenseRule = ExpenseValues & {
  id: string;
  frequency: ExpenseFrequency;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  processed_through: string | null;
};
export type CostComponent = { quantity: number; unitCostCents: number | null };
export type DirectCostSource = { extraCosts?: CostComponent[]; inclusionCosts?: CostComponent[] };
export type CostSession = EconomicSession & DirectCostSource;

export function calculateSessionDirectCost(session: DirectCostSource) {
  let extraCostCents = 0;
  let inclusionCostCents = 0;
  let missingCostItems = 0;
  let totalCostItems = 0;
  for (const [source, components] of [["extra", session.extraCosts ?? []], ["inclusion", session.inclusionCosts ?? []]] as const) {
    for (const component of components) {
      if (component.quantity <= 0) continue;
      totalCostItems += 1;
      if (component.unitCostCents === null || component.unitCostCents === undefined) { missingCostItems += 1; continue; }
      const cost = component.unitCostCents * component.quantity;
      if (source === "extra") extraCostCents += cost; else inclusionCostCents += cost;
    }
  }
  return { extraCostCents, inclusionCostCents, knownCostCents: extraCostCents + inclusionCostCents, missingCostItems, totalCostItems, isComplete: missingCostItems === 0 };
}

export function calculateSessionDirectMargin(session: Pick<EconomicSession, "agreedPriceCents" | "extrasCents"> & DirectCostSource) {
  const cost = calculateSessionDirectCost(session);
  const valueCents = calculateSessionCommercialValue(session);
  const marginCents = valueCents - cost.knownCostCents;
  return { ...cost, valueCents, marginCents, marginRate: valueCents > 0 ? marginCents / valueCents : null };
}

export const expenseTotal = (expense: Pick<ExpenseValues, "net_amount_cents" | "vat_amount_cents">) => expense.net_amount_cents + expense.vat_amount_cents;

export function validExpenseDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^(20\d{2}|2100)-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function parseExpenseValues(body: unknown): ExpenseValues | string {
  if (!body || typeof body !== "object") return "Dati del costo non validi.";
  const input = body as Record<string, unknown>;
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!description || description.length > 200) return "Indica una descrizione entro 200 caratteri.";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof input.expense_category_id !== "string" || !uuid.test(input.expense_category_id)) return "Categoria non valida.";
  if (typeof input.payment_method_id !== "string" || !uuid.test(input.payment_method_id)) return "Metodo di pagamento non valido.";
  for (const key of ["net_amount_cents", "vat_amount_cents"] as const) {
    if (!Number.isSafeInteger(input[key]) || (input[key] as number) < 0 || (input[key] as number) > MAX_EXPENSE_CENTS) return "Imponibile e IVA devono essere importi non negativi in centesimi interi.";
  }
  const net = input.net_amount_cents as number;
  const vat = input.vat_amount_cents as number;
  if (net + vat <= 0 || net + vat > MAX_EXPENSE_CENTS) return "Il totale pagato deve essere positivo e non superiore a 10.000.000 EUR.";
  if (input.supplier != null && typeof input.supplier !== "string") return "Fornitore non valido.";
  if (input.notes != null && typeof input.notes !== "string") return "Note non valide.";
  const supplier = typeof input.supplier === "string" ? input.supplier.trim() || null : null;
  const notes = typeof input.notes === "string" ? input.notes.trim() || null : null;
  if ((supplier?.length ?? 0) > 200 || (notes?.length ?? 0) > 2000) return "Fornitore massimo 200 caratteri; note massimo 2000.";
  const serviceId = input.marketing_service_type_id || null;
  const campaignYear = input.marketing_campaign_year ?? null;
  if ((serviceId === null) !== (campaignYear === null)) return "Per attribuire il marketing indica servizio e anno.";
  if (serviceId !== null && (typeof serviceId !== "string" || !uuid.test(serviceId) || !Number.isInteger(campaignYear) || (campaignYear as number) < 2000 || (campaignYear as number) > 2100)) return "Servizio o anno campagna non valido.";
  return { description, expense_category_id: input.expense_category_id, supplier, net_amount_cents: net, vat_amount_cents: vat, payment_method_id: input.payment_method_id, notes, marketing_service_type_id: serviceId as string | null, marketing_campaign_year: campaignYear as number | null };
}

export function validateExpenseReferences(values: ExpenseValues, options: ExpenseOptions): string | null {
  const category = options.categories.find((item) => item.id === values.expense_category_id && item.is_active);
  if (!category) return "Categoria non disponibile o disattivata.";
  if (!options.methods.some((item) => item.id === values.payment_method_id && item.is_active && !item.is_system)) return "Metodo di pagamento non disponibile per i costi.";
  if (values.marketing_service_type_id) {
    if (!category.is_marketing || category.kind !== "operating") return "L'attribuzione a un servizio e consentita solo per il marketing.";
    if (!options.services.some((item) => item.id === values.marketing_service_type_id && item.is_active && !item.is_addon)) return "Servizio marketing non disponibile.";
  }
  return null;
}

type Schedule = Pick<RecurringExpenseRule, "start_date" | "end_date" | "frequency" | "is_active" | "processed_through">;
const frequencyMonths: Record<ExpenseFrequency, number> = { monthly: 1, quarterly: 3, yearly: 12 };

export function recurringDatesDue(rule: Schedule, today: string): string[] {
  if (!rule.is_active) return [];
  const dates: string[] = [];
  for (let offset = 0; offset <= 1212; offset += frequencyMonths[rule.frequency]) {
    const date = addMonthsToDateKey(rule.start_date, offset);
    if (date > today || (rule.end_date && date > rule.end_date)) break;
    if (!rule.processed_through || date > rule.processed_through) dates.push(date);
  }
  return dates;
}

export function nextRecurringOccurrence(rule: Schedule, today: string): string | null {
  if (!rule.is_active) return null;
  const after = rule.processed_through && rule.processed_through > today ? rule.processed_through : today;
  for (let offset = 0; offset <= 1212; offset += frequencyMonths[rule.frequency]) {
    const date = addMonthsToDateKey(rule.start_date, offset);
    if (rule.end_date && date > rule.end_date) return null;
    if (date > after) return date;
  }
  return null;
}

export function parseRecurringSchedule(body: Record<string, unknown>): Pick<RecurringExpenseRule, "frequency" | "start_date" | "end_date" | "is_active"> | string {
  if (typeof body.frequency !== "string" || !Object.hasOwn(FREQUENCIES, body.frequency)) return "Frequenza non valida.";
  if (!validExpenseDate(body.start_date)) return "Data inizio non valida.";
  const end = body.end_date || null;
  if (end !== null && (!validExpenseDate(end) || end < body.start_date)) return "La data fine deve essere valida e non precedente all'inizio.";
  if (body.is_active !== undefined && typeof body.is_active !== "boolean") return "Stato ricorrenza non valido.";
  return { frequency: body.frequency as ExpenseFrequency, start_date: body.start_date, end_date: end as string | null, is_active: body.is_active !== false };
}

export function computeCostAnalytics({ year, now, sessions, payments, expenses }: { year: number; now: Date; sessions: CostSession[]; payments: EconomicPayment[]; expenses: Expense[] }) {
  const monthlyCosts = MONTH_NAMES.map((label, index) => ({ month: index + 1, label, deliveredValueCents: 0, directCostsKnownCents: 0, directCostsMissingItems: 0, directCostItems: 0, operatingCostsCents: 0, taxContributionCostsCents: 0, vatCents: 0, cashCents: 0 }));
  const serviceMap = new Map<string, { serviceTypeId: string; name: string; sessions: number; valueCents: number; directCostsKnownCents: number; missingCostItems: number; totalCostItems: number; marketingCents: number }>();
  const categoryMap = new Map<string, { id: string; name: string; kind: ExpenseKind; totalCents: number; vatCents: number; count: number }>();
  const future = { sessions: 0, valueCents: 0, directCostsKnownCents: 0, missingCostItems: 0, totalCostItems: 0 };
  const serviceFor = (id: string, name: string) => {
    if (!serviceMap.has(id)) serviceMap.set(id, { serviceTypeId: id, name, sessions: 0, valueCents: 0, directCostsKnownCents: 0, missingCostItems: 0, totalCostItems: 0, marketingCents: 0 });
    return serviceMap.get(id)!;
  };
  for (const session of sessions) {
    if (session.isCancelled || session.isAddonService) continue;
    const date = toLocalDateKey(new Date(session.scheduledAt));
    if (Number(date.slice(0, 4)) !== year) continue;
    const result = calculateSessionDirectMargin(session);
    const service = serviceFor(session.serviceTypeId, session.serviceName);
    if (new Date(session.scheduledAt).getTime() > now.getTime()) {
      future.sessions += 1;
      future.valueCents += result.valueCents;
      future.directCostsKnownCents += result.knownCostCents;
      future.missingCostItems += result.missingCostItems;
      future.totalCostItems += result.totalCostItems;
      continue;
    }
    const month = monthlyCosts[Number(date.slice(5, 7)) - 1];
    month.deliveredValueCents += result.valueCents;
    month.directCostsKnownCents += result.knownCostCents;
    month.directCostsMissingItems += result.missingCostItems;
    month.directCostItems += result.totalCostItems;
    service.sessions += 1;
    service.valueCents += result.valueCents;
    service.directCostsKnownCents += result.knownCostCents;
    service.missingCostItems += result.missingCostItems;
    service.totalCostItems += result.totalCostItems;
  }
  for (const expense of expenses) {
    const total = expenseTotal(expense);
    if (expense.category_is_marketing_snapshot && expense.category_kind_snapshot === "operating" && expense.marketing_service_type_id && expense.marketing_campaign_year === year) {
      serviceFor(expense.marketing_service_type_id, expense.marketing_service_name_snapshot ?? "Servizio").marketingCents += total;
    }
    if (Number(expense.paid_date.slice(0, 4)) !== year) continue;
    const month = monthlyCosts[Number(expense.paid_date.slice(5, 7)) - 1];
    if (expense.category_kind_snapshot === "tax_contribution") month.taxContributionCostsCents += total;
    else month.operatingCostsCents += total;
    month.vatCents += expense.vat_amount_cents;
    const key = `${expense.expense_category_id}:${expense.category_name_snapshot}:${expense.category_kind_snapshot}`;
    const category = categoryMap.get(key) ?? { id: key, name: expense.category_name_snapshot, kind: expense.category_kind_snapshot, totalCents: 0, vatCents: 0, count: 0 };
    category.totalCents += total; category.vatCents += expense.vat_amount_cents; category.count += 1;
    categoryMap.set(key, category);
  }
  for (const payment of payments) {
    const date = paymentDateKey(payment);
    if (date && Number(date.slice(0, 4)) === year && isCashPayment(payment)) monthlyCosts[Number(date.slice(5, 7)) - 1].cashCents += payment.amountCents;
  }
  const sum = (field: keyof Omit<typeof monthlyCosts[number], "month" | "label">) => monthlyCosts.reduce((total, row) => total + row[field], 0);
  const operatingCostsCents = sum("operatingCostsCents");
  const taxContributionCostsCents = sum("taxContributionCostsCents");
  const directCostsKnownCents = sum("directCostsKnownCents");
  const deliveredValueCents = sum("deliveredValueCents");
  const directMarginCents = deliveredValueCents - directCostsKnownCents;
  const operatingResultCents = directMarginCents - operatingCostsCents;
  const serviceMargins = Array.from(serviceMap.values()).sort((left, right) => left.name.localeCompare(right.name, "it")).map((row) => ({ ...row, directMarginCents: row.valueCents - row.directCostsKnownCents, directMarginRate: row.valueCents > 0 ? (row.valueCents - row.directCostsKnownCents) / row.valueCents : null }));
  return {
    year, asOfDate: toLocalDateKey(now), operatingCostsCents, taxContributionCostsCents, vatCents: sum("vatCents"), directCostsKnownCents,
    directCostsMissingItems: sum("directCostsMissingItems"), directCostItems: sum("directCostItems"), deliveredValueCents, directMarginCents, operatingResultCents,
    finalResultCents: operatingResultCents - taxContributionCostsCents,
    totalManagementCostsCents: operatingCostsCents + taxContributionCostsCents + directCostsKnownCents,
    totalPaidCents: operatingCostsCents + taxContributionCostsCents,
    cashCents: sum("cashCents"), cashBalanceCents: sum("cashCents") - operatingCostsCents - taxContributionCostsCents,
    future: { ...future, directMarginCents: future.valueCents - future.directCostsKnownCents },
    monthlyCosts: monthlyCosts.map((row) => ({ ...row, totalPaidCents: row.operatingCostsCents + row.taxContributionCostsCents, directMarginCents: row.deliveredValueCents - row.directCostsKnownCents, operatingResultCents: row.deliveredValueCents - row.directCostsKnownCents - row.operatingCostsCents, finalResultCents: row.deliveredValueCents - row.directCostsKnownCents - row.operatingCostsCents - row.taxContributionCostsCents, cashBalanceCents: row.cashCents - row.operatingCostsCents - row.taxContributionCostsCents })),
    categoryBreakdown: Array.from(categoryMap.values()).sort((left, right) => right.totalCents - left.totalCents).map((row) => ({ ...row, operatingShare: row.kind === "operating" && operatingCostsCents > 0 ? row.totalCents / operatingCostsCents : null })),
    serviceMargins,
    campaignMargins: serviceMargins.map((row) => ({ ...row, campaignYear: year, resultCents: row.directMarginCents - row.marketingCents, marginRate: row.valueCents > 0 ? (row.directMarginCents - row.marketingCents) / row.valueCents : null })),
  };
}

export type CostAnalytics = ReturnType<typeof computeCostAnalytics>;