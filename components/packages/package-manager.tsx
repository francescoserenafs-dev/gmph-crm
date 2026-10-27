"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { EmailTemplateEditor } from "@/components/packages/email-template-editor";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { Modal } from "@/components/shared/modal";
import { EXTRA_CATEGORY_LABELS, type ExtraProduct } from "@/lib/extra-products";
import type { SessionPackage } from "@/lib/packages";

type Service = { id: string; name: string; is_active: boolean; is_addon: boolean; sort_order: number; saturday_surcharge_cents: number };
type ServiceEditor = { id: string; name: string; saturdaySurchargeEuros: string };
type InclusionRow = { extraProductId: string; quantity: string };
type PackageForm = { id: string | null; serviceTypeId: string; name: string; priceEuros: string; durationMinutes: string; includedPhotos: string; description: string; isActive: boolean; inclusions: InclusionRow[] };

const emptyForm: PackageForm = { id: null, serviceTypeId: "", name: "", priceEuros: "", durationMinutes: "", includedPhotos: "", description: "", isActive: true, inclusions: [] };
const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const SATURDAY_SURCHARGE_TOOLTIP = "Importo aggiuntivo suggerito per le sessioni svolte di sabato. Non modifica il prezzo del pacchetto: viene applicato al prezzo concordato della singola Sessione.";
const smallButton = "border border-[#cfc5b8] px-2 py-1 text-xs font-semibold hover:bg-[#eee8df] disabled:opacity-40";

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error);
}

function jsonRequest(method: "POST" | "PATCH", payload: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
}

export function PackageManager() {
  const [packages, setPackages] = useState<SessionPackage[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<ExtraProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<PackageForm | null>(null);
  const [serviceEditor, setServiceEditor] = useState<ServiceEditor | null>(null);
  const [newServiceName, setNewServiceName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [response, configResponse, productsResponse] = await Promise.all([fetch("/api/packages"), fetch("/api/config"), fetch("/api/extra-products")]);
        const body = await response.json();
        const configBody = await configResponse.json();
        const productsBody = await productsResponse.json();
        if (!response.ok) throw new Error(body.error);
        if (!configResponse.ok) throw new Error(configBody.error);
        if (!active) return;
        setPackages(body.packages);
        setServices(configBody.services);
        if (productsResponse.ok) setProducts(productsBody.products);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Caricamento non riuscito.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [refreshKey]);

  const bookableServices = services.filter((service) => service.is_active && !service.is_addon);

  function openForm(item?: SessionPackage, serviceTypeId?: string) {
    setError(null);
    setForm(item
      ? { id: item.id, serviceTypeId: item.service_type_id, name: item.name, priceEuros: item.price_cents === null ? "" : String(item.price_cents / 100), durationMinutes: item.duration_minutes === null ? "" : String(item.duration_minutes), includedPhotos: String(item.included_photos), description: item.description ?? "", isActive: item.is_active, inclusions: item.inclusions.map((inclusion) => ({ extraProductId: inclusion.extra_product_id, quantity: String(inclusion.quantity) })) }
      : { ...emptyForm, serviceTypeId: serviceTypeId ?? bookableServices[0]?.id ?? "" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(form.id ? `/api/packages/${form.id}` : "/api/packages", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceTypeId: form.serviceTypeId, name: form.name, priceEuros: form.priceEuros, durationMinutes: form.durationMinutes, includedPhotos: form.includedPhotos, description: form.description, isActive: form.isActive, inclusions: form.inclusions }),
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

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true); setError(null);
    try {
      await action();
      setRefreshKey((key) => key + 1);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : fallback);
      return false;
    } finally { setBusy(false); }
  }

  function updateService(service: Service, payload: Record<string, unknown>) {
    void run(() => request(`/api/config/services/${service.id}`, jsonRequest("PATCH", payload)), "Aggiornamento servizio non riuscito.");
  }

  function moveService(index: number, offset: -1 | 1) {
    const reordered = [...services];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(index + offset, 0, moved);
    void run(async () => {
      for (const [sortOrder, item] of reordered.entries()) {
        if (item.sort_order !== sortOrder) await request(`/api/config/services/${item.id}`, jsonRequest("PATCH", { sortOrder }));
      }
    }, "Riordino non riuscito.");
  }

  async function createService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newServiceName.trim();
    if (!name) return;
    if (await run(() => request("/api/config/services", jsonRequest("POST", { name })), "Creazione servizio non riuscita.")) setNewServiceName("");
  }

  async function saveServiceEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!serviceEditor) return;
    const name = serviceEditor.name.trim();
    const saturdaySurchargeEuros = Number(serviceEditor.saturdaySurchargeEuros);
    if (!name || name.length > 120) { setError("Inserisci un nome servizio valido."); return; }
    if (!Number.isInteger(saturdaySurchargeEuros) || saturdaySurchargeEuros < 0) { setError("Il supplemento sabato deve essere un importo intero non negativo."); return; }
    if (await run(() => request(`/api/config/services/${serviceEditor.id}`, jsonRequest("PATCH", { name, saturdaySurchargeEuros })), "Aggiornamento servizio non riuscito.")) setServiceEditor(null);
  }

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-4xl">
        <header className="flex flex-col gap-4 border-b border-[#d8d0c5] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold sm:text-4xl">Catalogo</h1>
            <p className="mt-2 text-sm text-[#675f57]">Servizi, supplementi e pacchetti offerti. Stampe ed extra acquistati si aggiungono sulla singola sessione.</p>
          </div>
          <button className="h-11 bg-[#9b5d43] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={bookableServices.length === 0} onClick={() => openForm()} type="button">Nuovo pacchetto</button>
        </header>

        {error && !form && !serviceEditor ? <p className="mt-5 text-sm text-[#a53e31]">{error}</p> : null}
        {loading ? <p className="mt-6 text-sm text-[#675f57]">Caricamento...</p> : null}

        <div className="mt-7 space-y-6">
          {services.map((service, index) => {
            const items = packages.filter((item) => item.service_type_id === service.id);
            const bookable = service.is_active && !service.is_addon;
            return (
            <section className="border border-[#d8d0c5] bg-white" key={service.id}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eee8df] bg-[#faf7f2] px-5 py-4">
                <div className="min-w-0">
                  <h2 className={`text-lg font-semibold ${service.is_active ? "" : "text-[#958b80] line-through"}`}>{service.name}</h2>
                  <p className="mt-1 text-xs text-[#675f57]">
                    {[
                      service.saturday_surcharge_cents > 0 ? `Supplemento sabato +${euro.format(service.saturday_surcharge_cents / 100)}` : null,
                      service.is_addon ? "Servizio extra (non prenotabile da solo)" : null,
                      service.is_active ? null : "Disattivato",
                    ].filter(Boolean).join(" · ") || "Nessun supplemento"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <button aria-label={`Sposta ${service.name} in alto`} className={smallButton} disabled={busy || index === 0} onClick={() => moveService(index, -1)} type="button"><ArrowUp className="size-3.5" /></button>
                  <button aria-label={`Sposta ${service.name} in basso`} className={smallButton} disabled={busy || index === services.length - 1} onClick={() => moveService(index, 1)} type="button"><ArrowDown className="size-3.5" /></button>
                  <button className={smallButton} disabled={busy} onClick={() => { setError(null); setServiceEditor({ id: service.id, name: service.name, saturdaySurchargeEuros: String(service.saturday_surcharge_cents / 100) }); }} type="button">Modifica</button>
                  <button className={smallButton} disabled={busy} onClick={() => updateService(service, { isAddon: !service.is_addon })} type="button">{service.is_addon ? "Rendi sessione" : "Rendi extra"}</button>
                  <button className={smallButton} disabled={busy} onClick={() => updateService(service, { isActive: !service.is_active })} type="button">{service.is_active ? "Disattiva" : "Attiva"}</button>
                </div>
              </div>
              <div>
                {items.length === 0 ? <p className="px-5 py-4 text-sm text-[#675f57]">Nessun pacchetto.</p> : items.map((item) => (
                  <article className="flex items-start justify-between gap-4 border-b border-[#eee8df] px-5 py-4 last:border-b-0" key={item.id}>
                    <div className={item.is_active ? "" : "opacity-50"}>
                      <p className="text-sm font-semibold">{item.name}{item.price_cents === null ? "" : ` — ${euro.format(item.price_cents / 100)}`}{item.is_active ? "" : " (disattivato)"}</p>
                      <p className="mt-1 text-xs text-[#675f57]">{item.duration_minutes === null ? "Durata non indicata" : `${item.duration_minutes} min`} · {item.included_photos} foto incluse</p>
                      {item.inclusions.length > 0 ? <p className="mt-1 text-xs text-[#675f57]">Include: {item.inclusions.map((inclusion) => `${inclusion.quantity} × ${inclusion.product?.name ?? "prodotto"}`).join(", ")}</p> : null}
                      {item.description ? <p className="mt-1 whitespace-pre-line text-xs text-[#675f57]">{item.description}</p> : null}
                    </div>
                    <div className="flex shrink-0 gap-4">
                      <button className="text-sm font-semibold text-[#9b5d43] hover:underline" disabled={busy} onClick={() => openForm(item)} type="button">Modifica</button>
                      <button className="text-sm font-semibold text-[#a53e31] hover:underline disabled:opacity-50" disabled={busy} onClick={() => remove(item)} type="button">Elimina</button>
                    </div>
                  </article>
                ))}
              </div>
              {bookable ? (
                <div className="border-t border-[#eee8df] px-5 py-3">
                  <button className="text-sm font-semibold text-[#9b5d43] hover:underline" disabled={busy} onClick={() => openForm(undefined, service.id)} type="button">Aggiungi pacchetto</button>
                </div>
              ) : null}
            </section>
            );
          })}

          {loading ? null : (
            <form className="flex gap-2 border border-[#d8d0c5] bg-white p-5" onSubmit={createService}>
              <input aria-label="Nome nuovo servizio" className="h-10 flex-1 border border-[#cfc5b8] bg-white px-3 text-sm" maxLength={120} onChange={(event) => setNewServiceName(event.target.value)} placeholder="Nuovo servizio" value={newServiceName} />
              <button className="h-10 bg-[#9b5d43] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || !newServiceName.trim()} type="submit">Aggiungi servizio</button>
            </form>
          )}
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
                  {services.filter((service) => (service.is_active && !service.is_addon) || service.id === form.serviceTypeId).map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Nome pacchetto
                <input className="h-11 border border-[#cfc5b8] bg-white px-3" maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} required value={form.name} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Prezzo di listino (EUR)
                <input className="h-11 border border-[#cfc5b8] bg-white px-3" min="0" onChange={(e) => setForm({ ...form, priceEuros: e.target.value })} required step="1" type="number" value={form.priceEuros} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Durata (minuti)
                <input className="h-11 border border-[#cfc5b8] bg-white px-3" min="1" onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} required type="number" value={form.durationMinutes} />
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
            <div className="mt-5">
              <p className="text-sm font-medium">Prodotti inclusi nel prezzo</p>
              <p className="mt-1 text-xs text-[#675f57]">Dal catalogo extra. Non generano extra sulla sessione: sono già compresi nel pacchetto.</p>
              {form.inclusions.map((inclusion, index) => (
                <div className="mt-2 grid grid-cols-[1fr_90px_32px] items-center gap-2" key={index}>
                  <select aria-label="Prodotto incluso" className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setForm({ ...form, inclusions: form.inclusions.map((row, position) => position === index ? { ...row, extraProductId: e.target.value } : row) })} required value={inclusion.extraProductId}>
                    <option value="">Seleziona prodotto</option>
                    {products.filter((product) => product.is_active || product.id === inclusion.extraProductId).map((product) => <option key={product.id} value={product.id}>{product.name} · {EXTRA_CATEGORY_LABELS[product.category]}{product.is_active ? "" : " (disattivato)"}</option>)}
                  </select>
                  <input aria-label="Quantità" className="h-11 border border-[#cfc5b8] bg-white px-3" max="999" min="1" onChange={(e) => setForm({ ...form, inclusions: form.inclusions.map((row, position) => position === index ? { ...row, quantity: e.target.value } : row) })} required type="number" value={inclusion.quantity} />
                  <button aria-label="Rimuovi inclusione" className="size-8 border border-[#cfc5b8] text-sm" onClick={() => setForm({ ...form, inclusions: form.inclusions.filter((_, position) => position !== index) })} type="button">x</button>
                </div>
              ))}
              <button className="mt-3 text-sm font-semibold text-[#9b5d43] hover:underline disabled:opacity-50" disabled={products.length === 0} onClick={() => setForm({ ...form, inclusions: [...form.inclusions, { extraProductId: "", quantity: "1" }] })} type="button">Aggiungi prodotto incluso</button>
            </div>
            {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button className="h-11 px-4 text-sm font-semibold" onClick={() => setForm(null)} type="button">Annulla</button>
              <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? "Salvataggio..." : "Salva pacchetto"}</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {serviceEditor ? (
        <Modal onClose={() => setServiceEditor(null)} title="Modifica servizio">
          <form onSubmit={saveServiceEditor}>
            <label className="flex flex-col gap-2 text-sm font-medium">Nome servizio
              <input autoFocus className="h-11 border border-[#cfc5b8] bg-white px-3" maxLength={120} onChange={(event) => setServiceEditor({ ...serviceEditor, name: event.target.value })} required value={serviceEditor.name} />
            </label>
            <label className="mt-4 flex flex-col gap-2 text-sm font-medium">
              <span className="flex items-center gap-1">Supplemento sabato (EUR)<InfoTooltip label="Informazioni sul supplemento sabato" text={SATURDAY_SURCHARGE_TOOLTIP} /></span>
              <input className="h-11 w-36 border border-[#cfc5b8] bg-white px-3" min="0" onChange={(event) => setServiceEditor({ ...serviceEditor, saturdaySurchargeEuros: event.target.value })} required step="1" type="number" value={serviceEditor.saturdaySurchargeEuros} />
            </label>
            {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button className="h-11 px-4 text-sm font-semibold" disabled={busy} onClick={() => setServiceEditor(null)} type="button">Annulla</button>
              <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? "Salvataggio..." : "Salva"}</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </main>
  );
}
