"use client";

import { useEffect, useState } from "react";

type AuditEntry = {
  id: string;
  action: "insert" | "update" | "delete";
  changed_fields: Record<string, { from: unknown; to: unknown }> | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

const dateTime = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" });
const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

const fieldLabels: Record<string, string> = {
  first_name: "Nome",
  last_name: "Cognome",
  email: "Email",
  phone: "Telefono",
  birth_date: "Data di nascita",
  is_archived: "Archiviato",
  privacy_consent_granted: "Consenso privacy",
  image_consent_granted: "Consenso immagini",
  scheduled_at: "Data/ora",
  duration_minutes: "Durata (min)",
  location: "Luogo",
  service_name: "Servizio",
  service_detail: "Dettaglio servizio",
  agreed_price_cents: "Prezzo concordato",
  current_stage_id: "Avanzamento",
  notes: "Note",
  amount_cents: "Importo",
  paid_at: "Data pagamento",
  category: "Causale",
  payment_method_id: "Metodo di pagamento",
  applied_voucher_id: "Buono applicato",
  reference: "Riferimento",
  status: "Stato",
  voucher_type: "Tipo buono",
  value_cents: "Valore",
  purchase_price_cents: "Prezzo di acquisto",
  purchased_at: "Data acquisto",
  expires_at: "Scadenza",
  code: "Codice",
  recipient_client_id: "Beneficiario",
};

function formatValue(key: string, value: unknown) {
  if (value === null || value === undefined) return "—";
  if (key.endsWith("_cents") && typeof value === "number") return euro.format(value / 100);
  if ((key.endsWith("_at") || key.endsWith("_date")) && typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? String(value) : dateTime.format(date);
  }
  if (typeof value === "boolean") return value ? "Si" : "No";
  return String(value);
}

const actionLabels: Record<string, string> = { insert: "Creazione", update: "Modifica", delete: "Eliminazione" };

export function AuditLogPanel({ table, recordId }: { table: string; recordId: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    fetch(`/api/audit-log?table=${table}&id=${recordId}`)
      .then((response) => response.json())
      .then((body) => { if (active) setEntries(body.entries ?? []); })
      .catch(() => { if (active) setEntries([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, table, recordId]);

  return (
    <div className="mt-6 border border-[#d8d0c5] bg-white">
      <button
        className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-semibold"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        Storico modifiche
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="border-t border-[#eee8df] px-5 py-4 text-sm">
          {loading ? <p className="text-[#675f57]">Caricamento...</p> : entries.length === 0 ? (
            <p className="text-[#675f57]">Nessuna modifica registrata.</p>
          ) : (
            <ul className="space-y-4">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#9b5d43]">
                    {actionLabels[entry.action] ?? entry.action} - {dateTime.format(new Date(entry.created_at))}
                  </p>
                  {entry.action === "update" && entry.changed_fields ? (
                    <ul className="mt-1 space-y-0.5 text-[#514a43]">
                      {Object.entries(entry.changed_fields).map(([key, change]) => (
                        <li key={key}>
                          <span className="font-medium">{fieldLabels[key] ?? key}:</span>{" "}
                          {formatValue(key, change.from)} → {formatValue(key, change.to)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
