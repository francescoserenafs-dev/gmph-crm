"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Item = { id: string; name: string; is_active: boolean; is_system?: boolean; sort_order: number };
type Config = { services: Item[]; methods: Item[]; stages: Item[]; voucherValidityMonths: number; annualBudgetCents: number };

const entityLabels = { services: "Tipi di servizio", methods: "Metodi di pagamento", stages: "Avanzamenti sessione" } as const;
type EntityKey = keyof typeof entityLabels;

export function ConfigManager() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState<Record<EntityKey, string>>({ services: "", methods: "", stages: "" });
  const [months, setMonths] = useState("12");
  const [budgetEuros, setBudgetEuros] = useState("0");
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

  function rename(entity: EntityKey, item: Item) {
    const name = window.prompt("Nuovo nome", item.name);
    if (!name || name.trim() === item.name) return;
    void run(() => fetch(`/api/config/${entity}/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) }));
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
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${item.is_active ? "" : "text-[#958b80] line-through"}`}>{item.name}</p>
                {item.is_system ? <p className="text-xs text-[#675f57]">Voce di sistema</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {item.is_system ? null : <button className="border border-[#cfc5b8] px-2 py-1 text-xs font-semibold hover:bg-[#eee8df]" disabled={busy} onClick={() => rename(entity, item)} type="button">Rinomina</button>}
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
    </main>
  );
}

