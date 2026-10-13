"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/shared/modal";
import { toLocalDateKey } from "@/lib/datetime";
import { LEAD_LOST_REASONS, LEAD_LOST_REASON_LABELS, LEAD_STATUS_LABELS, type LeadDetail, type LeadStatus, followUpState } from "@/lib/leads";

export type LeadActionMode = "follow_up" | "lost";

const statusColors: Record<LeadStatus, { text: string; bg: string; border: string }> = {
  to_handle: { text: "#8a4f37", bg: "#f1e3db", border: "#d8b7a5" },
  info_sent: { text: "#35608a", bg: "#e0e8f1", border: "#a9c1de" },
  follow_up: { text: "#8a6a1f", bg: "#f6ecd2", border: "#dcc68c" },
  booked: { text: "#367e4a", bg: "#e2efe5", border: "#a9d3b5" },
  lost: { text: "#6b6b6b", bg: "#ececec", border: "#cfcfcf" },
};

export const leadStatusColor = (status: LeadStatus) => statusColors[status].text;

const dateOnly = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" });

export function formatDateKey(dateKey: string) {
  return dateOnly.format(new Date(`${dateKey}T12:00:00`));
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const color = statusColors[status];
  return <span className="whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ color: color.text, backgroundColor: color.bg, borderColor: color.border }}>{LEAD_STATUS_LABELS[status]}</span>;
}

export function FollowUpLabel({ dateKey }: { dateKey: string | null }) {
  const state = followUpState(dateKey, toLocalDateKey(new Date()));
  if (!state || !dateKey) return null;
  if (state === "overdue") return <span className="font-semibold text-[#a53e31]" title={formatDateKey(dateKey)}>Scaduto</span>;
  if (state === "today") return <span className="font-semibold text-[#9b5d43]">Oggi</span>;
  return <span>{formatDateKey(dateKey)}</span>;
}

export async function patchLead(id: string, payload: Record<string, unknown>): Promise<LeadDetail> {
  const response = await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Aggiornamento non riuscito.");
  return body.lead as LeadDetail;
}

export function LeadActionDialog({ lead, mode, onClose, onSaved }: { lead: { id: string; name: string; follow_up_at?: string | null }; mode: LeadActionMode; onClose: () => void; onSaved: (lead: LeadDetail) => void }) {
  const [followUpAt, setFollowUpAt] = useState(lead.follow_up_at ?? "");
  const [lostReason, setLostReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = mode === "follow_up" ? { action: "follow_up", followUpAt } : { action: "lost", lostReason, note };
      onSaved(await patchLead(lead.id, payload));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Aggiornamento non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title={mode === "follow_up" ? "Da ricontattare" : "Lead perso"}>
      <form onSubmit={submit}>
        {mode === "follow_up" ? (
          <label className="flex flex-col gap-2 text-sm font-medium">Data di ricontatto
            <input className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(event) => setFollowUpAt(event.target.value)} required type="date" value={followUpAt} />
          </label>
        ) : (
          <div className="grid gap-4">
            <label className="flex flex-col gap-2 text-sm font-medium">Motivo
              <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(event) => setLostReason(event.target.value)} required value={lostReason}>
                <option value="">Seleziona</option>
                {LEAD_LOST_REASONS.map((reason) => <option key={reason} value={reason}>{LEAD_LOST_REASON_LABELS[reason]}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">Nota (facoltativa)
              <textarea className="min-h-20 border border-[#cfc5b8] bg-white p-3" maxLength={1000} onChange={(event) => setNote(event.target.value)} value={note} />
            </label>
          </div>
        )}
        {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button className="h-11 px-4 text-sm font-semibold" onClick={onClose} type="button">Annulla</button>
          <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? "Salvataggio..." : "Salva"}</button>
        </div>
      </form>
    </Modal>
  );
}
