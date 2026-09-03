"use client";

import { useEffect, useState } from "react";
import { RefreshCw, UploadCloud, UsersRound } from "lucide-react";

type Group = { id: string; name: string };
type Config = { mailerliteTransactionalGroupId: string; mailerliteMarketingGroupId: string; mailerliteLastSyncAt: string | null };
type SyncItem = { id: string; first_name: string; last_name: string; email: string; action: "create" | "update" | "retry"; group: "marketing" | "transactional" };
type SyncResult = { synced: number; total: number; errors: { id: string; name: string; error: string }[] };

const actionLabels = { create: "Nuovo contatto", update: "Aggiornamento", retry: "Nuovo tentativo" };

export function MailerLiteSync() {
  const [config, setConfig] = useState<Config | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [items, setItems] = useState<SyncItem[]>([]);
  const [mode, setMode] = useState<"all" | "changed" | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setConfig(body as Config);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Caricamento non riuscito."))
      .finally(() => setLoading(false));
  }, []);

  async function loadGroups() {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/mailerlite/groups");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setGroups(body.groups ?? []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Impossibile caricare i gruppi MailerLite."); } finally { setBusy(false); }
  }

  async function saveGroups() {
    if (!config) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mailerliteTransactionalGroupId: config.mailerliteTransactionalGroupId, mailerliteMarketingGroupId: config.mailerliteMarketingGroupId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Salvataggio gruppi non riuscito."); } finally { setBusy(false); }
  }

  async function preview(type: "all" | "changed") {
    setBusy(true); setError(null); setResult(null); setMode(type);
    try {
      const response = await fetch("/api/mailerlite/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: type === "all" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setItems(body.items ?? []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Anteprima non riuscita."); } finally { setBusy(false); }
  }

  async function startSync() {
    if (!mode) return;
    setSyncing(true); setError(null); setResult(null);
    try {
      const response = await fetch("/api/mailerlite/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ execute: true, force: mode === "all" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setResult(body as SyncResult);
      setItems([]); setMode(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Sincronizzazione non riuscita."); } finally { setSyncing(false); }
  }

  const groupName = (type: SyncItem["group"]) => {
    const id = type === "marketing" ? config?.mailerliteMarketingGroupId : config?.mailerliteTransactionalGroupId;
    return groups.find((group) => group.id === id)?.name ?? (type === "marketing" ? "Iscritti Newsletter" : "Solo Transazionali");
  };

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-6xl">
        <header className="border-b border-[#d8d0c5] pb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b5d43]">Integrazione</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">MailerLite</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#675f57]">Gestisci manualmente i contatti del CRM. Il gruppo viene scelto in base al consenso marketing.</p>
        </header>

        {error ? <p className="mt-5 border border-[#d9aaa0] bg-[#fff7f5] p-3 text-sm text-[#a53e31]">{error}</p> : null}
        {loading ? <p className="mt-8 text-sm text-[#675f57]">Caricamento...</p> : (
          <>
            <section className="mt-7 grid gap-4 md:grid-cols-3">
              <button className="flex min-h-28 flex-col items-start justify-between border border-[#d8d0c5] bg-white p-5 text-left transition-colors hover:border-[#9b5d43] disabled:opacity-60" disabled={busy || syncing} onClick={() => void loadGroups()} type="button">
                <RefreshCw className="size-5 text-[#9b5d43]" strokeWidth={1.8} />
                <span><span className="block font-semibold">Carica gruppi</span><span className="mt-1 block text-xs font-normal text-[#675f57]">Aggiorna l&apos;elenco da MailerLite</span></span>
              </button>
              <button className="flex min-h-28 flex-col items-start justify-between border border-[#d8d0c5] bg-white p-5 text-left transition-colors hover:border-[#9b5d43] disabled:opacity-60" disabled={busy || syncing || !config?.mailerliteTransactionalGroupId || !config.mailerliteMarketingGroupId} onClick={() => void preview("all")} type="button">
                <UploadCloud className="size-5 text-[#9b5d43]" strokeWidth={1.8} />
                <span><span className="block font-semibold">Sincronizza tutti i contatti</span><span className="mt-1 block text-xs font-normal text-[#675f57]">Controlla e prepara tutti i clienti</span></span>
              </button>
              <button className="flex min-h-28 flex-col items-start justify-between border border-[#d8d0c5] bg-white p-5 text-left transition-colors hover:border-[#9b5d43] disabled:opacity-60" disabled={busy || syncing || !config?.mailerliteTransactionalGroupId || !config.mailerliteMarketingGroupId} onClick={() => void preview("changed")} type="button">
                <UsersRound className="size-5 text-[#9b5d43]" strokeWidth={1.8} />
                <span><span className="block font-semibold">Sincronizza solo contatti modificati</span><span className="mt-1 block text-xs font-normal text-[#675f57]">Dall&apos;ultima sincronizzazione riuscita</span></span>
              </button>
            </section>

            <section className="mt-7 border border-[#d8d0c5] bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-lg font-semibold">Gruppi di destinazione</h2><p className="mt-1 text-xs text-[#675f57]">I gruppi selezionati vengono usati per le prossime sincronizzazioni.</p></div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium">Solo Transazionali
                  <select className="h-10 border border-[#cfc5b8] bg-white px-3 text-sm" disabled={groups.length === 0} onChange={(event) => setConfig((current) => current ? { ...current, mailerliteTransactionalGroupId: event.target.value } : current)} value={config?.mailerliteTransactionalGroupId ?? ""}><option value="">{groups.length === 0 ? "Carica i gruppi" : "Seleziona gruppo"}</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">Iscritti Newsletter
                  <select className="h-10 border border-[#cfc5b8] bg-white px-3 text-sm" disabled={groups.length === 0} onChange={(event) => setConfig((current) => current ? { ...current, mailerliteMarketingGroupId: event.target.value } : current)} value={config?.mailerliteMarketingGroupId ?? ""}><option value="">{groups.length === 0 ? "Carica i gruppi" : "Seleziona gruppo"}</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
                </label>
              </div>
              <button className="mt-4 h-10 bg-[#9b5d43] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || !config?.mailerliteTransactionalGroupId || !config?.mailerliteMarketingGroupId} onClick={() => void saveGroups()} type="button">Salva gruppi</button>
            </section>

            <section className="mt-7 border border-[#d8d0c5] bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee8df] pb-4">
                <div><h2 className="text-lg font-semibold">Contatti coinvolti</h2><p className="mt-1 text-xs text-[#675f57]">{items.length > 0 ? `${items.length} contatti pronti` : "Scegli un tipo di sincronizzazione per caricare l'elenco."}</p></div>
                <p className="text-xs text-[#675f57]">Ultima sincronizzazione: {config?.mailerliteLastSyncAt ? new Date(config.mailerliteLastSyncAt).toLocaleString("it-IT") : "mai eseguita"}</p>
              </div>
              {items.length > 0 ? <div className="mt-4 max-h-[28rem] overflow-auto divide-y divide-[#eee8df]">{items.map((item) => <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm" key={item.id}><div><p className="font-medium">{item.first_name} {item.last_name}</p><p className="text-xs text-[#675f57]">{item.email}</p></div><div className="text-right text-xs text-[#675f57]"><p>{actionLabels[item.action]}</p><p>Gruppo: {groupName(item.group)}</p></div></div>)}</div> : <div className="grid min-h-36 place-items-center text-center text-sm text-[#958b80]"><p>Nessun contatto selezionato</p></div>}
              <div className="mt-5 flex justify-end"><button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#7f4934] disabled:opacity-50" disabled={busy || syncing || items.length === 0} onClick={() => void startSync()} type="button">Avvia sincronizzazione</button></div>
            </section>

            {result ? <section className="mt-7 border border-[#b9cfb9] bg-[#f8fcf7] p-5 sm:p-6"><h2 className="text-lg font-semibold text-[#315d38]">Sincronizzazione completata</h2><p className="mt-2 text-sm">Contatti elaborati: {result.total}. OK: {result.synced}. KO: {result.errors.length}.</p>{result.errors.length > 0 ? <details className="mt-4 border border-[#d8d0c5] bg-white p-3"><summary className="cursor-pointer text-sm font-semibold">Mostra dettaglio KO</summary><div className="mt-3 max-h-64 space-y-2 overflow-auto text-xs">{result.errors.map((item, index) => <p className="border-b border-[#eee8df] pb-2 last:border-0" key={`${item.id}-${index}`}><span className="font-semibold">{item.name}</span>: {item.error}</p>)}</div></details> : <p className="mt-4 text-sm text-[#315d38]">Tutti i contatti sono stati sincronizzati correttamente.</p>}</section> : null}
          </>
        )}
      </section>

      {syncing ? <div aria-modal="true" className="fixed inset-0 z-40 grid place-items-center bg-[#27231f]/45 p-4" role="dialog"><section className="w-full max-w-md bg-[#fdfbf8] p-6 shadow-xl"><h2 className="text-lg font-semibold">Sincronizzazione in corso</h2><p className="mt-2 text-sm text-[#675f57]">Sincronizzazione in corso, non chiudere questa finestra</p><div className="mt-6 h-3 overflow-hidden bg-[#e7ddd3]"><div className="h-full w-2/5 animate-[progress_1.4s_ease-in-out_infinite] bg-[#9b5d43]" /></div></section></div> : null}
    </main>
  );
}