"use client";

import { FormEvent, useEffect, useState } from "react";
import { EmailTemplateEditor } from "@/components/packages/email-template-editor";
import { Modal } from "@/components/shared/modal";
import type { SessionPackage } from "@/lib/packages";

type Service = { id: string; name: string };
type PackageForm = { id: string | null; serviceTypeId: string; name: string; includedPhotos: string; description: string; isActive: boolean };

const emptyForm: PackageForm = { id: null, serviceTypeId: "", name: "", includedPhotos: "", description: "", isActive: true };

export function PackageManager() {
  const [packages, setPackages] = useState<SessionPackage[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<PackageForm | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/packages");
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (!active) return;
        setPackages(body.packages);
        setServices(body.services);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Caricamento non riuscito.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [refreshKey]);

  function openForm(item?: SessionPackage, serviceTypeId?: string) {
    setError(null);
    setForm(item
      ? { id: item.id, serviceTypeId: item.service_type_id, name: item.name, includedPhotos: String(item.included_photos), description: item.description ?? "", isActive: item.is_active }
      : { ...emptyForm, serviceTypeId: serviceTypeId ?? services[0]?.id ?? "" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(form.id ? `/api/packages/${form.id}` : "/api/packages", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceTypeId: form.serviceTypeId, name: form.name, includedPhotos: form.includedPhotos, description: form.description, isActive: form.isActive }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setForm(null); setRefreshKey((key) => key + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Salvataggio non riuscito."); } finally { setBusy(false); }
  }

  async function remove(item: SessionPackage) {
    if (!window.confirm(`Eliminare il pacchetto "${item.name}"?`)) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/packages/${item.id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setRefreshKey((key) => key + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Eliminazione non riuscita."); } finally { setBusy(false); }
  }

  const servicesWithPackages = services.map((service) => ({ service, items: packages.filter((item) => item.service_type_id === service.id) }));

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-4xl">
        <header className="flex flex-col gap-4 border-b border-[#d8d0c5] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#9b5d43]">Consegna</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Pacchetti</h1>
            <p className="mt-2 text-sm text-[#675f57]">Cosa include ogni pacchetto, per tipo di servizio. Stampe ed extra acquistati si aggiungono sulla singola sessione.</p>
          </div>
          <button className="h-11 bg-[#9b5d43] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={services.length === 0} onClick={() => openForm()} type="button">Nuovo pacchetto</button>
        </header>

        {error && !form ? <p className="mt-5 text-sm text-[#a53e31]">{error}</p> : null}
        {loading ? <p className="mt-6 text-sm text-[#675f57]">Caricamento...</p> : null}

        <div className="mt-7 space-y-6">
          {servicesWithPackages.map(({ service, items }) => (
            <section key={service.id}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{service.name}</h2>
                <button className="text-sm font-semibold text-[#9b5d43] hover:underline" onClick={() => openForm(undefined, service.id)} type="button">Aggiungi</button>
              </div>
              <div className="mt-3 overflow-hidden border border-[#d8d0c5] bg-white">
                {items.length === 0 ? <p className="p-5 text-sm text-[#675f57]">Nessun pacchetto.</p> : items.map((item) => (
                  <article className="flex items-start justify-between gap-4 border-b border-[#eee8df] px-5 py-4 last:border-b-0" key={item.id}>
                    <div className={item.is_active ? "" : "opacity-50"}>
                      <p className="text-sm font-semibold">{item.name} - {item.included_photos} foto incluse{item.is_active ? "" : " (disattivato)"}</p>
                      {item.description ? <p className="mt-1 whitespace-pre-line text-xs text-[#675f57]">{item.description}</p> : null}
                    </div>
                    <div className="flex shrink-0 gap-4">
                      <button className="text-sm font-semibold text-[#9b5d43] hover:underline" disabled={busy} onClick={() => openForm(item)} type="button">Modifica</button>
                      <button className="text-sm font-semibold text-[#a53e31] hover:underline disabled:opacity-50" disabled={busy} onClick={() => remove(item)} type="button">Elimina</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        <EmailTemplateEditor templateCode="proofs" title="Email invio provini" />
      </section>

      {form ? (
        <Modal onClose={() => setForm(null)} title={form.id ? "Modifica pacchetto" : "Nuovo pacchetto"}>
          <form onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">Tipo di servizio
                <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setForm({ ...form, serviceTypeId: e.target.value })} required value={form.serviceTypeId}>
                  <option value="">Seleziona</option>
                  {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Nome pacchetto
                <input className="h-11 border border-[#cfc5b8] bg-white px-3" maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} required value={form.name} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Foto digitali incluse
                <input className="h-11 border border-[#cfc5b8] bg-white px-3" max="1000" min="0" onChange={(e) => setForm({ ...form, includedPhotos: e.target.value })} required type="number" value={form.includedPhotos} />
              </label>
              <label className="flex items-center gap-3 self-end pb-3 text-sm font-medium">
                <input checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} type="checkbox" /> Attivo
              </label>
            </div>
            <label className="mt-4 flex flex-col gap-2 text-sm font-medium">Cosa include (facoltativo, appare nell&apos;email con {"{{contenuto_pacchetto}}"})
              <textarea className="min-h-24 border border-[#cfc5b8] bg-white p-3" maxLength={2000} onChange={(e) => setForm({ ...form, description: e.target.value })} value={form.description} />
            </label>
            {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button className="h-11 px-4 text-sm font-semibold" onClick={() => setForm(null)} type="button">Annulla</button>
              <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? "Salvataggio..." : "Salva pacchetto"}</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </main>
  );
}
