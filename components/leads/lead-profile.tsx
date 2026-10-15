"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { LeadConversionDialog } from "@/components/leads/lead-conversion-dialog";
import { FollowUpLabel, LeadActionDialog, type LeadActionMode, LeadStatusBadge, formatDateKey, patchLead } from "@/components/leads/lead-ui";
import { ClientCombobox } from "@/components/shared/client-combobox";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { Modal } from "@/components/shared/modal";
import { LEAD_CONTACT_TYPE_LABELS, LEAD_CONTACT_TYPE_TOOLTIP, LEAD_CONTACT_TYPES, LEAD_LOST_REASON_LABELS, LEAD_SOURCE_LABELS, type LeadContactType, type LeadDetail, isLeadOpen, leadFullName } from "@/lib/leads";

const dateOnly = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" });
const dateTime = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" });
type ClientOption = { id: string; first_name: string; last_name: string; email: string; is_archived: boolean };

export function LeadProfile({ leadId }: { leadId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<LeadActionMode | null>(null);
  const [converting, setConverting] = useState(searchParams.get("convert") === "1");
  const [showConverted, setShowConverted] = useState(searchParams.get("converted") === "1");
  const [editingContactType, setEditingContactType] = useState(false);
  const [contactType, setContactType] = useState<LeadContactType | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [savingContactType, setSavingContactType] = useState(false);

  useEffect(() => {
    if (searchParams.has("convert") || searchParams.has("converted")) router.replace(`/leads/${leadId}`, { scroll: false });
  }, [leadId, router, searchParams]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/leads/${leadId}`);
        const body = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(body.error);
        setLead(body.lead as LeadDetail);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Caricamento non riuscito.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [leadId]);

  async function markInfoSent() {
    setBusy(true);
    setError(null);
    try {
      setLead(await patchLead(leadId, { action: "info_sent" }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Aggiornamento non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  async function editContactType() {
    setContactType(lead?.contact_type ?? null);
    setSelectedClientId(lead?.client_id ?? "");
    setEditingContactType(true);
    try {
      const response = await fetch("/api/sessions/options?includeArchived=1");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setClients(body.clients as ClientOption[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ricerca clienti non riuscita.");
    }
  }

  async function saveContactType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contactType) return;
    setSavingContactType(true);
    try {
      setLead(await patchLead(leadId, { action: "contact_type", contactType, clientId: contactType === "existing_client" ? selectedClientId : "" }));
      setEditingContactType(false);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Aggiornamento non riuscito.");
    } finally {
      setSavingContactType(false);
    }
  }

  if (loading) return <main className="p-8 text-sm text-[#675f57]">Caricamento lead...</main>;
  if (!lead) return <main className="p-8"><p className="text-sm text-[#a53e31]">{error ?? "Lead non trovato."}</p><Link className="mt-4 inline-block text-sm font-semibold text-[#9b5d43]" href="/leads">Torna ai lead</Link></main>;

  const open = isLeadOpen(lead.status);
  const secondaryButton = "h-11 border border-[#9b5d43] px-4 text-sm font-semibold text-[#9b5d43] hover:bg-[#f1e3db] disabled:opacity-60";

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-4xl">
        <Link className="text-sm font-semibold text-[#9b5d43] hover:underline" href="/leads">Tutti i lead</Link>
        <header className="mt-6 flex flex-col gap-4 border-b border-[#d8d0c5] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#9b5d43]">Scheda lead</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{leadFullName(lead)}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2"><LeadStatusBadge status={lead.status} /><span className="border border-[#d8d0c5] bg-white px-2 py-0.5 text-xs">{lead.contact_type ? LEAD_CONTACT_TYPE_LABELS[lead.contact_type] : "Non classificato"}</span></div>
          </div>
          {open ? (
            <div className="flex flex-wrap gap-2">
              {lead.status !== "info_sent" ? <button className={secondaryButton} disabled={busy} onClick={() => void markInfoSent()} type="button">Segna Info inviate</button> : null}
              <button className={secondaryButton} disabled={busy} onClick={() => setMode("follow_up")} type="button">Da ricontattare</button>
              <button className="h-11 bg-[#9b5d43] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={() => setConverting(true)} type="button">Prenotato</button>
              <button className="h-11 border border-[#a53e31] px-4 text-sm font-semibold text-[#a53e31] hover:bg-[#f6e4e1] disabled:opacity-60" disabled={busy} onClick={() => setMode("lost")} type="button">Perso</button>
            </div>
          ) : null}
          {lead.status !== "booked" ? <button className="h-10 border border-[#cfc5b8] px-3 text-sm font-semibold text-[#675f57] hover:bg-white" onClick={() => void editContactType()} type="button">Modifica tipo contatto</button> : null}
        </header>

        {error ? <p className="mt-5 text-sm text-[#a53e31]">{error}</p> : null}

        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Card label="Servizio">{lead.service?.name ?? "-"}</Card>
          <Card label="Contatto"><span className="break-words">{lead.contact}</span></Card>
          <Card label="Origine">{LEAD_SOURCE_LABELS[lead.source]}</Card>
          <Card label="Tipo contatto">{lead.contact_type ? LEAD_CONTACT_TYPE_LABELS[lead.contact_type] : "Non classificato"}</Card>
          <Card label="Data ingresso">{dateOnly.format(new Date(lead.created_at))}</Card>
          <Card label="Periodo richiesto">{lead.requested_period ?? "-"}</Card>
          {lead.info_sent_at ? <Card label="Info inviate il">{dateTime.format(new Date(lead.info_sent_at))}</Card> : null}
          {lead.follow_up_at ? <Card label="Follow-up">{lead.status === "follow_up" ? <FollowUpLabel dateKey={lead.follow_up_at} /> : formatDateKey(lead.follow_up_at)}</Card> : null}
          {lead.lost_reason ? <Card label="Motivo perdita">{LEAD_LOST_REASON_LABELS[lead.lost_reason]}</Card> : null}
          {lead.closed_at ? <Card label="Chiuso il">{dateTime.format(new Date(lead.closed_at))}</Card> : null}
          {lead.client ? <Card label="Cliente"><Link className="hover:underline" href={`/clients/${lead.client.id}`}>{lead.client.first_name} {lead.client.last_name}</Link></Card> : null}
          {lead.session ? <Card label="Sessione"><Link className="hover:underline" href={`/sessions/${lead.session.id}`}>{lead.session.service_name} - {dateOnly.format(new Date(lead.session.scheduled_at))}</Link></Card> : null}
        </div>

        <section className="mt-8 bg-white p-5 sm:p-8">
          <h2 className="text-lg font-semibold">Note</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-[#27231f]">{lead.notes ?? <span className="text-[#675f57]">Nessuna nota.</span>}</p>
        </section>
      </section>

      {mode ? (
        <LeadActionDialog
          lead={lead}
          mode={mode}
          onClose={() => setMode(null)}
          onSaved={(updated) => { setLead(updated); setMode(null); }}
        />
      ) : null}

      {editingContactType ? (
        <Modal onClose={() => setEditingContactType(false)} title="Modifica tipo contatto">
          <form onSubmit={saveContactType}>
            <div className="flex flex-col gap-2 text-sm font-medium">
              <span className="flex items-center gap-1.5">Tipo contatto <InfoTooltip label="Informazioni sul cliente esistente" text={LEAD_CONTACT_TYPE_TOOLTIP} /></span>
              <div className="flex w-fit border border-[#cfc5b8]" role="group">
                {LEAD_CONTACT_TYPES.map((value) => <button aria-pressed={contactType === value} className={`h-10 px-4 text-sm ${contactType === value ? "bg-[#9b5d43] font-semibold text-white" : "bg-white text-[#675f57] hover:bg-[#eee8df]"}`} key={value} onClick={() => setContactType(value)} type="button">{LEAD_CONTACT_TYPE_LABELS[value]}</button>)}
                {lead.contact_type === null ? <span className="grid h-10 place-items-center border-l border-[#cfc5b8] px-3 text-xs text-[#675f57]">Non classificato</span> : null}
              </div>
            </div>
            {contactType === "existing_client" ? <div className="mt-4"><ClientCombobox clients={clients} onChange={setSelectedClientId} value={selectedClientId} /></div> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button className="h-11 px-4 text-sm font-semibold" onClick={() => setEditingContactType(false)} type="button">Annulla</button>
              <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={savingContactType || !contactType || (contactType === "existing_client" && !selectedClientId)} type="submit">{savingContactType ? "Salvataggio..." : "Salva"}</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {converting && open ? <LeadConversionDialog lead={lead} onClose={() => setConverting(false)} /> : null}

      {showConverted && lead.status === "booked" ? (
        <Modal onClose={() => setShowConverted(false)} title="Lead convertito in prenotazione">
          <p className="text-sm text-[#675f57]">{leadFullName(lead)} è ora Prenotato e collegato a cliente e sessione.</p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Link className="grid h-11 place-items-center px-4 text-sm font-semibold" href="/leads">Torna ai Lead</Link>
            {lead.client ? <Link className="grid h-11 place-items-center border border-[#9b5d43] px-4 text-sm font-semibold text-[#9b5d43] hover:bg-[#f1e3db]" href={`/clients/${lead.client.id}`}>Apri Cliente</Link> : null}
            {lead.session ? <Link className="grid h-11 place-items-center bg-[#9b5d43] px-5 text-sm font-semibold text-white" href={`/sessions/${lead.session.id}`}>Apri Sessione</Link> : null}
          </div>
        </Modal>
      ) : null}
    </main>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="border border-[#d8d0c5] bg-white px-4 py-3"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">{label}</p><p className="mt-1 text-sm font-medium">{children}</p></div>;
}
