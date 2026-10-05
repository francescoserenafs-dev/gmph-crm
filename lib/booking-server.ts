import { NextResponse } from "next/server";
import sanitizeHtml from "sanitize-html";
import { BOOKING_FORM_FIELD_KEYS, DEFAULT_BOOKING_FORM_FIELD_ITEMS, LOCKED_FORM_FIELD_KEYS, MAX_CUSTOM_FIELDS, MAX_CUSTOM_FIELD_LABEL, type BookingAddon, type BookingAvailabilityException, type BookingAvailabilityRule, type BookingDay, type BookingEventType, type BookingFormFieldItem, type BusyInterval, computeAvailableDays, normalizeFormFields } from "@/lib/booking";
import { addDaysToDateKey, parseLocalDateTime, toLocalDateKey } from "@/lib/datetime";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const EVENT_TYPE_COLUMNS =
  "id, slug, name, description, service_type_id, duration_minutes, buffer_minutes, location, weekday_price_cents, weekend_price_cents, show_price, window_start_date, window_end_date, visibility_start_date, visibility_end_date, min_notice_hours, max_bookings_per_day, max_bookings_total, ask_image_consent, addons_digital_mode, addons_print_mode, deposit_cents, form_fields, is_active, created_at, updated_at";

export type ParsedAddon = { category: "digital" | "print"; name: string; tooltip: string | null; price_cents: number; max_quantity: number | null; is_active: boolean; sort_order: number };

export type ParsedEventType = {
  row: Record<string, unknown>;
  rules: Array<{ weekday: number; start_time: string; end_time: string }>;
  exceptions: Array<{ exception_date: string; is_closed: boolean; start_time: string | null; end_time: string | null; note: string | null }>;
  addons: ParsedAddon[];
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Converte la config dei campi (array ordinato dal client) in una lista validata.
// I campi predefiniti restano vincolati dalle regole note; i custom sono testo lungo con etichetta.
function parseFormFields(value: unknown): BookingFormFieldItem[] | string {
  if (value === undefined || value === null) return DEFAULT_BOOKING_FORM_FIELD_ITEMS;
  if (!Array.isArray(value)) return normalizeFormFields(value);

  const items: BookingFormFieldItem[] = [];
  const seenPredefined = new Set<string>();
  let customCount = 0;

  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const key = typeof entry.key === "string" ? entry.key : "";
    const enabled = entry.enabled === true;
    const required = entry.required === true;

    if ((BOOKING_FORM_FIELD_KEYS as readonly string[]).includes(key)) {
      if (seenPredefined.has(key)) continue;
      seenPredefined.add(key);
      const locked = LOCKED_FORM_FIELD_KEYS.includes(key as (typeof LOCKED_FORM_FIELD_KEYS)[number]);
      const isEnabled = locked || enabled;
      items.push({ key, custom: false, label: "", enabled: isEnabled, required: locked || (isEnabled && required) });
      continue;
    }

    if (entry.custom === true || key.startsWith("custom_")) {
      const label = typeof entry.label === "string" ? entry.label.trim() : "";
      if (!label) return "Ogni campo personalizzato deve avere un'etichetta.";
      if (label.length > MAX_CUSTOM_FIELD_LABEL) return `L'etichetta di un campo personalizzato non può superare ${MAX_CUSTOM_FIELD_LABEL} caratteri.`;
      customCount += 1;
      if (customCount > MAX_CUSTOM_FIELDS) return `Puoi aggiungere al massimo ${MAX_CUSTOM_FIELDS} campi personalizzati.`;
      items.push({ key: `custom_${customCount}`, custom: true, label, enabled, required: enabled && required });
    }
  }

  // Garantisce la presenza di tutti i predefiniti (in coda, con i default) se il client ne ha omesso qualcuno.
  const normalized = normalizeFormFields(items);
  return normalized;
}

export function sanitizeBookingDescription(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return sanitizeHtml(value, {
    allowedTags: ["p", "div", "br", "strong", "b", "em", "i", "ul", "ol", "li", "font"],
    allowedAttributes: { font: ["color", "face", "size"] },
    allowedSchemes: [],
  }).trim() || null;
}

function optionalPositiveInt(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseEventTypePayload(body: Record<string, unknown> | null): ParsedEventType | string {
  if (!body) return "Payload non valido.";

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const serviceTypeId = typeof body.serviceTypeId === "string" ? body.serviceTypeId : "";
  const durationMinutes = Number(body.durationMinutes);
  const bufferMinutes = Number(body.bufferMinutes ?? 30);
  const minNoticeHours = Number(body.minNoticeHours ?? 24);
  const weekdayPriceEuros = Number(body.weekdayPriceEuros ?? 0);
  const weekendPriceEuros = Number(body.weekendPriceEuros ?? 0);
  const windowStartDate = typeof body.windowStartDate === "string" ? body.windowStartDate : "";
  const windowEndDate = typeof body.windowEndDate === "string" ? body.windowEndDate : "";
  const visibilityStartDate = typeof body.visibilityStartDate === "string" ? body.visibilityStartDate : "";
  const visibilityEndDate = typeof body.visibilityEndDate === "string" ? body.visibilityEndDate : "";

  if (!name) return "Il nome dell'evento è obbligatorio.";
  if (!SLUG_PATTERN.test(slug)) return "Lo slug può contenere solo lettere minuscole, numeri e trattini.";
  if (!serviceTypeId) return "Seleziona un tipo di servizio.";
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) return "La durata deve essere un numero di minuti positivo.";
  if (!Number.isInteger(bufferMinutes) || bufferMinutes < 0) return "Il buffer deve essere un numero di minuti non negativo.";
  if (!Number.isInteger(minNoticeHours) || minNoticeHours < 0) return "Il preavviso minimo deve essere un numero di ore non negativo.";
  if (!Number.isInteger(weekdayPriceEuros) || weekdayPriceEuros < 0 || !Number.isInteger(weekendPriceEuros) || weekendPriceEuros < 0) return "I prezzi devono essere interi non negativi.";
  if (!DATE_PATTERN.test(windowStartDate) || !DATE_PATTERN.test(windowEndDate)) return "Indica un periodo di apertura valido.";
  if (windowEndDate < windowStartDate) return "La data di fine non può precedere quella di inizio.";
  if (!DATE_PATTERN.test(visibilityStartDate) || !DATE_PATTERN.test(visibilityEndDate)) return "Indica un periodo di visibilità pubblico valido.";
  if (visibilityEndDate < visibilityStartDate) return "La fine della visibilità pubblica non può precedere l'inizio.";

  const maxBookingsPerDay = optionalPositiveInt(body.maxBookingsPerDay);
  const maxBookingsTotal = optionalPositiveInt(body.maxBookingsTotal);
  if (maxBookingsPerDay === undefined) return "Il massimo di prenotazioni al giorno deve essere un intero positivo.";
  if (maxBookingsTotal === undefined) return "Il massimo di prenotazioni totali deve essere un intero positivo.";

  const rules: ParsedEventType["rules"] = [];
  for (const raw of Array.isArray(body.rules) ? body.rules : []) {
    const item = raw as Record<string, unknown>;
    const weekday = Number(item.weekday);
    const startTime = typeof item.startTime === "string" ? item.startTime : "";
    const endTime = typeof item.endTime === "string" ? item.endTime : "";
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return "Giorno della settimana non valido.";
    if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) return "Orari di disponibilità non validi.";
    if (endTime <= startTime) return "L'orario di fine deve essere successivo a quello di inizio.";
    if (rules.some((rule) => rule.weekday === weekday && rule.start_time === startTime && rule.end_time === endTime)) continue;
    rules.push({ weekday, start_time: startTime, end_time: endTime });
  }
  if (rules.length === 0) return "Definisci almeno una fascia di disponibilità settimanale.";

  const exceptions: ParsedEventType["exceptions"] = [];
  for (const raw of Array.isArray(body.exceptions) ? body.exceptions : []) {
    const item = raw as Record<string, unknown>;
    const date = typeof item.date === "string" ? item.date : "";
    const isClosed = item.isClosed === true;
    const startTime = typeof item.startTime === "string" ? item.startTime : "";
    const endTime = typeof item.endTime === "string" ? item.endTime : "";
    const note = typeof item.note === "string" && item.note.trim() ? item.note.trim() : null;
    if (!DATE_PATTERN.test(date)) return "Data di eccezione non valida.";
    if (isClosed) {
      if (exceptions.some((entry) => entry.exception_date === date && entry.is_closed)) continue;
      exceptions.push({ exception_date: date, is_closed: true, start_time: null, end_time: null, note });
      continue;
    }
    if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) return "Orari dell'eccezione non validi.";
    if (endTime <= startTime) return "L'orario di fine dell'eccezione deve essere successivo a quello di inizio.";
    exceptions.push({ exception_date: date, is_closed: false, start_time: startTime, end_time: endTime, note });
  }
  for (const entry of exceptions) {
    if (entry.is_closed && exceptions.some((other) => other.exception_date === entry.exception_date && !other.is_closed)) {
      return "Una data non può essere chiusa e avere orari personalizzati allo stesso tempo.";
    }
  }

  const modeOf = (value: unknown, fallback: "single" | "multiple") => (value === "single" || value === "multiple" ? value : fallback);
  const addonsDigitalMode = modeOf(body.addonsDigitalMode, "single");
  const addonsPrintMode = modeOf(body.addonsPrintMode, "multiple");

  const depositEuros = Number(body.depositEuros ?? 0);
  if (!Number.isInteger(depositEuros) || depositEuros < 0) return "La caparra deve essere un importo intero non negativo.";

  const addons: ParsedAddon[] = [];
  for (const raw of Array.isArray(body.addons) ? body.addons : []) {
    const item = raw as Record<string, unknown>;
    const category = item.category === "digital" || item.category === "print" ? item.category : null;
    const addonName = typeof item.name === "string" ? item.name.trim() : "";
    const priceEuros = Number(item.priceEuros);
    if (!category) return "Categoria pacchetto non valida.";
    if (!addonName) return "Ogni pacchetto aggiuntivo deve avere un nome.";
    if (!Number.isInteger(priceEuros) || priceEuros < 0) return "Il prezzo di ogni pacchetto deve essere un intero non negativo.";
    const rawMax = item.maxQuantity;
    const maxQuantity = rawMax === null || rawMax === undefined || rawMax === "" ? null : Number(rawMax);
    if (maxQuantity !== null && (!Number.isInteger(maxQuantity) || maxQuantity <= 0)) return "La quantità massima di un pacchetto deve essere un intero positivo.";
    const tooltip = typeof item.tooltip === "string" ? item.tooltip.trim() || null : null;
    addons.push({ category, name: addonName, tooltip, price_cents: priceEuros * 100, max_quantity: maxQuantity, is_active: item.isActive !== false, sort_order: addons.length });
  }

  const formFields = parseFormFields(body.formFields);
  if (typeof formFields === "string") return formFields;

  return {
    row: {
      slug,
      name,
      description: sanitizeBookingDescription(body.description),
      service_type_id: serviceTypeId,
      duration_minutes: durationMinutes,
      buffer_minutes: bufferMinutes,
      location: typeof body.location === "string" && body.location.trim() ? body.location.trim() : null,
      weekday_price_cents: weekdayPriceEuros * 100,
      weekend_price_cents: weekendPriceEuros * 100,
      show_price: body.showPrice !== false,
      window_start_date: windowStartDate,
      window_end_date: windowEndDate,
      visibility_start_date: visibilityStartDate,
      visibility_end_date: visibilityEndDate,
      min_notice_hours: minNoticeHours,
      max_bookings_per_day: maxBookingsPerDay,
      max_bookings_total: maxBookingsTotal,
      ask_image_consent: body.askImageConsent !== false,
      addons_digital_mode: addonsDigitalMode,
      addons_print_mode: addonsPrintMode,
      deposit_cents: depositEuros * 100,
      form_fields: formFields,
      is_active: body.isActive === true,
    },
    rules,
    exceptions,
    addons,
  };
}

export async function replaceAvailability(eventTypeId: string, parsed: ParsedEventType): Promise<NextResponse | null> {
  const deleteRules = await supabaseAdmin.from("booking_availability_rules").delete().eq("event_type_id", eventTypeId);
  if (deleteRules.error) return NextResponse.json({ error: deleteRules.error.message }, { status: 500 });

  const deleteExceptions = await supabaseAdmin.from("booking_availability_exceptions").delete().eq("event_type_id", eventTypeId);
  if (deleteExceptions.error) return NextResponse.json({ error: deleteExceptions.error.message }, { status: 500 });

  if (parsed.rules.length > 0) {
    const { error } = await supabaseAdmin.from("booking_availability_rules").insert(parsed.rules.map((rule) => ({ ...rule, event_type_id: eventTypeId })));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (parsed.exceptions.length > 0) {
    const { error } = await supabaseAdmin.from("booking_availability_exceptions").insert(parsed.exceptions.map((exception) => ({ ...exception, event_type_id: eventTypeId })));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return null;
}

const ADDON_COLUMNS = "id, event_type_id, category, name, tooltip, price_cents, max_quantity, is_active, sort_order";

export async function loadEventTypeAddons(eventTypeId: string, activeOnly = false): Promise<BookingAddon[]> {
  let query = supabaseAdmin.from("booking_addons").select(ADDON_COLUMNS).eq("event_type_id", eventTypeId);
  if (activeOnly) query = query.eq("is_active", true);
  const { data } = await query.order("category", { ascending: true }).order("sort_order", { ascending: true });
  return (data as BookingAddon[] | null) ?? [];
}

// Sostituisce interamente i pacchetti dell'evento (delete + reinsert, come per le regole di disponibilita').
export async function replaceAddons(eventTypeId: string, addons: ParsedAddon[]): Promise<NextResponse | null> {
  const del = await supabaseAdmin.from("booking_addons").delete().eq("event_type_id", eventTypeId);
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });

  if (addons.length > 0) {
    const { error } = await supabaseAdmin.from("booking_addons").insert(addons.map((addon) => ({ ...addon, event_type_id: eventTypeId })));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return null;
}

async function countEventTypeBookings(eventTypeId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("booking_event_type_id", eventTypeId);
  return count ?? 0;
}

export async function loadActiveEventTypeBySlug(slug: string): Promise<BookingEventType | null> {
  const { data } = await supabaseAdmin.from("booking_event_types").select(EVENT_TYPE_COLUMNS).eq("slug", slug).eq("is_active", true).maybeSingle();
  const eventType = (data as BookingEventType | null) ?? null;
  if (!eventType) return null;
  const today = toLocalDateKey(new Date());
  if (today < eventType.visibility_start_date || today > eventType.visibility_end_date) return null;
  return eventType;
}

/**
 * Calcola gli slot liberi per un evento sottraendo alle fasce configurate tutte le sessioni
 * gia' a calendario (create da CRM, import o sync Calendly), escluse quelle annullate.
 */
export async function resolveAvailableDays(eventType: BookingEventType, rangeStart: string, rangeEnd: string): Promise<BookingDay[] | string> {
  const [rules, exceptions] = await Promise.all([
    supabaseAdmin.from("booking_availability_rules").select("id, event_type_id, weekday, start_time, end_time").eq("event_type_id", eventType.id),
    supabaseAdmin.from("booking_availability_exceptions").select("id, event_type_id, exception_date, is_closed, start_time, end_time, note").eq("event_type_id", eventType.id),
  ]);
  if (rules.error ?? exceptions.error) return (rules.error ?? exceptions.error)!.message;

  const busyFrom = parseLocalDateTime(`${addDaysToDateKey(rangeStart, -1)}T00:00`).toISOString();
  const busyTo = parseLocalDateTime(`${addDaysToDateKey(rangeEnd, 2)}T00:00`).toISOString();

  const sessions = await supabaseAdmin
    .from("sessions")
    .select("scheduled_at, duration_minutes, booking_event_type_id, current_stage:session_stages!sessions_current_stage_id_fkey(code)")
    .gte("scheduled_at", busyFrom)
    .lt("scheduled_at", busyTo);
  if (sessions.error) return sessions.error.message;

  const active = (sessions.data ?? []).filter((row) => {
    const stage = row.current_stage as unknown as { code: string } | null;
    return stage?.code !== "cancelled";
  });

  const busy: BusyInterval[] = active.map((row) => {
    const start = new Date(row.scheduled_at as string);
    return { start, end: new Date(start.getTime() + (row.duration_minutes as number) * 60_000) };
  });

  const bookingsPerDay: Record<string, number> = {};
  const bookedStartsByDay: Record<string, string[]> = {};
  for (const row of active) {
    if (row.booking_event_type_id !== eventType.id) continue;
    const key = toLocalDateKey(new Date(row.scheduled_at as string));
    bookingsPerDay[key] = (bookingsPerDay[key] ?? 0) + 1;
    bookedStartsByDay[key] = [...(bookedStartsByDay[key] ?? []), new Date(row.scheduled_at as string).toISOString()];
  }

  const totalBookings = eventType.max_bookings_total === null ? 0 : await countEventTypeBookings(eventType.id);

  return computeAvailableDays({
    eventType,
    rules: (rules.data ?? []) as BookingAvailabilityRule[],
    exceptions: (exceptions.data ?? []) as BookingAvailabilityException[],
    busy,
    bookingsPerDay,
    bookedStartsByDay,
    totalBookings,
    rangeStart,
    rangeEnd,
  });
}
