"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { Modal } from "@/components/shared/modal";

type BallOwner = "you" | "client" | "none";
type Item = { id: string; name: string; is_active: boolean; is_system?: boolean; is_addon?: boolean; sort_order: number; saturday_surcharge_cents?: number; ball_owner?: BallOwner };
type Config = { services: Item[]; methods: Item[]; stages: Item[]; voucherValidityMonths: number; annualBudgetCents: number; mailerliteTransactionalGroupId: string; mailerliteMarketingGroupId: string; mailerliteLastSyncAt: string | null };

const entityLabels = { services: "Tipi di servizio", methods: "Metodi di pagamento", stages: "Avanzamenti sessione" } as const;
type EntityKey = keyof typeof entityLabels;
type ServiceEditor = { id: string; name: string; saturdaySurchargeEuros: string };
const SATURDAY_SURCHARGE_TOOLTIP = "Importo aggiuntivo suggerito per le sessioni svolte di sabato. Non modifica il prezzo del pacchetto: viene applicato al prezzo concordato della singola Sessione.";
const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function ConfigManager() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState<Record<EntityKey, string>>({ services: "", methods: "", stages: "" });
  const [months, setMonths] = useState("12");
  const [budgetEuros, setBudgetEuros] = useState("0");
  const [serviceEditor, setServiceEditor] = useState<ServiceEditor | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dragItem, setDragItem] = useState<{ entity: EntityKey; index: number } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/config");
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    return body as Config;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const body = await load();
        if (!active) return;
        setConfig(body);
        setMonths(String(body.voucherValidityMonths));
        setBudgetEuros(String(body.annualBudgetCents / 100));
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Caricamento non riuscito.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [load, refreshKey]);

  async function run(action: () => Promise<Response>) {
    setBusy(true); setError(null);
    try {
      const response = await action();
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setRefreshKey((key) => key + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Operazione non riuscita."); } finally { setBusy(false); }
  }

  function createItem(entity: EntityKey, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName[entity].trim();
    if (!name) return;
    void run(() => fetch(`/api/config/${entity}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })).then(() => setNewName((current) => ({ ...current, [entity]: "" })));
  }

  function toggle(entity: EntityKey, item: Item) {
    void run(() => fetch(`/api/config/${entity}/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !item.is_active }) }));
  }

  function toggleAddon(item: Item) {
    void run(() => fetch(`/api/config/services/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isAddon: !item.is_addon }) }));
  }

  function updateBallOwner(item: Item, ballOwner: BallOwner) {
    void run(() => fetch(`/api/config/stages/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ballOwner }) }));
  }

  function rename(entity: EntityKey, item: Item) {
    if (entity === "services") {
      setError(null);
      setServiceEditor({ id: item.id, name: item.name, saturdaySurchargeEuros: String((item.saturday_surcharge_cents ?? 0) / 100) });
      return;
    }
    const name = window.prompt("Nuovo nome", item.name);
    if (!name || name.trim() === item.name) return;
    void run(() => fetch(`/api/config/${entity}/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) }));
  }

  async function saveServiceEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!serviceEditor) return;
    const name = serviceEditor.name.trim();
    const saturdaySurchargeEuros = Number(serviceEditor.saturdaySurchargeEuros);
    if (!name || name.length > 120) { setError("Inserisci un nome servizio valido."); return; }
    if (!Number.isInteger(saturdaySurchargeEuros) || saturdaySurchargeEuros < 0) { setError("Il supplemento sabato deve essere un importo intero non negativo."); return; }

    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/config/services/${serviceEditor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, saturdaySurchargeEuros }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setServiceEditor(null);
      setRefreshKey((key) => key + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Aggiornamento servizio non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  async function reorder(entity: EntityKey, items: Item[]) {
    if (!config) return;
    const previous = config[entity];
    setConfig({ ...config, [entity]: items });
    setBusy(true); setError(null);
    try {
      const updates = items
        .map((item, index) => ({ item, sortOrder: index }))
        .filter(({ item, sortOrder }) => !item.is_system && item.sort_order !== sortOrder);

      for (const { item, sortOrder } of updates) {
        const response = await fetch(`/api/config/${entity}/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
      }
      setRefreshKey((key) => key + 1);
    } catch (reason) {
      setConfig({ ...config, [entity]: previous });
      setError(reason instanceof Error ? reason.message : "Riordino non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  function handleDrop(entity: EntityKey, items: Item[], targetIndex: number) {
    setDragOverIndex(null);
    if (!dragItem || dragItem.entity !== entity || dragItem.index === targetIndex) { setDragItem(null); return; }
    const reordered = [...items];
    const [moved] = reordered.splice(dragItem.index, 1);
    reordered.splice(targetIndex, 0, moved);
    setDragItem(null);
    void reorder(entity, reordered);
  }

  function saveMonths(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(() => fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voucherValidityMonths: Number(months) }) }));
  }

  function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(() => fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ annualBudgetEuros: Number(budgetEuros) }) }));
  }

  function renderEntitySection(entity: EntityKey) {
    if (!config) return null;
    const items = config[entity];
    return (
      <section className="border border-[#d8d0c5] bg-white p-5" key={entity}>
        <h2 className="text-lg font-semibold">{entityLabels[entity]}</h2>
        <div className="mt-4 divide-y divide-[#eee8df]">
          {items.map((item, index) => (
            <div
              className={`flex flex-wrap items-center gap-3 py-3 ${dragOverIndex === index && dragItem?.entity === entity ? "bg-[#f1e3db]" : ""}`}
              draggable={!item.is_system}
              key={item.id}
              onDragEnd={() => { setDragItem(null); setDragOverIndex(null); }}
              onDragOver={(event) => { if (dragItem?.entity === entity) { event.preventDefault(); setDragOverIndex(index); } }}
              onDragStart={() => setDragItem({ entity, index })}
              onDrop={(event) => { event.preventDefault(); handleDrop(entity, items, index); }}
            >
              <span aria-hidden className={`shrink-0 text-[#958b80] ${item.is_system ? "opacity-30" : "cursor-grab"}`}>&#9776;</span>
              <div className="min-w-0 flex-1 basis-40">
                <p className={`truncate text-sm font-medium ${item.is_active ? "" : "text-[#958b80] line-through"}`}>{item.name}</p>
                {item.is_system ? <p className="text-xs text-[#675f57]">Voce di sistema</p> : entity === "services" && item.is_addon ? <p className="text-xs text-[#675f57]">Servizio extra (non prenotabile da solo)</p> : null}
              </div>
              {entity === "stages" ? (
                <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-[#675f57]">
                  Palla
                  <select aria-label={`Responsabile per ${item.name}`} className="h-9 border border-[#cfc5b8] bg-white px-2 text-xs text-[#27231f]" disabled={busy} onChange={(event) => updateBallOwner(item, event.target.value as BallOwner)} value={item.ball_owner ?? "you"}>
                    <option value="you">A te</option>
                    <option value="client">Al cliente</option>
                    <option value="none">Nessuno</option>
                  </select>
                </label>
              ) : null}
              {entity === "services" && (item.saturday_surcharge_cents ?? 0) > 0 ? <span className="shrink-0 border border-[#d8d0c5] bg-[#faf7f2] px-2 py-1 text-xs font-medium text-[#675f57]">Sabato +{euro.format((item.saturday_surcharge_cents ?? 0) / 100)}</span> : null}
              <div className="flex shrink-0 flex-wrap items-center gap-1">
                {item.is_system ? null : <button className="border border-[#cfc5b8] px-2 py-1 text-xs font-semibold hover:bg-[#eee8df]" disabled={busy} onClick={() => rename(entity, item)} type="button">{entity === "services" ? "Modifica" : "Rinomina"}</button>}
                {entity === "services" ? <button className="border border-[#cfc5b8] px-2 py-1 text-xs font-semibold hover:bg-[#eee8df]" disabled={busy} onClick={() => toggleAddon(item)} type="button">{item.is_addon ? "Rendi sessione" : "Rendi extra"}</button> : null}
                {item.is_system ? null : <button className="border border-[#cfc5b8] px-2 py-1 text-xs font-semibold hover:bg-[#eee8df]" disabled={busy} onClick={() => toggle(entity, item)} type="button">{item.is_active ? "Disattiva" : "Attiva"}</button>}
              </div>
            </div>
          ))}
        </div>
        <form className="mt-4 flex gap-2" onSubmit={(event) => createItem(entity, event)}>
          <input className="h-10 flex-1 border border-[#cfc5b8] bg-white px-3 text-sm" onChange={(e) => setNewName((current) => ({ ...current, [entity]: e.target.value }))} placeholder="Nuova voce" value={newName[entity]} />
          <button className="h-10 bg-[#9b5d43] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || !newName[entity].trim()} type="submit">Aggiungi</button>
        </form>
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-5xl">
        <header className="border-b border-[#d8d0c5] pb-7">
          <h1 className="text-3xl font-semibold sm:text-4xl">Configurazione</h1>
          <p className="mt-2 text-sm text-[#675f57]">Servizi, metodi di pagamento, avanzamenti e validita dei buoni.</p>
        </header>

        {error ? <p className="mt-5 text-sm text-[#a53e31]">{error}</p> : null}
        {loading || !config ? <p className="mt-8 text-sm text-[#675f57]">Caricamento configurazione...</p> : (
          <div className="mt-7 grid gap-6 lg:grid-cols-2 lg:items-start">
            {renderEntitySection("services")}

            <div className="flex flex-col gap-6">
              {renderEntitySection("methods")}
              {renderEntitySection("stages")}

              <section className="border border-[#d8d0c5] bg-white p-5">
                <h2 className="text-lg font-semibold">Validita dei buoni</h2>
                <p className="mt-2 text-sm text-[#675f57]">Vale per i buoni emessi da ora in poi; i buoni gia venduti mantengono la loro scadenza.</p>
                <form className="mt-4 flex items-end gap-3" onSubmit={saveMonths}>
                  <label className="flex flex-col gap-2 text-sm font-medium">Mesi di validita
                    <input className="h-10 w-32 border border-[#cfc5b8] bg-white px-3 text-sm" max="120" min="1" onChange={(e) => setMonths(e.target.value)} type="number" value={months} />
                  </label>
                  <button className="h-10 bg-[#9b5d43] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">Salva</button>
                </form>
              </section>

              <section className="border border-[#d8d0c5] bg-white p-5">
                <h2 className="text-lg font-semibold">Budget anno corrente</h2>
                <p className="mt-2 text-sm text-[#675f57]">Stima di incasso annuale, usata per il progress gauge nella home.</p>
                <p className="mt-1 text-xs text-[#8a8178]">Usato come fallback quando non esiste un Piano Economico per l&apos;anno corrente.</p>
                <form className="mt-4 flex items-end gap-3" onSubmit={saveBudget}>
                  <label className="flex flex-col gap-2 text-sm font-medium">Budget (EUR)
                    <input className="h-10 w-32 border border-[#cfc5b8] bg-white px-3 text-sm" min="0" onChange={(e) => setBudgetEuros(e.target.value)} type="number" value={budgetEuros} />
                  </label>
                  <button className="h-10 bg-[#9b5d43] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">Salva</button>
                </form>
              </section>
            </div>
          </div>
        )}
      </section>

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

