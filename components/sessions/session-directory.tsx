"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ClientCombobox } from "@/components/shared/client-combobox";
import { ExportButton } from "@/components/shared/export-button";
import { ImportIcon } from "@/components/shared/icons";
import { MultiSelectFilter } from "@/components/shared/multi-select-filter";

type Client = { id: string; first_name: string; last_name: string; email: string };
type Service = { id: string; name: string };
type Stage = { id: string; name: string; code: string };
type Method = { id: string; name: string };
type Session = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  service_name: string;
  agreed_price_cents: number;
  client: { id: string; first_name: string; last_name: string } | null;
  current_stage: { id: string; name: string; code: string } | null;
  payments: { amount_cents: number }[];
};
type PaymentStatus = "unpaid" | "partial" | "paid";

type SessionForm = { clientId: string; serviceTypeId: string; scheduledAt: string; durationMinutes: string; priceEuros: string; location: string; serviceDetail: string; notes: string };
type QuickClient = { firstName: string; lastName: string; email: string };
type Filters = { clientId: string; serviceTypeIds: string[]; stageIds: string[]; paymentStatuses: string[]; day: string };
type ExpiringVoucher = { id: string; code: string; expires_at: string; purchaser: { first_name: string; last_name: string } | null };
type EligibleVoucher = { id: string; code: string; voucher_type: "service" | "value"; service_name: string | null; value_cents: number | null; purchase_price_cents: number | null };

const VOUCHER_METHOD = "__voucher__";

const emptySession: SessionForm = { clientId: "", serviceTypeId: "", scheduledAt: "", durationMinutes: "", priceEuros: "", location: "", serviceDetail: "", notes: "" };
const emptyFilters: Filters = { clientId: "", serviceTypeIds: [], stageIds: [], paymentStatuses: [], day: "" };
const paymentStatusOptions = [
  { id: "unpaid", name: "Da saldare" },
  { id: "partial", name: "Parzialmente pagata" },
  { id: "paid", name: "Saldata" },
];
const paymentStatusLabels: Record<PaymentStatus, string> = {
  unpaid: "Da saldare",
  partial: "Parzialmente pagata",
  paid: "Saldata",
};
const dateTime = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" });
const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const weekDays = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

function localDayKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function SessionDirectory() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectClient = searchParams.get("newSession") ?? "";
  const [sessions, setSessions] = useState<Session[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [calendarSessions, setCalendarSessions] = useState<Session[]>([]);
  const [page, setPage] = useState(() => Number(searchParams.get("page")) || 1);
  const [pageSize, setPageSize] = useState(() => Number(searchParams.get("pageSize")) || 25);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<Filters>(() => ({
    clientId: searchParams.get("clientId") ?? "",
    serviceTypeIds: searchParams.get("serviceTypeId")?.split(",").filter(Boolean) ?? [],
    stageIds: searchParams.get("stageId")?.split(",").filter(Boolean) ?? [],
    paymentStatuses: searchParams.get("paymentStatus")?.split(",").filter(Boolean) ?? [],
    day: searchParams.get("day") ?? "",
  }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(() => { const now = new Date(); return { year: now.getFullYear(), month: now.getMonth() }; });

  const [sessionForm, setSessionForm] = useState<SessionForm>(preselectClient ? { ...emptySession, clientId: preselectClient } : emptySession);
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickClient, setQuickClient] = useState<QuickClient>({ firstName: "", lastName: "", email: "" });
  const [dialog, setDialog] = useState<"new" | null>(preselectClient || searchParams.get("new") === "1" ? "new" : null);
  const [inline, setInline] = useState<{ type: "stage" | "payment" | "edit"; session: Session } | null>(null);
  const [stageForm, setStageForm] = useState({ stageId: "", changedAt: "", notes: "" });
  const [paymentForm, setPaymentForm] = useState({ amountEuros: "", paidAt: "", methodId: "", category: "balance", notes: "" });
  const [editForm, setEditForm] = useState({ scheduledAt: "", durationMinutes: "", priceEuros: "", location: "", serviceDetail: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [optionsKey, setOptionsKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [expiringVouchers, setExpiringVouchers] = useState<ExpiringVoucher[]>([]);
  const [eligibleVouchers, setEligibleVouchers] = useState<EligibleVoucher[]>([]);
  const [voucherId, setVoucherId] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (filters.clientId) params.set("clientId", filters.clientId);
    if (filters.serviceTypeIds.length > 0) params.set("serviceTypeId", filters.serviceTypeIds.join(","));
    if (filters.stageIds.length > 0) params.set("stageId", filters.stageIds.join(","));
    if (filters.paymentStatuses.length > 0) params.set("paymentStatus", filters.paymentStatuses.join(","));
    return params.toString();
  }, [page, pageSize, filters]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (filters.clientId) params.set("clientId", filters.clientId);
    if (filters.serviceTypeIds.length > 0) params.set("serviceTypeId", filters.serviceTypeIds.join(","));
    if (filters.stageIds.length > 0) params.set("stageId", filters.stageIds.join(","));
    if (filters.paymentStatuses.length > 0) params.set("paymentStatus", filters.paymentStatuses.join(","));
    if (filters.day) params.set("day", filters.day);
    router.replace(`/sessions?${params.toString()}`, { scroll: false });
  }, [page, pageSize, filters, router]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [optionsResponse, paymentResponse] = await Promise.all([fetch("/api/sessions/options"), fetch("/api/payments/options")]);
      const optionsBody = await optionsResponse.json();
      const paymentBody = await paymentResponse.json();
      if (!active) return;
      if (optionsResponse.ok) { setClients(optionsBody.clients); setServices(optionsBody.services); setStages(optionsBody.stages); }
      if (paymentResponse.ok) setMethods(paymentBody.methods);
    })().catch(() => {});
    return () => { active = false; };
  }, [optionsKey]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/sessions?${query}`);
        const body = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(body.error);
        setSessions(body.sessions as Session[]);
        setTotal(body.total as number);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Caricamento non riuscito.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [query, refreshKey]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [sessions]);

  useEffect(() => {
    let active = true;
    (async () => {
      const response = await fetch("/api/sessions?page=1&pageSize=100");
      const body = await response.json();
      if (active && response.ok) setCalendarSessions(body.sessions as Session[]);
    })().catch(() => {});
    return () => { active = false; };
  }, [refreshKey]);

  useEffect(() => {
    let active = true;
    (async () => {
      const response = await fetch("/api/vouchers?status=active");
      const body = await response.json();
      if (active && response.ok) setExpiringVouchers(body.vouchers as ExpiringVoucher[]);
    })().catch(() => {});
    return () => { active = false; };
  }, [refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const selectedService = services.find((service) => service.id === sessionForm.serviceTypeId);
  const endTime = sessionForm.scheduledAt && Number(sessionForm.durationMinutes) > 0 ? new Date(new Date(sessionForm.scheduledAt).getTime() + Number(sessionForm.durationMinutes) * 60_000) : null;

  const visibleSessions = filters.day ? sessions.filter((session) => localDayKey(session.scheduled_at) === filters.day) : sessions;

  const calendarByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const session of calendarSessions) {
      const key = localDayKey(session.scheduled_at);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [calendarSessions]);

  const calendarCells = useMemo(() => {
    const first = new Date(month.year, month.month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
    const cells: (number | null)[] = Array.from({ length: startOffset }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
    return cells;
  }, [month]);

  const monthSummary = useMemo(() => {
    const monthSessions = calendarSessions.filter((session) => {
      const date = new Date(session.scheduled_at);
      return date.getFullYear() === month.year && date.getMonth() === month.month && session.current_stage?.code !== "cancelled";
    });
    let expected = 0;
    let collected = 0;
    let unpaid = 0;
    let settled = 0;
    for (const session of monthSessions) {
      const paid = session.payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
      expected += session.agreed_price_cents;
      collected += paid;
      if (paid === 0) unpaid += 1;
      else if (paid >= session.agreed_price_cents) settled += 1;
    }
    return { total: monthSessions.length, unpaid, settled, expected, collected };
  }, [calendarSessions, month]);

  const soonExpiringVouchers = useMemo(() => {
    const soonIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();
    return expiringVouchers
      .filter((voucher) => voucher.expires_at <= soonIso && voucher.expires_at >= nowIso)
      .sort((a, b) => a.expires_at.localeCompare(b.expires_at))
      .slice(0, 5);
  }, [expiringVouchers]);

  function openNewSession() { setSessionForm(emptySession); setQuickClientOpen(false); setError(null); setDialog("new"); }

  async function submitSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const response = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sessionForm) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setDialog(null); setPage(1); setRefreshKey((key) => key + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Salvataggio non riuscito."); } finally { setBusy(false); }
  }

  async function submitQuickClient() {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(quickClient) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setOptionsKey((key) => key + 1);
      setSessionForm((current) => ({ ...current, clientId: body.client.id }));
      setQuickClient({ firstName: "", lastName: "", email: "" });
      setQuickClientOpen(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Creazione cliente non riuscita."); } finally { setBusy(false); }
  }

  function openInlineStage(session: Session) { setStageForm({ stageId: session.current_stage?.id ?? "", changedAt: toLocalInput(new Date()), notes: "" }); setError(null); setInline({ type: "stage", session }); }
  function openInlinePayment(session: Session) {
    setPaymentForm({ amountEuros: "", paidAt: toLocalInput(new Date()), methodId: methods[0]?.id ?? "", category: "balance", notes: "" });
    setVoucherId("");
    setEligibleVouchers([]);
    setError(null);
    setInline({ type: "payment", session });
    fetch(`/api/sessions/${session.id}/eligible-vouchers`)
      .then((response) => response.json())
      .then((body) => setEligibleVouchers(body.vouchers ?? []))
      .catch(() => setEligibleVouchers([]));
  }
  async function openInlineEdit(session: Session) {
    setError(null);
    setInline({ type: "edit", session });
    setEditForm({
      scheduledAt: toLocalInput(new Date(session.scheduled_at)),
      durationMinutes: String(session.duration_minutes),
      priceEuros: String(session.agreed_price_cents / 100),
      location: "",
      serviceDetail: "",
      notes: "",
    });
    try {
      const response = await fetch(`/api/sessions/${session.id}`);
      const body = await response.json();
      if (response.ok) {
        setEditForm({
          scheduledAt: toLocalInput(new Date(body.session.scheduled_at)),
          durationMinutes: String(body.session.duration_minutes),
          priceEuros: String(body.session.agreed_price_cents / 100),
          location: body.session.location ?? "",
          serviceDetail: body.session.service_detail ?? "",
          notes: body.session.notes ?? "",
        });
      }
    } catch {
      // keep the partial prefill already applied above
    }
  }

  async function submitInlineStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!inline) return; setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/sessions/${inline.session.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateStage", ...stageForm }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setInline(null); setRefreshKey((key) => key + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Aggiornamento non riuscito."); } finally { setBusy(false); }
  }

  async function submitInlinePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!inline) return; setBusy(true); setError(null);
    try {
      const response = paymentForm.methodId === VOUCHER_METHOD
        ? await fetch(`/api/sessions/${inline.session.id}/redeem`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voucherId }) })
        : await fetch(`/api/sessions/${inline.session.id}/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(paymentForm) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setInline(null); setRefreshKey((key) => key + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Registrazione non riuscita."); } finally { setBusy(false); }
  }

  async function submitInlineEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!inline) return; setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/sessions/${inline.session.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setInline(null); setRefreshKey((key) => key + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Aggiornamento non riuscito."); } finally { setBusy(false); }
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(visibleSessions.map((session) => session.id)) : new Set());
  }

  function toggleSelectOne(id: string, checked: boolean) {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (checked) nextIds.add(id); else nextIds.delete(id);
      return nextIds;
    });
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0 || isDeleting) return;
    if (!window.confirm(`Eliminare ${selectedIds.size} sessione/i selezionata/e?`)) return;

    setIsDeleting(true);
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map(async (id) => {
          const response = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
          return { id, ok: response.ok };
        }),
      );

      if (results.some((result) => !result.ok)) {
        setError("Alcune sessioni non sono state eliminate perche hanno pagamenti collegati.");
      }

      setSelectedIds(new Set());
      setRefreshKey((key) => key + 1);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-[#d8d0c5] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold sm:text-4xl">Sessioni</h1>
            <p className="mt-2 text-sm text-[#675f57]">Agenda, lavorazioni e stato degli incassi.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedIds.size > 0 ? (
              <button className="grid h-11 place-items-center border border-[#a53e31] px-5 text-sm font-semibold text-[#a53e31] hover:bg-[#fff1ef] disabled:cursor-wait disabled:opacity-60" disabled={isDeleting} onClick={handleDeleteSelected} type="button">
                {isDeleting ? "Eliminazione..." : `Elimina selezionate (${selectedIds.size})`}
              </button>
            ) : null}
            <Link
              aria-label="Importa"
              className="grid size-11 place-items-center border border-[#9b5d43] text-[#9b5d43] transition-colors hover:bg-[#f1e3db]"
              href="/sessions/import"
              title="Importa"
            >
              <ImportIcon />
            </Link>
            <ExportButton
              fetchRows={async () => {
                const params = new URLSearchParams({ page: "1", pageSize: "10000" });
                if (filters.clientId) params.set("clientId", filters.clientId);
                if (filters.serviceTypeIds.length > 0) params.set("serviceTypeId", filters.serviceTypeIds.join(","));
                if (filters.stageIds.length > 0) params.set("stageId", filters.stageIds.join(","));
                if (filters.paymentStatuses.length > 0) params.set("paymentStatus", filters.paymentStatuses.join(","));
                const response = await fetch(`/api/sessions?${params.toString()}`);
                const body = await response.json();
                const rows = (body.sessions ?? []) as Session[];
                const filtered = filters.day ? rows.filter((session) => localDayKey(session.scheduled_at) === filters.day) : rows;
                return filtered.map((session) => ({
                  Cliente: session.client ? `${session.client.first_name} ${session.client.last_name}` : "",
                  Servizio: session.service_name,
                  "Data/ora": dateTime.format(new Date(session.scheduled_at)),
                  "Durata (min)": session.duration_minutes,
                  "Prezzo concordato": (session.agreed_price_cents / 100).toFixed(2),
                  Pagato: (session.payments.reduce((sum, payment) => sum + payment.amount_cents, 0) / 100).toFixed(2),
                  Avanzamento: session.current_stage?.name ?? "",
                }));
              }}
              filename="sessioni"
            />
            <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white" onClick={openNewSession} type="button">Nuova sessione</button>
          </div>
        </header>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ClientCombobox clients={clients} emptyLabel="Tutti" onChange={(value) => { setFilters({ ...filters, clientId: value }); setPage(1); }} required={false} value={filters.clientId} />
          <MultiSelectFilter label="Servizio" onChange={(ids) => { setFilters({ ...filters, serviceTypeIds: ids }); setPage(1); }} options={services} selected={filters.serviceTypeIds} />
          <MultiSelectFilter label="Avanzamento" onChange={(ids) => { setFilters({ ...filters, stageIds: ids }); setPage(1); }} options={stages} selected={filters.stageIds} />
          <MultiSelectFilter label="Pagamento" onChange={(ids) => { setFilters({ ...filters, paymentStatuses: ids }); setPage(1); }} options={paymentStatusOptions} selected={filters.paymentStatuses} />
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <input
                checked={visibleSessions.length > 0 && selectedIds.size === visibleSessions.length}
                className="size-4 accent-[#9b5d43]"
                disabled={visibleSessions.length === 0}
                onChange={(event) => toggleSelectAll(event.target.checked)}
                type="checkbox"
              />
              Seleziona tutte
            </label>
            {filters.day ? <button className="border border-[#cfc5b8] px-3 py-1 text-xs font-semibold" onClick={() => setFilters({ ...filters, day: "" })} type="button">Giorno: {filters.day} &times;</button> : null}
          </div>
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <section className="overflow-hidden border border-[#d8d0c5] bg-white">
              {loading ? <p className="p-8 text-sm text-[#675f57]">Caricamento sessioni...</p> : visibleSessions.length === 0 ? <p className="p-10 text-center text-sm text-[#675f57]">Nessuna sessione da mostrare.</p> : visibleSessions.map((session) => {
                const paid = session.payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
                const paymentStatus: PaymentStatus = paid === 0 ? "unpaid" : paid < session.agreed_price_cents ? "partial" : "paid";
                const status = paymentStatusLabels[paymentStatus];
                return (
                  <article className="flex flex-col gap-3 border-b border-[#eee8df] px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between" key={session.id}>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <input
                        aria-label="Seleziona sessione"
                        checked={selectedIds.has(session.id)}
                        className="size-4 shrink-0 accent-[#9b5d43]"
                        onChange={(event) => toggleSelectOne(session.id, event.target.checked)}
                        type="checkbox"
                      />
                      <PaymentStatusFlag status={paymentStatus} />
                      <Link className="min-w-0 flex-1 hover:underline" href={`/sessions/${session.id}`}>
                        <p className="text-sm font-semibold">{dateTime.format(new Date(session.scheduled_at))}</p>
                        <p className="mt-1 text-xs text-[#675f57]">{session.client ? `${session.client.first_name} ${session.client.last_name}` : "-"} - {session.service_name} - {session.current_stage?.name ?? "-"} - {status}</p>
                      </Link>
                    </div>
                    <div className="flex gap-2">
                      <button className="border border-[#cfc5b8] px-3 py-1 text-xs font-semibold hover:bg-[#eee8df]" onClick={() => openInlineEdit(session)} type="button">Modifica</button>
                      <button className="border border-[#cfc5b8] px-3 py-1 text-xs font-semibold hover:bg-[#eee8df]" onClick={() => openInlineStage(session)} type="button">Avanzamento</button>
                      <button className="border border-[#cfc5b8] px-3 py-1 text-xs font-semibold hover:bg-[#eee8df]" onClick={() => openInlinePayment(session)} type="button">Pagamento</button>
                    </div>
                  </article>
                );
              })}
            </section>

            <div className="mt-5 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span>{total} sessioni</span>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2">Per pagina
                  <select className="h-10 border border-[#cfc5b8] bg-white px-2" onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} value={pageSize}>{[10, 25, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}</select>
                </label>
                <div className="flex items-center gap-2">
                  <button className="h-10 border border-[#cfc5b8] px-3 disabled:opacity-40" disabled={page === 1} onClick={() => setPage(page - 1)} type="button">Precedente</button>
                  <span>Pagina {page} di {totalPages}</span>
                  <button className="h-10 border border-[#cfc5b8] px-3 disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage(page + 1)} type="button">Successiva</button>
                </div>
              </div>
            </div>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="border border-[#d8d0c5] bg-white p-4">
              <div className="flex items-center justify-between">
                <button className="size-8 border border-[#cfc5b8]" onClick={() => setMonth(({ year, month: current }) => current === 0 ? { year: year - 1, month: 11 } : { year, month: current - 1 })} type="button">&lt;</button>
                <p className="text-sm font-semibold">{monthNames[month.month]} {month.year}</p>
                <button className="size-8 border border-[#cfc5b8]" onClick={() => setMonth(({ year, month: current }) => current === 11 ? { year: year + 1, month: 0 } : { year, month: current + 1 })} type="button">&gt;</button>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[#675f57]">{weekDays.map((day) => <span key={day}>{day}</span>)}</div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {calendarCells.map((day, index) => {
                  if (!day) return <span key={`empty-${index}`} />;
                  const key = `${month.year}-${String(month.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const count = calendarByDay.get(key) ?? 0;
                  const isSelected = filters.day === key;
                  return (
                    <button className={`aspect-square border text-xs ${isSelected ? "border-[#9b5d43] bg-[#9b5d43] text-white" : count ? "border-[#9b5d43] bg-[#f1e3db]" : "border-[#eee8df]"}`} key={key} onClick={() => setFilters({ ...filters, day: isSelected ? "" : key })} type="button">
                      <span className="block">{day}</span>
                      {count ? <span className="block text-[10px]">{count}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border border-[#d8d0c5] bg-white p-4">
              <h2 className="text-sm font-semibold">Riepilogo {monthNames[month.month]} {month.year}</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-[#675f57]">Sessioni</dt><dd className="font-semibold">{monthSummary.total}</dd></div>
                <div><dt className="text-xs text-[#675f57]">Da saldare</dt><dd className="font-semibold">{monthSummary.unpaid}</dd></div>
                <div><dt className="text-xs text-[#675f57]">Saldate</dt><dd className="font-semibold">{monthSummary.settled}</dd></div>
                <div><dt className="text-xs text-[#675f57]">Incasso previsto</dt><dd className="font-semibold">{euro.format(monthSummary.expected / 100)}</dd></div>
                <div className="col-span-2"><dt className="text-xs text-[#675f57]">Incassato</dt><dd className="font-semibold">{euro.format(monthSummary.collected / 100)}</dd></div>
              </dl>
            </div>

            <div className="border border-[#d8d0c5] bg-white p-4">
              <h2 className="text-sm font-semibold">Buoni in scadenza</h2>
              {soonExpiringVouchers.length === 0 ? (
                <p className="mt-3 text-sm text-[#675f57]">Nessun buono in scadenza nei prossimi 30 giorni.</p>
              ) : (
                <div className="mt-3 divide-y divide-[#eee8df]">
                  {soonExpiringVouchers.map((voucher) => (
                    <Link className="flex items-center justify-between gap-3 py-2 text-sm hover:underline" href={`/vouchers/${voucher.id}`} key={voucher.id}>
                      <span className="min-w-0 truncate font-medium">{voucher.code}{voucher.purchaser ? ` - ${voucher.purchaser.first_name} ${voucher.purchaser.last_name}` : ""}</span>
                      <span className="shrink-0 text-xs text-[#675f57]">{dateOnly.format(new Date(voucher.expires_at))}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      {dialog === "new" ? (
        <Modal onClose={() => setDialog(null)} title="Nuova sessione">
          <form onSubmit={submitSession}>
            <div className="grid gap-4 sm:grid-cols-2">
              <ClientCombobox clients={clients} onChange={(clientId) => setSessionForm({ ...sessionForm, clientId })} value={sessionForm.clientId} />
              <SelectField label="Servizio" onChange={(value) => setSessionForm({ ...sessionForm, serviceTypeId: value, serviceDetail: "" })} options={services} value={sessionForm.serviceTypeId} />
              <InputField label="Data e ora" onChange={(value) => setSessionForm({ ...sessionForm, scheduledAt: value })} type="datetime-local" value={sessionForm.scheduledAt} />
              <InputField label="Durata (minuti)" min="1" onChange={(value) => setSessionForm({ ...sessionForm, durationMinutes: value })} type="number" value={sessionForm.durationMinutes} />
              <InputField label="Prezzo concordato (EUR)" min="0" onChange={(value) => setSessionForm({ ...sessionForm, priceEuros: value })} type="number" value={sessionForm.priceEuros} />
              <InputField label="Luogo" optional onChange={(value) => setSessionForm({ ...sessionForm, location: value })} value={sessionForm.location} />
              {selectedService?.name === "Altro" ? <InputField label="Specifica il servizio" onChange={(value) => setSessionForm({ ...sessionForm, serviceDetail: value })} value={sessionForm.serviceDetail} /> : null}
            </div>
            {endTime ? <p className="mt-3 text-sm text-[#675f57]">Fine prevista: {dateTime.format(endTime)}</p> : null}

            <div className="mt-4 border-t border-[#d8d0c5] pt-4">
              <button className="text-sm font-semibold text-[#9b5d43]" onClick={() => setQuickClientOpen((open) => !open)} type="button">{quickClientOpen ? "Chiudi creazione rapida cliente" : "Crea rapidamente un nuovo cliente"}</button>
              {quickClientOpen ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <InputField label="Nome" onChange={(value) => setQuickClient({ ...quickClient, firstName: value })} value={quickClient.firstName} bare />
                  <InputField label="Cognome" onChange={(value) => setQuickClient({ ...quickClient, lastName: value })} value={quickClient.lastName} bare />
                  <InputField label="Email" onChange={(value) => setQuickClient({ ...quickClient, email: value })} value={quickClient.email} bare />
                  <div className="sm:col-span-3"><button className="h-10 bg-[#27231f] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || !quickClient.firstName || !quickClient.lastName || !quickClient.email} onClick={submitQuickClient} type="button">Salva e seleziona cliente</button></div>
                </div>
              ) : null}
            </div>

            <label className="mt-4 flex flex-col gap-2 text-sm font-medium">Note
              <textarea className="min-h-20 border border-[#cfc5b8] bg-white p-3" onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })} value={sessionForm.notes} />
            </label>
            {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
            <ModalActions busy={busy} onCancel={() => setDialog(null)} submitLabel="Salva sessione" />
          </form>
        </Modal>
      ) : null}

      {inline?.type === "edit" ? (
        <Modal onClose={() => setInline(null)} title="Modifica sessione">
          <form onSubmit={submitInlineEdit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Data e ora" onChange={(value) => setEditForm({ ...editForm, scheduledAt: value })} type="datetime-local" value={editForm.scheduledAt} />
              <InputField label="Durata (minuti)" min="1" onChange={(value) => setEditForm({ ...editForm, durationMinutes: value })} type="number" value={editForm.durationMinutes} />
              <InputField label="Prezzo concordato (EUR)" min="0" onChange={(value) => setEditForm({ ...editForm, priceEuros: value })} type="number" value={editForm.priceEuros} />
              <InputField label="Luogo" optional onChange={(value) => setEditForm({ ...editForm, location: value })} value={editForm.location} />
              {inline.session.service_name === "Altro" ? <InputField label="Specifica il servizio" onChange={(value) => setEditForm({ ...editForm, serviceDetail: value })} value={editForm.serviceDetail} /> : null}
            </div>
            <label className="mt-4 flex flex-col gap-2 text-sm font-medium">Note
              <textarea className="min-h-20 border border-[#cfc5b8] bg-white p-3" onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} value={editForm.notes} />
            </label>
            {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
            <ModalActions busy={busy} onCancel={() => setInline(null)} submitLabel="Salva modifiche" />
          </form>
        </Modal>
      ) : null}

      {inline?.type === "stage" ? (
        <Modal onClose={() => setInline(null)} title="Aggiorna avanzamento">
          <form onSubmit={submitInlineStage}>
            <label className="flex flex-col gap-2 text-sm font-medium">Avanzamento
              <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setStageForm({ ...stageForm, stageId: e.target.value })} required value={stageForm.stageId}>
                <option value="">Seleziona</option>
                {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
              </select>
            </label>
            <label className="mt-4 flex flex-col gap-2 text-sm font-medium">Data e ora<input className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setStageForm({ ...stageForm, changedAt: e.target.value })} required type="datetime-local" value={stageForm.changedAt} /></label>
            <label className="mt-4 flex flex-col gap-2 text-sm font-medium">Nota<textarea className="min-h-20 border border-[#cfc5b8] bg-white p-3" onChange={(e) => setStageForm({ ...stageForm, notes: e.target.value })} value={stageForm.notes} /></label>
            {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
            <ModalActions busy={busy} onCancel={() => setInline(null)} submitLabel="Salva avanzamento" />
          </form>
        </Modal>
      ) : null}

      {inline?.type === "payment" ? (
        <Modal onClose={() => setInline(null)} title="Aggiungi pagamento">
          <form onSubmit={submitInlinePayment}>
            <label className="flex flex-col gap-2 text-sm font-medium">Metodo
              <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setPaymentForm({ ...paymentForm, methodId: e.target.value })} required value={paymentForm.methodId}>
                <option value="">Seleziona</option>
                {eligibleVouchers.length > 0 ? <option value={VOUCHER_METHOD}>Buono regalo</option> : null}
                {methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
              </select>
            </label>
            {paymentForm.methodId === VOUCHER_METHOD ? (
              <label className="mt-4 flex flex-col gap-2 text-sm font-medium">Buono
                <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setVoucherId(e.target.value)} required value={voucherId}>
                  <option value="">Seleziona</option>
                  {eligibleVouchers.map((voucher) => <option key={voucher.id} value={voucher.id}>{voucher.code} - {voucher.voucher_type === "value" ? euro.format((voucher.value_cents ?? 0) / 100) : `Sessione ${voucher.service_name ?? ""} (${euro.format((voucher.purchase_price_cents ?? 0) / 100)})`}</option>)}
                </select>
              </label>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <InputField label="Importo (EUR)" min="1" onChange={(value) => setPaymentForm({ ...paymentForm, amountEuros: value })} type="number" value={paymentForm.amountEuros} />
                <InputField label="Data" onChange={(value) => setPaymentForm({ ...paymentForm, paidAt: value })} type="datetime-local" value={paymentForm.paidAt} />
                <label className="flex flex-col gap-2 text-sm font-medium">Causale
                  <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setPaymentForm({ ...paymentForm, category: e.target.value })} required value={paymentForm.category}>
                    <option value="deposit">Caparra</option>
                    <option value="balance">Saldo</option>
                    <option value="full_payment">Pagamento completo</option>
                  </select>
                </label>
              </div>
            )}
            {paymentForm.methodId === VOUCHER_METHOD ? null : <label className="mt-4 flex flex-col gap-2 text-sm font-medium">Note<textarea className="min-h-20 border border-[#cfc5b8] bg-white p-3" onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} value={paymentForm.notes} /></label>}
            {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
            <ModalActions busy={busy} onCancel={() => setInline(null)} submitLabel="Salva pagamento" />
          </form>
        </Modal>
      ) : null}
    </main>
  );
}

function SelectField({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: { id: string; name: string }[]; value: string }) {
  return <label className="flex flex-col gap-2 text-sm font-medium">{label}<select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(event) => onChange(event.target.value)} required value={value}><option value="">Seleziona</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>;
}

function InputField({ label, onChange, type = "text", value, min, optional = false, bare = false }: { label: string; onChange: (value: string) => void; type?: string; value: string; min?: string; optional?: boolean; bare?: boolean }) {
  return <label className="flex flex-col gap-2 text-sm font-medium">{label}<input className="h-11 border border-[#cfc5b8] bg-white px-3" min={min} onChange={(event) => onChange(event.target.value)} required={!optional && !bare} type={type} value={value} /></label>;
}

function PaymentStatusFlag({ status }: { status: PaymentStatus }) {
  const color = status === "unpaid" ? "#a53e31" : status === "partial" ? "#c69214" : "#367e4a";
  const label = paymentStatusLabels[status];

  return (
    <span aria-label={label} className="shrink-0" role="img" title={label}>
      <svg aria-hidden="true" className="size-5" fill={color} viewBox="0 0 24 24">
        <path d="M5 3a1 1 0 0 1 2 0v1.1c3-1.2 6.1 1.2 10-.2a1 1 0 0 1 1.34.94v9.32a1 1 0 0 1-.66.94C13.8 16.48 10.2 14 7 15.2V21a1 1 0 1 1-2 0V3Z" />
      </svg>
    </span>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div aria-modal="true" className="fixed inset-0 z-10 grid place-items-center bg-[#27231f]/45 p-4" role="dialog">
      <section className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto bg-[#fdfbf8] p-6 shadow-xl">
        <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">{title}</h2><button aria-label="Chiudi" className="size-9 border border-[#cfc5b8]" onClick={onClose} type="button">x</button></div>
        <div className="mt-6">{children}</div>
      </section>
    </div>
  );
}

function ModalActions({ busy, onCancel, submitLabel }: { busy: boolean; onCancel: () => void; submitLabel: string }) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      <button className="h-11 px-4 text-sm font-semibold" onClick={onCancel} type="button">Annulla</button>
      <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? "Salvataggio..." : submitLabel}</button>
    </div>
  );
}
