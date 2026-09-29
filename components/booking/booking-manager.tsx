"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Copy, Plus, Trash2 } from "lucide-react";
import { DEFAULT_BOOKING_FORM_FIELDS, type BookingDay, type BookingEventType, type BookingFormFieldConfig, type BookingFormFieldKey, WEEKDAY_LABELS, normalizeTime, slugify } from "@/lib/booking";
import { ItalianDateInput } from "@/components/shared/italian-date-input";
import { RichTextEditor } from "@/components/shared/rich-text-editor";

type Service = { id: string; name: string; suggested_price_cents: number };
type EventTypeRow = BookingEventType & { bookings_count: number };
type RuleDraft = { weekday: number; startTime: string; endTime: string };
type ExceptionDraft = { date: string; isClosed: boolean; startTime: string; endTime: string; note: string };
type AddonDraft = { category: "digital" | "print"; name: string; priceEuros: string; maxQuantity: string; isActive: boolean };

type FormState = {
  id: string | null;
  name: string;
  slug: string;
  slugTouched: boolean;
  description: string;
  serviceTypeId: string;
  durationMinutes: string;
  bufferMinutes: string;
  location: string;
  weekdayPriceEuros: string;
  weekendPriceEuros: string;
  showPrice: boolean;
  windowStartDate: string;
  windowEndDate: string;
  visibilityStartDate: string;
  visibilityEndDate: string;
  minNoticeHours: string;
  maxBookingsPerDay: string;
  maxBookingsTotal: string;
  askImageConsent: boolean;
  formFields: BookingFormFieldConfig;
  isActive: boolean;
  rules: RuleDraft[];
  exceptions: ExceptionDraft[];
  addonsDigitalMode: "single" | "multiple";
  addonsPrintMode: "single" | "multiple";
  depositEuros: string;
  addons: AddonDraft[];
};

const today = new Date().toISOString().slice(0, 10);

function emptyForm(): FormState {
  return {
    id: null,
    name: "",
    slug: "",
    slugTouched: false,
    description: "",
    serviceTypeId: "",
    durationMinutes: "90",
    bufferMinutes: "30",
    location: "",
    weekdayPriceEuros: "",
    weekendPriceEuros: "",
    showPrice: true,
    windowStartDate: today,
    windowEndDate: today,
    visibilityStartDate: today,
    visibilityEndDate: today,
    minNoticeHours: "24",
    maxBookingsPerDay: "",
    maxBookingsTotal: "",
    askImageConsent: true,
    formFields: structuredClone(DEFAULT_BOOKING_FORM_FIELDS),
    isActive: false,
    rules: [],
    exceptions: [],
    addonsDigitalMode: "single",
    addonsPrintMode: "multiple",
    depositEuros: "",
    addons: [],
  };
}

function formatEuros(cents: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatSlotTime(value: string): string {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}

export function BookingManager() {
  const [eventTypes, setEventTypes] = useState<EventTypeRow[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [preview, setPreview] = useState<BookingDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch("/api/booking/event-types");
      const body = await response.json().catch(() => null) as { eventTypes?: EventTypeRow[]; services?: Service[]; error?: string } | null;
      if (response.ok && body) {
        setEventTypes(body.eventTypes ?? []);
        setServices(body.services ?? []);
        return;
      }
      if (attempt === 0 && [502, 503, 504].includes(response.status)) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        continue;
      }
      throw new Error(body?.error ?? "Caricamento non riuscito.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Caricamento non riuscito.");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const publicOrigin = useMemo(() => (typeof window === "undefined" ? "" : window.location.origin), []);

  function update(patch: Partial<FormState>) {
    setForm((current) => (current ? { ...current, ...patch } : current));
  }

  async function openEditor(id: string | null) {
    setError(null);
    setNotice(null);
    setPreview(null);
    if (!id) {
      setForm(emptyForm());
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/booking/event-types/${id}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      const eventType = body.eventType as BookingEventType;
      setForm({
        id: eventType.id,
        name: eventType.name,
        slug: eventType.slug,
        slugTouched: true,
        description: eventType.description ?? "",
        serviceTypeId: eventType.service_type_id,
        durationMinutes: String(eventType.duration_minutes),
        bufferMinutes: String(eventType.buffer_minutes),
        location: eventType.location ?? "",
        weekdayPriceEuros: String(eventType.weekday_price_cents / 100),
        weekendPriceEuros: String(eventType.weekend_price_cents / 100),
        showPrice: eventType.show_price,
        windowStartDate: eventType.window_start_date,
        windowEndDate: eventType.window_end_date,
        visibilityStartDate: eventType.visibility_start_date,
        visibilityEndDate: eventType.visibility_end_date,
        minNoticeHours: String(eventType.min_notice_hours),
        maxBookingsPerDay: eventType.max_bookings_per_day === null ? "" : String(eventType.max_bookings_per_day),
        maxBookingsTotal: eventType.max_bookings_total === null ? "" : String(eventType.max_bookings_total),
        askImageConsent: eventType.ask_image_consent,
        formFields: eventType.form_fields ?? structuredClone(DEFAULT_BOOKING_FORM_FIELDS),
        isActive: eventType.is_active,
        rules: (body.rules ?? []).map((rule: { weekday: number; start_time: string; end_time: string }) => ({ weekday: rule.weekday, startTime: normalizeTime(rule.start_time), endTime: normalizeTime(rule.end_time) })),
        exceptions: (body.exceptions ?? []).map((entry: { exception_date: string; is_closed: boolean; start_time: string | null; end_time: string | null; note: string | null }) => ({
          date: entry.exception_date,
          isClosed: entry.is_closed,
          startTime: entry.start_time ? normalizeTime(entry.start_time) : "09:00",
          endTime: entry.end_time ? normalizeTime(entry.end_time) : "18:00",
          note: entry.note ?? "",
        })),
        addonsDigitalMode: eventType.addons_digital_mode ?? "single",
        addonsPrintMode: eventType.addons_print_mode ?? "multiple",
        depositEuros: eventType.deposit_cents ? String(eventType.deposit_cents / 100) : "",
        addons: (body.addons ?? []).map((addon: { category: "digital" | "print"; name: string; price_cents: number; max_quantity: number | null; is_active: boolean }) => ({
          category: addon.category,
          name: addon.name,
          priceEuros: String(addon.price_cents / 100),
          maxQuantity: addon.max_quantity === null ? "" : String(addon.max_quantity),
          isActive: addon.is_active,
        })),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossibile aprire l'evento.");
    } finally {
      setBusy(false);
    }
  }

  function buildPayload(state: FormState) {
    return {
      name: state.name.trim(),
      slug: state.slug.trim(),
      description: state.description,
      serviceTypeId: state.serviceTypeId,
      durationMinutes: Number(state.durationMinutes),
      bufferMinutes: Number(state.bufferMinutes),
      location: state.location,
      weekdayPriceEuros: Number(state.weekdayPriceEuros || 0),
      weekendPriceEuros: Number(state.weekendPriceEuros || 0),
      showPrice: state.showPrice,
      windowStartDate: state.windowStartDate,
      windowEndDate: state.windowEndDate,
      visibilityStartDate: state.visibilityStartDate,
      visibilityEndDate: state.visibilityEndDate,
      minNoticeHours: Number(state.minNoticeHours),
      maxBookingsPerDay: state.maxBookingsPerDay === "" ? null : Number(state.maxBookingsPerDay),
      maxBookingsTotal: state.maxBookingsTotal === "" ? null : Number(state.maxBookingsTotal),
      askImageConsent: state.askImageConsent,
      formFields: state.formFields,
      isActive: state.isActive,
      rules: state.rules,
      exceptions: state.exceptions.map((entry) => ({ date: entry.date, isClosed: entry.isClosed, startTime: entry.startTime, endTime: entry.endTime, note: entry.note })),
      addonsDigitalMode: state.addonsDigitalMode,
      addonsPrintMode: state.addonsPrintMode,
      depositEuros: Number(state.depositEuros || 0),
      addons: state.addons.map((addon) => ({ category: addon.category, name: addon.name.trim(), priceEuros: Number(addon.priceEuros || 0), maxQuantity: addon.maxQuantity === "" ? null : Number(addon.maxQuantity), isActive: addon.isActive })),
    };
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(form.id ? `/api/booking/event-types/${form.id}` : "/api/booking/event-types", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(form)),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await load();
      setForm(null);
      setNotice("Evento salvato.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Salvataggio non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Eliminare questo evento? Le sessioni già prenotate restano nel CRM.")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/booking/event-types/${id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await load();
      if (form?.id === id) setForm(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Eliminazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function loadPreview(id: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/booking/event-types/${id}/slots`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setPreview(body.days ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Anteprima non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(slug: string) {
    await navigator.clipboard.writeText(`${publicOrigin}/prenota/${slug}`);
    setNotice("Link copiato negli appunti.");
  }

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#d8d0c5] pb-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b5d43]">Prenotazioni online</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Tipi di evento</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#675f57]">Definisci i servizi prenotabili dai clienti, il periodo di apertura e le fasce di disponibilità. Ogni evento genera un link pubblico dedicato.</p>
          </div>
          <button className="flex items-center gap-2 bg-[#9b5d43] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={() => void openEditor(null)} type="button">
            <Plus className="size-4" strokeWidth={2} />Nuovo evento
          </button>
        </header>

        {error ? <p className="mt-5 border border-[#d9aaa0] bg-[#fff7f5] p-3 text-sm text-[#a53e31]">{error}</p> : null}
        {notice ? <p className="mt-5 border border-[#c3cfae] bg-[#f7faf1] p-3 text-sm text-[#4f6b33]">{notice}</p> : null}

        {loading ? <p className="mt-8 text-sm text-[#675f57]">Caricamento...</p> : null}

        {!loading && form ? (
          <section className="mt-7 border border-[#d8d0c5] bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold">{form.id ? "Modifica evento" : "Nuovo evento"}</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#675f57]">Nome</span>
                <input className="mt-1 h-10 w-full border border-[#cfc5b8] bg-white px-3 text-sm" onChange={(event) => update({ name: event.target.value, slug: form.slugTouched ? form.slug : slugify(event.target.value) })} value={form.name} />
              </label>
              <label className="text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#675f57]">Slug (link pubblico)</span>
                <input className="mt-1 h-10 w-full border border-[#cfc5b8] bg-white px-3 text-sm" onChange={(event) => update({ slug: slugify(event.target.value), slugTouched: true })} value={form.slug} />
                <span className="mt-1 block text-xs text-[#8a8177]">{publicOrigin}/prenota/{form.slug || "..."}</span>
              </label>
              <div className="text-sm sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#675f57]">Descrizione mostrata al cliente</span>
                <RichTextEditor onChange={(description) => update({ description })} value={form.description} />
              </div>
              <label className="text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#675f57]">Tipo di servizio CRM</span>
                <select className="mt-1 h-10 w-full border border-[#cfc5b8] bg-white px-3 text-sm" onChange={(event) => update({ serviceTypeId: event.target.value })} value={form.serviceTypeId}>
                  <option value="">Seleziona servizio</option>
                  {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#675f57]">Luogo</span>
                <input className="mt-1 h-10 w-full border border-[#cfc5b8] bg-white px-3 text-sm" onChange={(event) => update({ location: event.target.value })} value={form.location} />
              </label>
              <label className="text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#675f57]">Durata (minuti)</span>
                <input className="mt-1 h-10 w-full border border-[#cfc5b8] bg-white px-3 text-sm" min={1} onChange={(event) => update({ durationMinutes: event.target.value })} type="number" value={form.durationMinutes} />
              </label>
              <label className="text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#675f57]">Pausa tra sessioni (minuti)</span>
                <input className="mt-1 h-10 w-full border border-[#cfc5b8] bg-white px-3 text-sm" min={0} onChange={(event) => update({ bufferMinutes: event.target.value })} type="number" value={form.bufferMinutes} />
              </label>
              <label className="text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#675f57]">Prezzo feriale (€)</span>
                <input className="mt-1 h-10 w-full border border-[#cfc5b8] bg-white px-3 text-sm" min={0} onChange={(event) => update({ weekdayPriceEuros: event.target.value })} type="number" value={form.weekdayPriceEuros} />
              </label>
              <label className="text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#675f57]">Prezzo weekend (€)</span>
                <input className="mt-1 h-10 w-full border border-[#cfc5b8] bg-white px-3 text-sm" min={0} onChange={(event) => update({ weekendPriceEuros: event.target.value })} type="number" value={form.weekendPriceEuros} />
              </label>
              <label className="text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#675f57]">Disponibilità sessioni dal</span>
                <ItalianDateInput className="mt-1 h-10 w-full border border-[#cfc5b8] bg-white px-3 text-sm" onChange={(windowStartDate) => update({ windowStartDate })} required value={form.windowStartDate} />
              </label>
              <label className="text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#675f57]">Disponibilità sessioni fino al</span>
                <ItalianDateInput className="mt-1 h-10 w-full border border-[#cfc5b8] bg-white px-3 text-sm" onChange={(windowEndDate) => update({ windowEndDate })} required value={form.windowEndDate} />
              </label>
              <div className="sm:col-span-2 border-t border-[#e5ddd2] pt-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#675f57]">Visibilità pagina pubblica</h3>
                <p className="mt-1 text-xs text-[#8a8177]">La pagina sarà raggiungibile solo tra queste due date, indipendentemente dal periodo in cui le sessioni sono prenotabili.</p>
              </div>
              <label className="text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#675f57]">Pagina pubblica visibile dal</span>
                <ItalianDateInput className="mt-1 h-10 w-full border border-[#cfc5b8] bg-white px-3 text-sm" onChange={(visibilityStartDate) => update({ visibilityStartDate })} required value={form.visibilityStartDate} />
              </label>
              <label className="text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#675f57]">Pagina pubblica visibile fino al</span>
                <ItalianDateInput className="mt-1 h-10 w-full border border-[#cfc5b8] bg-white px-3 text-sm" onChange={(visibilityEndDate) => update({ visibilityEndDate })} required value={form.visibilityEndDate} />
              </label>
              <label className="text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#675f57]">Preavviso minimo (ore)</span>
                <input className="mt-1 h-10 w-full border border-[#cfc5b8] bg-white px-3 text-sm" min={0} onChange={(event) => update({ minNoticeHours: event.target.value })} type="number" value={form.minNoticeHours} />
              </label>
              <label className="text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#675f57]">Max prenotazioni al giorno</span>
                <input className="mt-1 h-10 w-full border border-[#cfc5b8] bg-white px-3 text-sm" min={1} onChange={(event) => update({ maxBookingsPerDay: event.target.value })} placeholder="Illimitate" type="number" value={form.maxBookingsPerDay} />
              </label>
              <label className="text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#675f57]">Max prenotazioni totali</span>
                <input className="mt-1 h-10 w-full border border-[#cfc5b8] bg-white px-3 text-sm" min={1} onChange={(event) => update({ maxBookingsTotal: event.target.value })} placeholder="Illimitate" type="number" value={form.maxBookingsTotal} />
              </label>
            </div>

            <div className="mt-7 border-t border-[#e5ddd2] pt-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#675f57]">Campi del form pubblico</h3>
              <p className="mt-1 text-xs text-[#8a8177]">Scegli quali dati chiedere e quali rendere obbligatori durante la prenotazione.</p>
              <div className="mt-4 divide-y divide-[#eee8df] border border-[#e5ddd2]">
                {([
                  ["firstName", "Nome"], ["lastName", "Cognome"], ["email", "Email"], ["phone", "Cellulare"],
                  ["birthDate", "Data di nascita"], ["participantsCount", "Numero di persone che partecipano alla sessione"], ["notes", "Note"],
                ] as Array<[BookingFormFieldKey, string]>).map(([key, label]) => {
                  const locked = key === "firstName" || key === "lastName" || key === "email";
                  const field = form.formFields[key];
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3" key={key}>
                      <span className="text-sm font-medium">{label}</span>
                      <div className="flex items-center gap-5 text-xs">
                        <label className="flex items-center gap-2"><input checked={field.enabled} disabled={locked} onChange={(event) => update({ formFields: { ...form.formFields, [key]: { enabled: event.target.checked, required: event.target.checked && field.required } } })} type="checkbox" />Mostra</label>
                        <label className="flex items-center gap-2"><input checked={field.required} disabled={locked || !field.enabled} onChange={(event) => update({ formFields: { ...form.formFields, [key]: { ...field, required: event.target.checked } } })} type="checkbox" />Obbligatorio</label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-5 text-sm">
              <label className="flex items-center gap-2"><input checked={form.showPrice} onChange={(event) => update({ showPrice: event.target.checked })} type="checkbox" />Mostra il prezzo nella pagina pubblica</label>
              <label className="flex items-center gap-2"><input checked={form.askImageConsent} onChange={(event) => update({ askImageConsent: event.target.checked })} type="checkbox" />Chiedi il consenso all&apos;uso delle immagini</label>
              <label className="flex items-center gap-2"><input checked={form.isActive} onChange={(event) => update({ isActive: event.target.checked })} type="checkbox" />Evento attivo (pagina pubblica raggiungibile)</label>
            </div>

            <div className="mt-7 border-t border-[#e5ddd2] pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#675f57]">Disponibilità settimanale</h3>
                  <p className="mt-1 text-xs text-[#8a8177]">Fasce orarie valide per tutto il periodo di apertura. Puoi aggiungere più fasce nello stesso giorno.</p>
                </div>
                <button className="flex items-center gap-2 border border-[#d8d0c5] px-3 py-2 text-xs font-semibold transition-colors hover:border-[#9b5d43]" onClick={() => update({ rules: [...form.rules, { weekday: 1, startTime: "09:00", endTime: "18:00" }] })} type="button"><Plus className="size-4 text-[#9b5d43]" strokeWidth={1.8} />Aggiungi fascia</button>
              </div>

              {form.rules.length === 0 ? <p className="mt-3 text-sm text-[#8a8177]">Nessuna fascia definita.</p> : null}
              <div className="mt-3 space-y-2">
                {form.rules.map((rule, index) => (
                  <div className="grid gap-2 sm:grid-cols-[1fr_8rem_8rem_auto]" key={index}>
                    <select className="h-10 border border-[#cfc5b8] bg-white px-3 text-sm" onChange={(event) => update({ rules: form.rules.map((item, position) => (position === index ? { ...item, weekday: Number(event.target.value) } : item)) })} value={rule.weekday}>
                      {WEEKDAY_LABELS.map((label, weekday) => <option key={weekday} value={weekday}>{label}</option>)}
                    </select>
                    <input className="h-10 border border-[#cfc5b8] bg-white px-3 text-sm" onChange={(event) => update({ rules: form.rules.map((item, position) => (position === index ? { ...item, startTime: event.target.value } : item)) })} type="time" value={rule.startTime} />
                    <input className="h-10 border border-[#cfc5b8] bg-white px-3 text-sm" onChange={(event) => update({ rules: form.rules.map((item, position) => (position === index ? { ...item, endTime: event.target.value } : item)) })} type="time" value={rule.endTime} />
                    <button aria-label="Rimuovi fascia" className="flex h-10 w-10 items-center justify-center border border-[#d8d0c5] transition-colors hover:border-[#a53e31]" onClick={() => update({ rules: form.rules.filter((_, position) => position !== index) })} type="button"><Trash2 className="size-4 text-[#a53e31]" strokeWidth={1.8} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-7 border-t border-[#e5ddd2] pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#675f57]">Eccezioni su date specifiche</h3>
                  <p className="mt-1 text-xs text-[#8a8177]">Chiudi una giornata oppure sostituisci le fasce settimanali con orari dedicati.</p>
                </div>
                <button className="flex items-center gap-2 border border-[#d8d0c5] px-3 py-2 text-xs font-semibold transition-colors hover:border-[#9b5d43]" onClick={() => update({ exceptions: [...form.exceptions, { date: form.windowStartDate, isClosed: true, startTime: "09:00", endTime: "18:00", note: "" }] })} type="button"><Plus className="size-4 text-[#9b5d43]" strokeWidth={1.8} />Aggiungi eccezione</button>
              </div>

              {form.exceptions.length === 0 ? <p className="mt-3 text-sm text-[#8a8177]">Nessuna eccezione.</p> : null}
              <div className="mt-3 space-y-2">
                {form.exceptions.map((entry, index) => (
                  <div className="grid gap-2 sm:grid-cols-[10rem_9rem_8rem_8rem_1fr_auto]" key={index}>
                    <ItalianDateInput className="h-10 border border-[#cfc5b8] bg-white px-3 text-sm" onChange={(date) => update({ exceptions: form.exceptions.map((item, position) => (position === index ? { ...item, date } : item)) })} required value={entry.date} />
                    <select className="h-10 border border-[#cfc5b8] bg-white px-3 text-sm" onChange={(event) => update({ exceptions: form.exceptions.map((item, position) => (position === index ? { ...item, isClosed: event.target.value === "closed" } : item)) })} value={entry.isClosed ? "closed" : "custom"}>
                      <option value="closed">Chiuso</option>
                      <option value="custom">Orari dedicati</option>
                    </select>
                    <input className="h-10 border border-[#cfc5b8] bg-white px-3 text-sm disabled:bg-[#f5f1eb]" disabled={entry.isClosed} onChange={(event) => update({ exceptions: form.exceptions.map((item, position) => (position === index ? { ...item, startTime: event.target.value } : item)) })} type="time" value={entry.startTime} />
                    <input className="h-10 border border-[#cfc5b8] bg-white px-3 text-sm disabled:bg-[#f5f1eb]" disabled={entry.isClosed} onChange={(event) => update({ exceptions: form.exceptions.map((item, position) => (position === index ? { ...item, endTime: event.target.value } : item)) })} type="time" value={entry.endTime} />
                    <input className="h-10 border border-[#cfc5b8] bg-white px-3 text-sm" onChange={(event) => update({ exceptions: form.exceptions.map((item, position) => (position === index ? { ...item, note: event.target.value } : item)) })} placeholder="Nota interna" value={entry.note} />
                    <button aria-label="Rimuovi eccezione" className="flex h-10 w-10 items-center justify-center border border-[#d8d0c5] transition-colors hover:border-[#a53e31]" onClick={() => update({ exceptions: form.exceptions.filter((_, position) => position !== index) })} type="button"><Trash2 className="size-4 text-[#a53e31]" strokeWidth={1.8} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-7 border-t border-[#e5ddd2] pt-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#675f57]">Pacchetti aggiuntivi (checkout)</h3>
              <p className="mt-1 text-xs text-[#8a8177]">Opzioni foto digitali e stampe proposte al cliente prima della conferma. Rientrano nel totale della sessione.</p>

              {([["digital", "Foto digitali", form.addonsDigitalMode], ["print", "Stampe", form.addonsPrintMode]] as const).map(([category, title, mode]) => (
                <div className="mt-5" key={category}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h4 className="text-sm font-semibold">{title}</h4>
                      <select className="h-9 border border-[#cfc5b8] bg-white px-2 text-xs" onChange={(event) => update(category === "digital" ? { addonsDigitalMode: event.target.value as "single" | "multiple" } : { addonsPrintMode: event.target.value as "single" | "multiple" })} value={mode}>
                        <option value="single">Scelta esclusiva (una sola opzione)</option>
                        <option value="multiple">Scelta multipla</option>
                      </select>
                    </div>
                    <button className="flex items-center gap-2 border border-[#d8d0c5] px-3 py-2 text-xs font-semibold transition-colors hover:border-[#9b5d43]" onClick={() => update({ addons: [...form.addons, { category, name: "", priceEuros: "", maxQuantity: "", isActive: true }] })} type="button"><Plus className="size-4 text-[#9b5d43]" strokeWidth={1.8} />Aggiungi pacchetto</button>
                  </div>
                  {form.addons.filter((addon) => addon.category === category).length === 0 ? <p className="mt-3 text-sm text-[#8a8177]">Nessun pacchetto.</p> : null}
                  <div className="mt-3 space-y-2">
                    {form.addons.map((addon, index) => (addon.category !== category ? null : (
                      <div className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem_auto_auto]" key={index}>
                        <input className="h-10 border border-[#cfc5b8] bg-white px-3 text-sm" onChange={(event) => update({ addons: form.addons.map((item, position) => (position === index ? { ...item, name: event.target.value } : item)) })} placeholder="Nome (es. 5 foto digitali)" value={addon.name} />
                        <input className="h-10 border border-[#cfc5b8] bg-white px-3 text-sm" min={0} onChange={(event) => update({ addons: form.addons.map((item, position) => (position === index ? { ...item, priceEuros: event.target.value } : item)) })} placeholder="€" type="number" value={addon.priceEuros} />
                        <input className="h-10 border border-[#cfc5b8] bg-white px-3 text-sm" min={1} onChange={(event) => update({ addons: form.addons.map((item, position) => (position === index ? { ...item, maxQuantity: event.target.value } : item)) })} placeholder="Qtà max" type="number" value={addon.maxQuantity} />
                        <label className="flex items-center gap-2 text-xs"><input checked={addon.isActive} onChange={(event) => update({ addons: form.addons.map((item, position) => (position === index ? { ...item, isActive: event.target.checked } : item)) })} type="checkbox" />Attivo</label>
                        <button aria-label="Rimuovi pacchetto" className="flex h-10 w-10 items-center justify-center border border-[#d8d0c5] transition-colors hover:border-[#a53e31]" onClick={() => update({ addons: form.addons.filter((_, position) => position !== index) })} type="button"><Trash2 className="size-4 text-[#a53e31]" strokeWidth={1.8} /></button>
                      </div>
                    )))}
                  </div>
                </div>
              ))}

              <label className="mt-6 block text-sm sm:max-w-xs">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#675f57]">Caparra richiesta (€)</span>
                <input className="mt-1 h-10 w-full border border-[#cfc5b8] bg-white px-3 text-sm" min={0} onChange={(event) => update({ depositEuros: event.target.value })} placeholder="0 = nessuna caparra" type="number" value={form.depositEuros} />
                <span className="mt-1 block text-xs text-[#8a8177]">Mostrata al cliente nel riepilogo, con il saldo residuo.</span>
              </label>
            </div>

            <div className="mt-7 flex flex-wrap gap-3 border-t border-[#e5ddd2] pt-5">
              <button className="bg-[#9b5d43] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={() => void save()} type="button">Salva evento</button>
              <button className="border border-[#d8d0c5] px-4 py-2 text-sm font-semibold transition-colors hover:border-[#9b5d43]" onClick={() => { setForm(null); setPreview(null); }} type="button">Annulla</button>
              {form.id ? <button className="flex items-center gap-2 border border-[#d8d0c5] px-4 py-2 text-sm font-semibold transition-colors hover:border-[#9b5d43] disabled:opacity-60" disabled={busy} onClick={() => void loadPreview(form.id!)} type="button"><CalendarDays className="size-4 text-[#9b5d43]" strokeWidth={1.8} />Anteprima slot (60 giorni)</button> : null}
            </div>

            {preview ? (
              <div className="mt-5 border border-[#e5ddd2] bg-[#fdfbf8] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#675f57]">Slot disponibili: {preview.reduce((total, day) => total + day.slots.length, 0)} su {preview.length} giornate</p>
                {preview.length === 0 ? <p className="mt-2 text-sm text-[#8a8177]">Nessuno slot libero con la configurazione salvata.</p> : null}
                <div className="mt-3 space-y-2">
                  {preview.slice(0, 14).map((day) => (
                    <div className="flex flex-wrap items-baseline gap-2 text-sm" key={day.date}>
                      <span className="w-40 shrink-0 text-[#675f57]">{formatDate(day.date)}</span>
                      <span className="text-[#27231f]">{day.slots.map((slot) => formatSlotTime(slot.startsAt)).join(" · ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {!loading && !form ? (
          <div className="mt-7 space-y-4">
            {eventTypes.length === 0 ? <p className="text-sm text-[#675f57]">Nessun tipo di evento configurato.</p> : null}
            {eventTypes.map((eventType) => (
              <article className="border border-[#d8d0c5] bg-white p-5" key={eventType.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold">{eventType.name}</h2>
                      <span className={`px-2 py-1 text-xs font-semibold ${eventType.is_active ? "bg-[#eef3e3] text-[#4f6b33]" : "bg-[#f0ece6] text-[#8a8177]"}`}>{eventType.is_active ? "Attivo" : "Disattivo"}</span>
                    </div>
                    <p className="mt-2 text-sm text-[#675f57]">{eventType.duration_minutes} min · pausa {eventType.buffer_minutes} min · {formatEuros(eventType.weekday_price_cents)} feriale / {formatEuros(eventType.weekend_price_cents)} weekend</p>
                    <p className="mt-1 text-sm text-[#675f57]">Sessioni dal {formatDate(eventType.window_start_date)} al {formatDate(eventType.window_end_date)} · pagina visibile dal {formatDate(eventType.visibility_start_date)} al {formatDate(eventType.visibility_end_date)} · {eventType.bookings_count} prenotazioni</p>
                    <p className="mt-1 text-xs text-[#8a8177]">{publicOrigin}/prenota/{eventType.slug}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="flex items-center gap-2 border border-[#d8d0c5] px-3 py-2 text-xs font-semibold transition-colors hover:border-[#9b5d43]" onClick={() => void copyLink(eventType.slug)} type="button"><Copy className="size-4 text-[#9b5d43]" strokeWidth={1.8} />Copia link</button>
                    <button className="border border-[#d8d0c5] px-3 py-2 text-xs font-semibold transition-colors hover:border-[#9b5d43] disabled:opacity-60" disabled={busy} onClick={() => void openEditor(eventType.id)} type="button">Modifica</button>
                    <button className="border border-[#d8d0c5] px-3 py-2 text-xs font-semibold text-[#a53e31] transition-colors hover:border-[#a53e31] disabled:opacity-60" disabled={busy} onClick={() => void remove(eventType.id)} type="button">Elimina</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
