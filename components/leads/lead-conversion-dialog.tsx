"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Modal } from "@/components/shared/modal";
import type { LeadDetail } from "@/lib/leads";

type MatchedClient = { id: string; first_name: string; last_name: string; email: string; is_archived: boolean; session_count: number };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s./-]{6,}$/;

// Precompilazione modificabile; per i lead senza cognome il nome viene diviso al primo spazio.
function initialForm(lead: LeadDetail) {
  const [splitFirst = "", ...rest] = lead.name.trim().split(/\s+/);
  const contact = lead.contact.trim();
  return {
    firstName: lead.last_name ? lead.name.trim() : splitFirst,
    lastName: lead.last_name ?? rest.join(" "),
    email: EMAIL_PATTERN.test(contact) ? contact.toLowerCase() : "",
    phone: PHONE_PATTERN.test(contact) ? contact : "",
  };
}

export function LeadConversionDialog({ lead, onClose }: { lead: LeadDetail; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState(() => initialForm(lead));
  const [match, setMatch] = useState<{ email: string; client: MatchedClient | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedEmail = form.email.trim().toLowerCase();
  const matchIsCurrent = match?.email === normalizedEmail;

  function continueToSession(clientId: string) {
    const params = new URLSearchParams({ newSession: clientId, lead: lead.id, service: lead.service_type_id });
    router.push(`/sessions?${params.toString()}`);
  }

  async function searchClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/leads/client-match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: normalizedEmail }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMatch({ email: normalizedEmail, client: body.client as MatchedClient | null });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ricerca non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function createClient() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: form.firstName, lastName: form.lastName, email: normalizedEmail, phone: form.phone.trim() || null }),
      });
      const body = await response.json();
      if (response.status === 409) throw new Error("Esiste gia un cliente con questa email: collega il cliente esistente.");
      if (!response.ok) throw new Error(body.error);
      continueToSession(body.client.id as string);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Creazione cliente non riuscita.");
      setBusy(false);
    }
  }

  const inputClass = "h-11 border border-[#cfc5b8] bg-white px-3";
  const matched = matchIsCurrent ? match.client : null;

  return (
    <Modal onClose={onClose} title="Converti in prenotazione">
      <form onSubmit={searchClient}>
        <p className="text-sm text-[#675f57]">1. Dati cliente &middot; 2. Nuova sessione. Il lead diventa Prenotato solo quando la sessione viene salvata.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium">Nome
            <input className={inputClass} maxLength={120} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required value={form.firstName} />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">Cognome
            <input className={inputClass} maxLength={120} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required value={form.lastName} />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">Email
            <input className={inputClass} maxLength={120} onChange={(e) => setForm({ ...form, email: e.target.value })} required type="email" value={form.email} />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">Telefono (facoltativo)
            <input className={inputClass} maxLength={40} onChange={(e) => setForm({ ...form, phone: e.target.value })} value={form.phone} />
          </label>
        </div>

        {!matchIsCurrent ? (
          <div className="mt-6 flex justify-end gap-3">
            <button className="h-11 px-4 text-sm font-semibold" onClick={onClose} type="button">Annulla</button>
            <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || !EMAIL_PATTERN.test(normalizedEmail)} type="submit">{busy ? "Ricerca..." : "Cerca cliente"}</button>
          </div>
        ) : matched ? (
          <div className="mt-6 border border-[#d8d0c5] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">Cliente esistente con questa email</p>
            <p className="mt-2 text-sm font-semibold">{matched.first_name} {matched.last_name}</p>
            <p className="text-sm text-[#675f57]">{matched.email} &middot; {matched.session_count === 1 ? "1 sessione" : `${matched.session_count} sessioni`}</p>
            {matched.is_archived ? <p className="mt-2 text-sm text-[#a53e31]">Il cliente e archiviato: ripristinalo dalla sua scheda prima di collegarlo.</p> : null}
            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <button className="h-11 border border-[#9b5d43] px-4 text-sm font-semibold text-[#9b5d43] hover:bg-[#f1e3db] disabled:opacity-60" disabled={busy} onClick={() => void createClient()} type="button">Crea nuovo cliente</button>
              <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || matched.is_archived} onClick={() => continueToSession(matched.id)} type="button">Collega cliente esistente</button>
            </div>
          </div>
        ) : (
          <div className="mt-6 border border-[#d8d0c5] bg-white p-4">
            <p className="text-sm text-[#675f57]">Nessun cliente con questa email.</p>
            <div className="mt-4 flex justify-end gap-3">
              <button className="h-11 px-4 text-sm font-semibold" onClick={onClose} type="button">Annulla</button>
              <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || !form.firstName.trim() || !form.lastName.trim()} onClick={() => void createClient()} type="button">{busy ? "Salvataggio..." : "Crea nuovo cliente"}</button>
            </div>
          </div>
        )}
        {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
      </form>
    </Modal>
  );
}
