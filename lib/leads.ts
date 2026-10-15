export const LEAD_STATUSES = ["to_handle", "info_sent", "follow_up", "booked", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_CONTACT_TYPES = ["new_contact", "existing_client"] as const;
export type LeadContactType = (typeof LEAD_CONTACT_TYPES)[number];

export const LEAD_SOURCES = ["instagram", "meta_ads", "google", "referral", "existing_client", "other", "unknown"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_LOST_REASONS = ["price", "availability", "no_response", "chose_other_photographer", "postponed", "service_not_suitable", "distance", "other"] as const;
export type LeadLostReason = (typeof LEAD_LOST_REASONS)[number];

export const LEAD_OPEN_STATUSES: LeadStatus[] = ["to_handle", "info_sent", "follow_up"];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  to_handle: "Da gestire",
  info_sent: "Info inviate",
  follow_up: "Da ricontattare",
  booked: "Prenotato",
  lost: "Perso",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  instagram: "Instagram",
  meta_ads: "Meta Ads",
  google: "Google",
  referral: "Passaparola",
  existing_client: "Cliente precedente",
  other: "Altro",
  unknown: "Non noto",
};

export const LEAD_CONTACT_TYPE_LABELS: Record<LeadContactType, string> = {
  new_contact: "Nuovo contatto",
  existing_client: "Cliente esistente",
};

export const LEAD_CONTACT_TYPE_TOOLTIP = "Cliente già presente nel CRM che genera una nuova richiesta commerciale. La richiesta viene tracciata come Lead perché può trasformarsi in una nuova prenotazione oppure essere persa.";

export const LEAD_LOST_REASON_LABELS: Record<LeadLostReason, string> = {
  price: "Prezzo",
  availability: "Data / disponibilità",
  no_response: "Non risponde",
  chose_other_photographer: "Ha scelto un altro fotografo",
  postponed: "Ha rimandato",
  service_not_suitable: "Servizio non offerto / non adatto",
  distance: "Distanza / zona",
  other: "Altro",
};

export type Lead = {
  id: string;
  name: string;
  last_name: string | null;
  service_type_id: string;
  status: LeadStatus;
  contact: string;
  contact_type: LeadContactType | null;
  source: LeadSource;
  requested_period: string | null;
  notes: string | null;
  // Giorno in Europe/Rome (colonna date), come paid_date.
  follow_up_at: string | null;
  lost_reason: LeadLostReason | null;
  info_sent_at: string | null;
  converted_at: string | null;
  closed_at: string | null;
  client_id: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadWithService = Lead & {
  service: { id: string; name: string } | null;
  client: { id: string; first_name: string; last_name: string; email?: string | null; is_archived?: boolean } | null;
};

export type LeadDetail = LeadWithService & {
  session: { id: string; scheduled_at: string; service_name: string } | null;
};

export const LEAD_COLUMNS =
  "id, name, last_name, service_type_id, status, contact, contact_type, source, requested_period, notes, follow_up_at, lost_reason, info_sent_at, converted_at, closed_at, client_id, session_id, created_at, updated_at";

export const LEAD_LIST_FIELDS = `${LEAD_COLUMNS}, service:service_types!leads_service_type_id_fkey(id,name), client:clients!leads_client_id_fkey(id,first_name,last_name)`;

export const LEAD_DETAIL_FIELDS = `${LEAD_COLUMNS}, service:service_types!leads_service_type_id_fkey(id,name), client:clients!leads_client_id_fkey(id,first_name,last_name,email,is_archived), session:sessions!leads_session_id_fkey(id,scheduled_at,service_name)`;

export function isLeadOpen(status: LeadStatus): boolean {
  return LEAD_OPEN_STATUSES.includes(status);
}

export function leadFullName(lead: { name: string; last_name: string | null }): string {
  return lead.last_name ? `${lead.name} ${lead.last_name}` : lead.name;
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

const STATUS_RANK: Record<LeadStatus, number> = { to_handle: 0, follow_up: 1, info_sent: 2, booked: 3, lost: 4 };

// Aperti dal piu urgente/vecchio, chiusi dal piu recente.
function groupSortKey(lead: Lead): { key: string; descending: boolean } {
  switch (lead.status) {
    case "follow_up": return { key: lead.follow_up_at ?? "9999-12-31", descending: false };
    case "info_sent": return { key: lead.info_sent_at ?? lead.created_at, descending: false };
    case "booked": return { key: lead.converted_at ?? lead.updated_at, descending: true };
    case "lost": return { key: lead.closed_at ?? lead.updated_at, descending: true };
    default: return { key: lead.created_at, descending: false };
  }
}

export function compareLeads(first: Lead, second: Lead): number {
  const rank = STATUS_RANK[first.status] - STATUS_RANK[second.status];
  if (rank !== 0) return rank;
  const a = groupSortKey(first);
  const b = groupSortKey(second);
  const byGroup = a.descending ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key);
  return byGroup || first.created_at.localeCompare(second.created_at) || first.id.localeCompare(second.id);
}

export function followUpState(dateKey: string | null, todayKey: string): "overdue" | "today" | "future" | null {
  if (!dateKey) return null;
  if (dateKey < todayKey) return "overdue";
  return dateKey === todayKey ? "today" : "future";
}

export type LeadMetricInput = {
  contact_type: LeadContactType | null;
  status: LeadStatus;
  session: { agreed_price_cents: number } | null;
};

export type LeadMetricBucket = {
  leads: number;
  booked: number;
  bookedValueCents: number;
  conversionRate: number | null;
  averageTicketCents: number | null;
};

export function filterLeadsByContactType<T extends { contact_type: LeadContactType | null }>(leads: T[], contactType: LeadContactType | ""): T[] {
  return contactType ? leads.filter((lead) => lead.contact_type === contactType) : leads;
}

function emptyLeadMetricBucket() {
  return { leads: 0, booked: 0, bookedValueCents: 0 };
}

function leadMetricBucket(leads: LeadMetricInput[]): LeadMetricBucket {
  const bucket = emptyLeadMetricBucket();
  for (const lead of leads) {
    bucket.leads += 1;
    if (lead.status !== "booked") continue;
    bucket.booked += 1;
    bucket.bookedValueCents += lead.session?.agreed_price_cents ?? 0;
  }
  return {
    ...bucket,
    conversionRate: bucket.leads > 0 ? bucket.booked / bucket.leads : null,
    averageTicketCents: bucket.booked > 0 ? Math.round(bucket.bookedValueCents / bucket.booked) : null,
  };
}

export function summarizeLeadContactTypes(leads: LeadMetricInput[]) {
  const byType: (LeadMetricBucket & { contactType: LeadContactType | null })[] = LEAD_CONTACT_TYPES.map((contactType) => ({
    contactType,
    ...leadMetricBucket(leads.filter((lead) => lead.contact_type === contactType)),
  }));
  const unclassified = leads.filter((lead) => lead.contact_type === null);
  if (unclassified.length > 0) byType.push({ contactType: null, ...leadMetricBucket(unclassified) });
  return byType;
}
