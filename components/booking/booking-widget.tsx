"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { CalendarDays, Check, Clock, MapPin } from "lucide-react";
import type { BookingDay } from "@/lib/booking";

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
};

type Confirmation = { startsAt: string; durationMinutes: number; location: string | null };

const TIME_ZONE = "Europe/Rome";

function formatFullDate(dateKey: string): string {
  return new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${dateKey}T12:00:00`));
}

function formatShortDate(dateKey: string): string {
  return new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${dateKey}T12:00:00`));
}

function formatMonth(dateKey: string): string {
  return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date(`${dateKey}T12:00:00`));
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

export function BookingWidget({ slug, turnstileSiteKey }: { slug: string; turnstileSiteKey: string | null }) {
  const [eventType, setEventType] = useState<PublicEventType | null>(null);
  const [days, setDays] = useState<BookingDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState({ firstName: "", lastName: "", email: "", phone: "", notes: "", privacyConsent: false, imageConsent: false });
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

  const months = useMemo(() => {
    const grouped = new Map<string, BookingDay[]>();
    for (const day of days) {
      const key = day.date.slice(0, 7);
      grouped.set(key, [...(grouped.get(key) ?? []), day]);
    }
    return [...grouped.entries()];
  }, [days]);

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
          if (selectedDate && !refreshed.some((day) => day.date === selectedDate)) setSelectedDate(null);
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

  const canSubmit = Boolean(selectedSlot && fields.firstName.trim() && fields.lastName.trim() && fields.email.trim() && fields.phone.trim() && fields.privacyConsent);

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
              {eventType.description ? <p className="mt-4 text-sm leading-relaxed text-[#675f57] whitespace-pre-line">{eventType.description}</p> : null}

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
                  <p className="mx-auto mt-6 max-w-sm text-sm leading-relaxed text-[#675f57]">Grazie! L&apos;appuntamento è stato registrato. Per qualsiasi modifica o disdetta scrivi direttamente a Giulia.</p>
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

                  {days.length > 0 ? (
                    <>
                      <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#9b5d43]">1 · Scegli il giorno</h2>
                      <div className="mt-4 space-y-5">
                        {months.map(([month, monthDays]) => (
                          <div key={month}>
                            <p className="text-xs font-medium capitalize text-[#8a8177]">{formatMonth(monthDays[0].date)}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {monthDays.map((day) => (
                                <button
                                  className={`border px-3 py-2 text-sm capitalize transition-colors ${selectedDate === day.date ? "border-[#9b5d43] bg-[#9b5d43] text-white" : "border-[#ddd4c8] hover:border-[#9b5d43]"}`}
                                  key={day.date}
                                  onClick={() => { setSelectedDate(day.date); setSelectedSlot(null); }}
                                  type="button"
                                >
                                  {formatShortDate(day.date)}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}

                  {activeDay ? (
                    <div className="mt-8 border-t border-[#eee7dd] pt-6">
                      <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#9b5d43]">2 · Scegli l&apos;orario</h2>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {activeDay.slots.map((slot) => (
                          <button
                            className={`border px-4 py-2 text-sm tabular-nums transition-colors ${selectedSlot === slot.startsAt ? "border-[#9b5d43] bg-[#9b5d43] text-white" : "border-[#ddd4c8] hover:border-[#9b5d43]"}`}
                            key={slot.startsAt}
                            onClick={() => setSelectedSlot(slot.startsAt)}
                            type="button"
                          >
                            {formatTime(slot.startsAt)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {selectedSlot ? (
                    <div className="mt-8 border-t border-[#eee7dd] pt-6">
                      <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#9b5d43]">3 · I tuoi dati</h2>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label className="text-sm">
                          <span className="text-xs text-[#675f57]">Nome</span>
                          <input autoComplete="given-name" className="mt-1 h-11 w-full border border-[#ddd4c8] bg-white px-3 text-sm" onChange={(event) => setFields((current) => ({ ...current, firstName: event.target.value }))} value={fields.firstName} />
                        </label>
                        <label className="text-sm">
                          <span className="text-xs text-[#675f57]">Cognome</span>
                          <input autoComplete="family-name" className="mt-1 h-11 w-full border border-[#ddd4c8] bg-white px-3 text-sm" onChange={(event) => setFields((current) => ({ ...current, lastName: event.target.value }))} value={fields.lastName} />
                        </label>
                        <label className="text-sm">
                          <span className="text-xs text-[#675f57]">Email</span>
                          <input autoComplete="email" className="mt-1 h-11 w-full border border-[#ddd4c8] bg-white px-3 text-sm" onChange={(event) => setFields((current) => ({ ...current, email: event.target.value }))} type="email" value={fields.email} />
                        </label>
                        <label className="text-sm">
                          <span className="text-xs text-[#675f57]">Telefono</span>
                          <input autoComplete="tel" className="mt-1 h-11 w-full border border-[#ddd4c8] bg-white px-3 text-sm" onChange={(event) => setFields((current) => ({ ...current, phone: event.target.value }))} type="tel" value={fields.phone} />
                        </label>
                        <label className="text-sm sm:col-span-2">
                          <span className="text-xs text-[#675f57]">Qualcosa che vuoi raccontarmi (facoltativo)</span>
                          <textarea className="mt-1 w-full border border-[#ddd4c8] bg-white px-3 py-2 text-sm" onChange={(event) => setFields((current) => ({ ...current, notes: event.target.value }))} rows={3} value={fields.notes} />
                        </label>
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
