"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { FollowUpLabel, LeadActionDialog, type LeadActionMode, LeadStatusBadge, leadStatusColor, patchLead } from "@/components/leads/lead-ui";
import { ActionMenu } from "@/components/shared/action-menu";
import { Modal } from "@/components/shared/modal";
import { LEAD_SOURCES, LEAD_SOURCE_LABELS, LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadWithService, isLeadOpen, leadFullName } from "@/lib/leads";

type Service = { id: string; name: string; is_active: boolean };
type Counts = { toHandle: number; infoSent: number; followUp: number; open: number };
type Filters = { status: string; serviceTypeId: string; source: string; year: string };

const dateOnly = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" });
const emptyForm = { name: "", lastName: "", serviceTypeId: "", contact: "", source: "", requestedPeriod: "", notes: "" };
const gridColumns = "sm:grid-cols-[1.1fr_0.9fr_0.8fr_0.8fr_0.8fr_0.9fr_0.7fr_44px]";

export function LeadDirectory() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<LeadWithService[]>([]);
  const [counts, setCounts] = useState<Counts>({ toHandle: 0, infoSent: 0, followUp: 0, open: 0 });
  const [services, setServices] = useState<Service[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>(() => ({
    status: searchParams.get("status") ?? "",
    serviceTypeId: searchParams.get("serviceTypeId") ?? "",
    source: searchParams.get("source") ?? "",
    year: searchParams.get("year") ?? "",
  }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialog, setDialog] = useState<"new" | "created" | null>(searchParams.get("new") === "1" ? "new" : null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createdLead, setCreatedLead] = useState<LeadWithService | null>(null);
  const [action, setAction] = useState<{ lead: LeadWithService; mode: LeadActionMode } | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    return params.toString();
  }, [filters]);

  useEffect(() => {
    router.replace(`/leads${query ? `?${query}` : ""}`, { scroll: false });
  }, [query, router]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/leads?${query}`);
        const body = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(body.error);
        setLeads(body.leads as LeadWithService[]);
        setCounts(body.counts as Counts);
        setServices(body.services as Service[]);
        setYears(body.years as string[]);
        setError(null);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Caricamento non riuscito.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [query, refreshKey]);

  function openNew() {
    setForm(emptyForm);
    setFormError(null);
    setDialog("new");
  }

  async function submitNew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const response = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setCreatedLead(body.lead as LeadWithService);
      setDialog("created");
      setRefreshKey((key) => key + 1);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Creazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function markInfoSent(id: string) {
    setBusy(true);
    setError(null);
    try {
      await patchLead(id, { action: "info_sent" });
      setDialog(null);
      setRefreshKey((key) => key + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Aggiornamento non riuscito.");
      setDialog(null);
    } finally {
      setBusy(false);
    }
  }

  function actionItems(lead: LeadWithService) {
    const items = [{ label: "Apri scheda", onClick: () => router.push(`/leads/${lead.id}`) }];
    if (!isLeadOpen(lead.status)) return items;
    if (lead.status !== "info_sent") items.push({ label: "Segna Info inviate", onClick: () => void markInfoSent(lead.id) });
    items.push(
      { label: "Da ricontattare", onClick: () => setAction({ lead, mode: "follow_up" }) },
      { label: "Prenotato", onClick: () => router.push(`/leads/${lead.id}?convert=1`) },
      { label: "Perso", onClick: () => setAction({ lead, mode: "lost" }) },
    );
    return items;
  }

  const selectClass = "h-11 border border-[#cfc5b8] bg-white px-3";

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-[#d8d0c5] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold sm:text-4xl">Lead</h1>
            <p className="mt-2 text-sm text-[#675f57]">Richieste commerciali prima della prenotazione.</p>
          </div>
          <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white" onClick={openNew} type="button">+ Nuovo Lead</button>
        </header>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <CounterCard color={leadStatusColor("to_handle")} label="Da gestire" value={counts.toHandle} />
          <CounterCard color={leadStatusColor("info_sent")} label="Info inviate" value={counts.infoSent} />
          <CounterCard color={leadStatusColor("follow_up")} label="Da ricontattare" value={counts.followUp} />
          <CounterCard color="#675f57" label="Totale Lead aperti" value={counts.open} />
        </div>

        <div className="mt-7 grid grid-cols-2 gap-4 sm:flex sm:flex-wrap">
          <label className="flex flex-col gap-2 text-sm font-medium">Stato
            <select className={selectClass} onChange={(e) => setFilters({ ...filters, status: e.target.value })} value={filters.status}>
              <option value="">Tutti</option>
              {LEAD_STATUSES.map((status) => <option key={status} value={status}>{LEAD_STATUS_LABELS[status]}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">Servizio
            <select className={selectClass} onChange={(e) => setFilters({ ...filters, serviceTypeId: e.target.value })} value={filters.serviceTypeId}>
              <option value="">Tutti</option>
              {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">Origine
            <select className={selectClass} onChange={(e) => setFilters({ ...filters, source: e.target.value })} value={filters.source}>
              <option value="">Tutte</option>
              {LEAD_SOURCES.map((source) => <option key={source} value={source}>{LEAD_SOURCE_LABELS[source]}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">Anno di ingresso
            <select className={selectClass} onChange={(e) => setFilters({ ...filters, year: e.target.value })} value={filters.year}>
              <option value="">Tutti</option>
              {(filters.year && !years.includes(filters.year) ? [filters.year, ...years] : years).map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
        </div>

        {error ? <p className="mt-5 text-sm text-[#a53e31]">{error}</p> : null}

        <section className="mt-5 border border-[#d8d0c5] bg-white">
          <div className={`hidden gap-3 bg-[#eee8df] px-5 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#675f57] sm:grid ${gridColumns}`}>
            <span>Nome</span><span>Servizio</span><span>Stato</span><span>Origine</span><span>Data ingresso</span><span>Periodo richiesto</span><span>Follow-up</span><span className="sr-only">Azioni</span>
          </div>
          {loading ? <p className="p-8 text-sm text-[#675f57]">Caricamento lead...</p> : leads.length === 0 ? <p className="p-10 text-center text-sm text-[#675f57]">Nessun lead da mostrare.</p> : leads.map((lead) => (
            <article className={`flex flex-col gap-2 border-t border-[#eee8df] px-5 py-4 text-sm sm:grid sm:items-center sm:gap-3 ${gridColumns}`} key={lead.id}>
              <div className="flex items-start justify-between gap-3 sm:contents">
                <Link className="min-w-0 truncate font-semibold hover:underline" href={`/leads/${lead.id}`}>{leadFullName(lead)}</Link>
                <span className="sm:hidden"><LeadStatusBadge status={lead.status} /></span>
              </div>
              <span className="min-w-0 truncate">{lead.service?.name ?? "-"}</span>
              <span className="hidden sm:block"><LeadStatusBadge status={lead.status} /></span>
              <span><span className="text-xs text-[#675f57] sm:hidden">Origine: </span>{LEAD_SOURCE_LABELS[lead.source]}</span>
              <span><span className="text-xs text-[#675f57] sm:hidden">Ingresso: </span>{dateOnly.format(new Date(lead.created_at))}</span>
              <span className="min-w-0 truncate">{lead.requested_period ? <><span className="text-xs text-[#675f57] sm:hidden">Periodo: </span>{lead.requested_period}</> : null}</span>
              <span>{lead.status === "follow_up" && lead.follow_up_at ? <><span className="text-xs text-[#675f57] sm:hidden">Follow-up: </span><FollowUpLabel dateKey={lead.follow_up_at} /></> : null}</span>
              <span className="flex justify-end"><ActionMenu items={actionItems(lead)} /></span>
            </article>
          ))}
        </section>
      </section>

      {dialog === "new" ? (
        <Modal onClose={() => setDialog(null)} title="Nuovo Lead">
          <form onSubmit={submitNew}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">Nome
                <input autoFocus className="h-11 border border-[#cfc5b8] bg-white px-3" maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} required value={form.name} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Cognome (facoltativo)
                <input className="h-11 border border-[#cfc5b8] bg-white px-3" maxLength={120} onChange={(e) => setForm({ ...form, lastName: e.target.value })} value={form.lastName} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Servizio
                <select className={selectClass} onChange={(e) => setForm({ ...form, serviceTypeId: e.target.value })} required value={form.serviceTypeId}>
                  <option value="">Seleziona</option>
                  {services.filter((service) => service.is_active).map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Contatto
                <input className="h-11 border border-[#cfc5b8] bg-white px-3" maxLength={200} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="Telefono, email o profilo" required value={form.contact} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Origine
                <select className={selectClass} onChange={(e) => setForm({ ...form, source: e.target.value })} required value={form.source}>
                  <option value="">Seleziona</option>
                  {LEAD_SOURCES.map((source) => <option key={source} value={source}>{LEAD_SOURCE_LABELS[source]}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Periodo richiesto (facoltativo)
                <input className="h-11 border border-[#cfc5b8] bg-white px-3" maxLength={200} onChange={(e) => setForm({ ...form, requestedPeriod: e.target.value })} placeholder="Es. fine novembre, weekend" value={form.requestedPeriod} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">Note (facoltative)
                <textarea className="min-h-20 border border-[#cfc5b8] bg-white p-3" maxLength={2000} onChange={(e) => setForm({ ...form, notes: e.target.value })} value={form.notes} />
              </label>
            </div>
            {formError ? <p className="mt-4 text-sm text-[#a53e31]">{formError}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button className="h-11 px-4 text-sm font-semibold" onClick={() => setDialog(null)} type="button">Annulla</button>
              <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? "Salvataggio..." : "Salva lead"}</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {dialog === "created" && createdLead ? (
        <Modal onClose={() => setDialog(null)} title="Lead salvato">
          <p className="text-sm text-[#675f57]"><strong className="text-[#27231f]">{leadFullName(createdLead)}</strong> è stato aggiunto come &quot;Da gestire&quot;.</p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button className="h-11 px-4 text-sm font-semibold" onClick={() => setDialog(null)} type="button">Chiudi</button>
            <button className="h-11 border border-[#9b5d43] px-5 text-sm font-semibold text-[#9b5d43] hover:bg-[#f1e3db]" onClick={() => router.push(`/leads/${createdLead.id}`)} type="button">Apri Lead</button>
            <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={() => void markInfoSent(createdLead.id)} type="button">Segna Info inviate</button>
          </div>
        </Modal>
      ) : null}

      {action ? (
        <LeadActionDialog
          lead={action.lead}
          mode={action.mode}
          onClose={() => setAction(null)}
          onSaved={() => { setAction(null); setRefreshKey((key) => key + 1); }}
        />
      ) : null}
    </main>
  );
}

function CounterCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-start border border-[#d8d0c5] bg-white p-4">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#675f57]">
        <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="mt-2 text-3xl font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}
