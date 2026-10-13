"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/shared/modal";

export type PackageChoice = { id: string; name: string; price_cents: number | null; duration_minutes: number | null; included_photos: number };

type Current = { packageId: string | null; packageName: string | null; agreedPriceCents: number; durationMinutes: number; includedPhotos: number | null };

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function SessionPackageDialog({ sessionId, current, packages, onClose, onSaved }: { sessionId: string; current: Current; packages: PackageChoice[]; onClose: () => void; onSaved: (session: unknown) => void }) {
  const [packageId, setPackageId] = useState(current.packageId ?? packages[0]?.id ?? "");
  const proposalFor = (id: string) => {
    const selected = packages.find((item) => item.id === id);
    return {
      priceEuros: String((selected?.price_cents ?? current.agreedPriceCents) / 100),
      durationMinutes: String(selected?.duration_minutes ?? current.durationMinutes),
      includedPhotos: String(selected?.included_photos ?? current.includedPhotos ?? 0),
    };
  };
  const [values, setValues] = useState(() => proposalFor(current.packageId ?? packages[0]?.id ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const removing = packageId === "";
  const selected = packages.find((item) => item.id === packageId) ?? null;

  function choose(id: string) {
    setPackageId(id);
    if (id) setValues(proposalFor(id));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updatePackage", packageId: removing ? null : packageId, ...(removing ? {} : values) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      onSaved(body.session);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Aggiornamento non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "h-11 border border-[#cfc5b8] bg-white px-3";

  return (
    <Modal onClose={onClose} title={current.packageId ? "Cambia pacchetto" : "Assegna pacchetto"}>
      <form onSubmit={submit}>
        <label className="flex flex-col gap-2 text-sm font-medium">Pacchetto
          <select className={inputClass} onChange={(e) => choose(e.target.value)} value={packageId}>
            {current.packageId ? <option value="">Nessun pacchetto (rimuovi)</option> : null}
            {packages.map((item) => <option key={item.id} value={item.id}>{item.name}{item.price_cents === null ? "" : ` — ${euro.format(item.price_cents / 100)}`}</option>)}
          </select>
        </label>
        {packages.length === 0 ? <p className="mt-2 text-xs text-[#675f57]">Nessun pacchetto attivo per questo servizio.</p> : null}

        {removing ? (
          <p className="mt-5 border border-[#d8b7a5] bg-[#f1e3db] px-4 py-3 text-sm text-[#8a4f37]">Il pacchetto &quot;{current.packageName}&quot; e le sue inclusioni verranno rimossi dalla sessione. Prezzo concordato, durata e foto incluse restano invariati.</p>
        ) : selected ? (
          <>
            <p className="mt-5 border border-[#d8b7a5] bg-[#f1e3db] px-4 py-3 text-sm text-[#8a4f37]">Applicare il pacchetto &quot;{selected.name}&quot;? Verranno aggiornati i dati del pacchetto e le inclusioni della sessione. Controlla i valori proposti prima di confermare.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm font-medium">Prezzo concordato (EUR)
                <input className={inputClass} min="0" onChange={(e) => setValues({ ...values, priceEuros: e.target.value })} required type="number" value={values.priceEuros} />
                <span className="text-xs font-normal text-[#675f57]">Attuale: {euro.format(current.agreedPriceCents / 100)}</span>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Durata (minuti)
                <input className={inputClass} min="1" onChange={(e) => setValues({ ...values, durationMinutes: e.target.value })} required type="number" value={values.durationMinutes} />
                <span className="text-xs font-normal text-[#675f57]">Attuale: {current.durationMinutes} min</span>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Foto incluse
                <input className={inputClass} max="1000" min="0" onChange={(e) => setValues({ ...values, includedPhotos: e.target.value })} required type="number" value={values.includedPhotos} />
                <span className="text-xs font-normal text-[#675f57]">Attuale: {current.includedPhotos ?? "-"}</span>
              </label>
            </div>
          </>
        ) : null}

        {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button className="h-11 px-4 text-sm font-semibold" onClick={onClose} type="button">Annulla</button>
          <button className={`h-11 px-5 text-sm font-semibold text-white disabled:opacity-60 ${removing ? "bg-[#a53e31]" : "bg-[#9b5d43]"}`} disabled={busy || (!removing && !selected)} type="submit">{busy ? "Salvataggio..." : removing ? "Rimuovi pacchetto" : "Applica pacchetto"}</button>
        </div>
      </form>
    </Modal>
  );
}
