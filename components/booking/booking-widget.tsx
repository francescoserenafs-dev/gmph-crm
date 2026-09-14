"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { DEFAULT_BOOKING_FORM_FIELDS, type BookingDay, type BookingFormFieldConfig, type BookingFormFieldKey } from "@/lib/booking";
import { ItalianDateInput } from "@/components/shared/italian-date-input";

type PublicEventType = {
  slug: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  location: string | null;
  showPrice: boolean;
  weekdayPriceCents: number;
  weekendPriceCents: number;
  askImageConsent: boolean;
  formFields: BookingFormFieldConfig;
};

type Confirmation = { startsAt: string; durationMinutes: number; location: string | null };
type BookingStep = "calendar" | "time" | "details";

const TIME_ZONE = "Europe/Rome";
const WEEK_DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function formatFullDate(dateKey: string): string {
  return new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${dateKey}T12:00:00`));
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

function formatFullDateFromIso(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);
}

function isWeekend(dateKey: string): boolean {
  const day = new Date(`${dateKey}T12:00:00`).getDay();
  return day === 0 || day === 6;
}

function shiftMonth(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(year, month - 1 + offset, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

export function BookingWidget({ slug, turnstileSiteKey }: { slug: string; turnstileSiteKey: string | null }) {
  const [eventType, setEventType] = useState<PublicEventType | null>(null);
  const [days, setDays] = useState<BookingDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [step, setStep] = useState<BookingStep>("calendar");
  const [visibleMonth, setVisibleMonth] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState({ firstName: "", lastName: "", email: "", phone: "", birthDate: "", participantsCount: "", notes: "", privacyConsent: false, imageConsent: false });
  const captchaRef = useRef<HTMLDivElement | null>(null);

  async function loadAvailability() {
    const response = await fetch(`/api/public/booking/${slug}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setEventType(body.eventType);
    setDays(body.days ?? []);
    return body.days as BookingDay[];
  }

  useEffect(() => {
    (async () => {
      try {
        await loadAvailability();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Impossibile caricare le disponibilità.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const availableDays = useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);
  const firstAvailableMonth = days[0]?.date.slice(0, 7) ?? "";
  const lastAvailableMonth = days.at(-1)?.date.slice(0, 7) ?? "";
  const activeMonth = visibleMonth ?? firstAvailableMonth;
  const calendarCells = useMemo(() => {
    if (!activeMonth) return [];
    const [year, month] = activeMonth.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells: Array<number | null> = Array.from({ length: startOffset }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
    while (cells.length < 42) cells.push(null);
    return cells;
  }, [activeMonth]);
  const calendarTitle = activeMonth
    ? new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date(`${activeMonth}-01T12:00:00`))
    : "";
  const activeDay = days.find((day) => day.date === selectedDate) ?? null;
  const priceCents = selectedDate && eventType ? (isWeekend(selectedDate) ? eventType.weekendPriceCents : eventType.weekdayPriceCents) : null;

  async function submit() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const captchaToken = turnstileSiteKey ? (captchaRef.current?.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]')?.value ?? "") : null;
      const response = await fetch(`/api/public/booking/${slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, slotStart: selectedSlot, captchaToken }),
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          const refreshed = await loadAvailability();
          setSelectedSlot(null);
          setStep("time");
          if (selectedDate && !refreshed.some((day) => day.date === selectedDate)) {
            setSelectedDate(null);
            setStep("calendar");
          }
        }
        throw new Error(body.error);
      }
      setConfirmation(body as Confirmation);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Prenotazione non riuscita.");
    } finally {
      setSubmitting(false);
    }
  }

  const formFields = eventType?.formFields ?? DEFAULT_BOOKING_FORM_FIELDS;
  const hasValue: Record<BookingFormFieldKey, boolean> = {
    firstName: Boolean(fields.firstName.trim()),
    lastName: Boolean(fields.lastName.trim()),
    email: Boolean(fields.email.trim()),
    phone: Boolean(fields.phone.trim()),
    birthDate: Boolean(fields.birthDate),
    participantsCount: Boolean(fields.participantsCount),
    notes: Boolean(fields.notes.trim()),
  };
  const canSubmit = Boolean(selectedSlot && fields.privacyConsent && Object.entries(formFields).every(([key, config]) => !config.enabled || !config.required || hasValue[key as BookingFormFieldKey]));
  const requiredMark = <span className="text-[#a53e31]"> *</span>;

  return (
    <main className="min-h-screen bg-[#fdfbf8] px-4 py-10 text-[#27231f] sm:px-8 lg:px-12">
      {turnstileSiteKey ? <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" /> : null}

      <div className="mx-auto max-w-5xl">
        <p className="text-center text-[0.7rem] font-semibold uppercase tracking-[0.34em] text-[#9b5d43]">Giulia Malosso Photography</p>

        {loading ? (
          <div className="mt-8 grid gap-px overflow-hidden border border-[#e2d9cd] bg-[#e2d9cd] md:grid-cols-[20rem_1fr]" aria-hidden="true">
            <div className="animate-pulse space-y-4 bg-white p-7">
              <div className="h-8 w-3/4 bg-[#efe7dc]" />
              <div className="h-3 w-full bg-[#f2ece2]" />
              <div className="h-3 w-5/6 bg-[#f2ece2]" />
              <div className="mt-6 h-4 w-1/2 bg-[#efe7dc]" />
              <div className="h-4 w-2/3 bg-[#efe7dc]" />
            </div>
            <div className="animate-pulse space-y-3 bg-white p-7">
              <div className="h-3 w-32 bg-[#efe7dc]" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 8 }).map((_, index) => <div className="h-9 w-24 bg-[#f2ece2]" key={index} />)}
              </div>
            </div>
          </div>
        ) : null}

        {!loading && eventType ? (
          <div className="mt-8 grid gap-px overflow-hidden border border-[#e2d9cd] bg-[#e2d9cd] md:grid-cols-[20rem_1fr]">
            <aside className="bg-white p-7">
              <h1 className="font-serif text-3xl leading-tight">{eventType.name}</h1>
              {eventType.description ? <div className="mt-4 text-sm leading-relaxed text-[#675f57] [&_font]:leading-relaxed [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-2 [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: eventType.description }} /> : null}

              <dl className="mt-7 space-y-3 border-t border-[#eee7dd] pt-6 text-sm text-[#4a443e]">
                <div className="flex items-center gap-3"><Clock className="size-4 shrink-0 text-[#9b5d43]" strokeWidth={1.6} /><span>{eventType.durationMinutes} minuti</span></div>
                {eventType.location ? <div className="flex items-center gap-3"><MapPin className="size-4 shrink-0 text-[#9b5d43]" strokeWidth={1.6} /><span>{eventType.location}</span></div> : null}
                {eventType.showPrice ? (
                  <div className="flex items-start gap-3">
                    <span className="mt-[3px] w-4 shrink-0 text-center text-sm font-semibold text-[#9b5d43]">€</span>
                    <span>
                      {eventType.weekdayPriceCents === eventType.weekendPriceCents
                        ? formatPrice(eventType.weekdayPriceCents)
                        : `${formatPrice(eventType.weekdayPriceCents)} nei giorni feriali · ${formatPrice(eventType.weekendPriceCents)} nel weekend`}
                    </span>
                  </div>
                ) : null}
              </dl>

              {selectedSlot ? (
                <div className="mt-7 border-t border-[#eee7dd] pt-6">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#9b5d43]">Appuntamento scelto</p>
                  <p className="mt-2 text-sm font-medium capitalize">{selectedDate ? formatFullDate(selectedDate) : ""}</p>
                  <p className="text-sm text-[#675f57]">ore {formatTime(selectedSlot)}{priceCents !== null && eventType.showPrice ? ` · ${formatPrice(priceCents)}` : ""}</p>
                </div>
              ) : null}
            </aside>

            <section className="bg-white p-7">
              {confirmation ? (
                <div className="py-10 text-center">
                  <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#eef3e3]"><Check className="size-6 text-[#4f6b33]" strokeWidth={2} /></span>
                  <h2 className="mt-5 font-serif text-2xl">Prenotazione confermata</h2>
                  <p className="mt-3 text-sm capitalize text-[#4a443e]">{formatFullDateFromIso(confirmation.startsAt)} · ore {formatTime(confirmation.startsAt)}</p>
                  {confirmation.location ? <p className="mt-1 text-sm text-[#675f57]">{confirmation.location}</p> : null}
                  <p className="mx-auto mt-6 max-w-sm text-sm leading-relaxed text-[#675f57]">Grazie! L&apos;appuntamento è stato registrato</p>
                </div>
              ) : (
                <>
                  {error ? <p className="mb-5 border border-[#d9aaa0] bg-[#fff7f5] p-3 text-sm text-[#a53e31]">{error}</p> : null}

                  {days.length === 0 ? (
                    <div className="py-12 text-center">
                      <CalendarDays className="mx-auto size-8 text-[#c8bdaf]" strokeWidth={1.4} />
                      <p className="mt-4 text-sm text-[#675f57]">Al momento non ci sono date disponibili. Riprova più avanti o scrivi a Giulia.</p>
                    </div>
                  ) : null}

                  {days.length > 0 && step === "calendar" ? (
                    <div>
                      <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#9b5d43]">1 · Scegli il giorno</h2>
                      <div className="mx-auto mt-5 max-w-lg">
                        <div className="flex items-center justify-between gap-3">
                          <button aria-label="Mese precedente" className="grid size-10 place-items-center border border-[#ddd4c8] transition-colors hover:border-[#9b5d43] disabled:opacity-30" disabled={activeMonth <= firstAvailableMonth} onClick={() => setVisibleMonth(shiftMonth(activeMonth, -1))} title="Mese precedente" type="button"><ChevronLeft className="size-4" /></button>
                          <h3 className="font-serif text-xl capitalize">{calendarTitle}</h3>
                          <button aria-label="Mese successivo" className="grid size-10 place-items-center border border-[#ddd4c8] transition-colors hover:border-[#9b5d43] disabled:opacity-30" disabled={activeMonth >= lastAvailableMonth} onClick={() => setVisibleMonth(shiftMonth(activeMonth, 1))} title="Mese successivo" type="button"><ChevronRight className="size-4" /></button>
                        </div>
                        <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[0.65rem] font-semibold uppercase text-[#8a8177]">
                          {WEEK_DAYS.map((day) => <span className="py-1" key={day}>{day}</span>)}
                        </div>
                        <div className="mt-1 grid grid-cols-7 gap-1">
                          {calendarCells.map((day, index) => {
                            if (!day) return <span className="aspect-square" key={`empty-${index}`} />;
                            const dateKey = `${activeMonth}-${String(day).padStart(2, "0")}`;
                            const available = availableDays.has(dateKey);
                            return (
                              <button
                                aria-label={available ? `Scegli ${formatFullDate(dateKey)}` : `${formatFullDate(dateKey)} non disponibile`}
                                className={`aspect-square border text-sm tabular-nums transition-colors ${available ? "border-[#9b5d43] bg-[#f8eee8] font-semibold hover:bg-[#ead8ce]" : "border-[#eee8df] text-[#c1b8ad]"}`}
                                disabled={!available}
                                key={dateKey}
                                onClick={() => { setSelectedDate(dateKey); setSelectedSlot(null); setStep("time"); }}
                                type="button"
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-4 text-center text-xs text-[#8a8177]">I giorni evidenziati hanno orari disponibili.</p>
                      </div>
                    </div>
                  ) : null}

                  {days.length > 0 && step === "time" && activeDay ? (
                    <div>
                      <button className="flex items-center gap-2 text-xs font-semibold text-[#675f57] hover:text-[#9b5d43]" onClick={() => { setStep("calendar"); setSelectedSlot(null); }} type="button"><ArrowLeft className="size-4" />Torna al calendario</button>
                      <h2 className="mt-5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#9b5d43]">2 · Scegli l&apos;orario</h2>
                      <p className="mt-2 font-serif text-2xl capitalize">{formatFullDate(activeDay.date)}</p>
                      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {activeDay.slots.map((slot) => (
                          <button
                            className={`border px-4 py-3 text-sm font-semibold tabular-nums transition-colors ${selectedSlot === slot.startsAt ? "border-[#9b5d43] bg-[#9b5d43] text-white" : "border-[#ddd4c8] hover:border-[#9b5d43]"}`}
                            key={slot.startsAt}
                            onClick={() => setSelectedSlot(slot.startsAt)}
                            type="button"
                          >
                            {formatTime(slot.startsAt)}
                          </button>
                        ))}
                      </div>
                      <button className="mt-6 w-full bg-[#9b5d43] px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50 sm:w-auto" disabled={!selectedSlot} onClick={() => setStep("details")} type="button">Continua</button>
                    </div>
                  ) : null}

                  {step === "details" && selectedSlot ? (
                    <div>
                      <button className="flex items-center gap-2 text-xs font-semibold text-[#675f57] hover:text-[#9b5d43]" onClick={() => setStep("time")} type="button"><ArrowLeft className="size-4" />Torna agli orari</button>
                      <h2 className="mt-5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#9b5d43]">3 · I tuoi dati</h2>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {formFields.firstName.enabled ? <label className="text-sm">
                          <span className="text-xs text-[#675f57]">Nome{formFields.firstName.required ? requiredMark : null}</span>
                          <input autoComplete="given-name" className="mt-1 h-11 w-full border border-[#ddd4c8] bg-white px-3 text-sm" onChange={(event) => setFields((current) => ({ ...current, firstName: event.target.value }))} value={fields.firstName} />
                        </label> : null}
                        {formFields.lastName.enabled ? <label className="text-sm">
                          <span className="text-xs text-[#675f57]">Cognome{formFields.lastName.required ? requiredMark : null}</span>
                          <input autoComplete="family-name" className="mt-1 h-11 w-full border border-[#ddd4c8] bg-white px-3 text-sm" onChange={(event) => setFields((current) => ({ ...current, lastName: event.target.value }))} value={fields.lastName} />
                        </label> : null}
                        {formFields.email.enabled ? <label className="text-sm">
                          <span className="text-xs text-[#675f57]">Email{formFields.email.required ? requiredMark : null}</span>
                          <input autoComplete="email" className="mt-1 h-11 w-full border border-[#ddd4c8] bg-white px-3 text-sm" onChange={(event) => setFields((current) => ({ ...current, email: event.target.value }))} type="email" value={fields.email} />
                        </label> : null}
                        {formFields.phone.enabled ? <label className="text-sm">
                          <span className="text-xs text-[#675f57]">Cellulare{formFields.phone.required ? requiredMark : null}</span>
                          <input autoComplete="tel" className="mt-1 h-11 w-full border border-[#ddd4c8] bg-white px-3 text-sm" onChange={(event) => setFields((current) => ({ ...current, phone: event.target.value }))} type="tel" value={fields.phone} />
                        </label> : null}
                        {formFields.birthDate.enabled ? <label className="text-sm">
                          <span className="text-xs text-[#675f57]">Data di nascita{formFields.birthDate.required ? requiredMark : null}</span>
                          <ItalianDateInput className="mt-1 h-11 w-full border border-[#ddd4c8] bg-white px-3 text-sm" onChange={(birthDate) => setFields((current) => ({ ...current, birthDate }))} required={formFields.birthDate.required} value={fields.birthDate} />
                        </label> : null}
                        {formFields.participantsCount.enabled ? <label className="text-sm">
                          <span className="text-xs text-[#675f57]">Numero di persone che partecipano alla sessione{formFields.participantsCount.required ? requiredMark : null}</span>
                          <input className="mt-1 h-11 w-full border border-[#ddd4c8] bg-white px-3 text-sm" min="1" onChange={(event) => setFields((current) => ({ ...current, participantsCount: event.target.value }))} step="1" type="number" value={fields.participantsCount} />
                        </label> : null}
                        {formFields.notes.enabled ? <label className="text-sm sm:col-span-2">
                          <span className="text-xs text-[#675f57]">Note{formFields.notes.required ? requiredMark : null}</span>
                          <textarea className="mt-1 w-full border border-[#ddd4c8] bg-white px-3 py-2 text-sm" onChange={(event) => setFields((current) => ({ ...current, notes: event.target.value }))} rows={3} value={fields.notes} />
                        </label> : null}
                      </div>

                      <div className="mt-5 space-y-3 text-sm text-[#4a443e]">
                        <label className="flex items-start gap-3">
                          <input checked={fields.privacyConsent} className="mt-1" onChange={(event) => setFields((current) => ({ ...current, privacyConsent: event.target.checked }))} type="checkbox" />
                          <span>Ho letto e accetto l&apos;informativa sul trattamento dei dati personali. <span className="text-[#a53e31]">*</span></span>
                        </label>
                        {eventType.askImageConsent ? (
                          <label className="flex items-start gap-3">
                            <input checked={fields.imageConsent} className="mt-1" onChange={(event) => setFields((current) => ({ ...current, imageConsent: event.target.checked }))} type="checkbox" />
                            <span>Acconsento all&apos;utilizzo delle fotografie realizzate durante la sessione per portfolio e canali social (facoltativo).</span>
                          </label>
                        ) : null}
                      </div>

                      {turnstileSiteKey ? <div className="cf-turnstile mt-5" data-sitekey={turnstileSiteKey} ref={captchaRef} /> : null}

                      <button className="mt-6 w-full bg-[#9b5d43] px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-opacity disabled:opacity-50 sm:w-auto" disabled={!canSubmit || submitting} onClick={() => void submit()} type="button">
                        {submitting ? "Invio in corso..." : "Conferma prenotazione"}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
