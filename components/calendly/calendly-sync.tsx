"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, RefreshCw, UploadCloud } from "lucide-react";

type EventType = { uri: string; name: string; active: boolean };
type Service = { id: string; name: string; is_active: boolean };
type Mapping = { id: string; calendly_event_type_uri: string; calendly_event_type_name: string; weekday_price_cents: number; weekend_price_cents: number; service_type: { id: string; name: string } | null };
type PreviewItem = { eventUri: string; eventName: string; startTime: string; inviteeName: string; inviteeEmail: string; serviceTypeName: string; priceCents: number; clientAction: "match" | "create" };
type UnmappedItem = { eventUri: string; eventName: string; startTime: string; calendlyEventTypeName: string };
type SyncResult = { created: number; skippedUnmapped: number; total: number; errors: { eventName: string; error: string }[] };

export function CalendlySync() {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [newMapping, setNewMapping] = useState<{ eventTypeUri: string; serviceTypeId: string; weekdayPriceEuros: string; weekendPriceEuros: string }>({ eventTypeUri: "", serviceTypeId: "", weekdayPriceEuros: "", weekendPriceEuros: "" });
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [unmapped, setUnmapped] = useState<UnmappedItem[]>([]);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMappings = useCallback(async () => {
    const response = await fetch("/api/calendly/mappings");
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setMappings(body.mappings ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [configResponse, mappingsResponse] = await Promise.all([fetch("/api/config"), fetch("/api/calendly/mappings")]);
        const configBody = await configResponse.json();
        const mappingsBody = await mappingsResponse.json();
        if (!configResponse.ok) throw new Error(configBody.error);
        if (!mappingsResponse.ok) throw new Error(mappingsBody.error);
        setServices((configBody.services ?? []).filter((service: Service) => service.is_active));
        setLastSyncAt(configBody.calendlyLastSyncAt ?? null);
        setMappings(mappingsBody.mappings ?? []);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Caricamento non riuscito.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function loadEventTypes() {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/calendly/event-types");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setEventTypes(body.eventTypes ?? []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Impossibile caricare gli eventi Calendly."); } finally { setBusy(false); }
  }

  async function saveMapping() {
    const eventType = eventTypes.find((entry) => entry.uri === newMapping.eventTypeUri);
    const weekdayPriceEuros = Number(newMapping.weekdayPriceEuros);
    const weekendPriceEuros = Number(newMapping.weekendPriceEuros);
    if (!eventType || !newMapping.serviceTypeId || !Number.isInteger(weekdayPriceEuros) || weekdayPriceEuros < 0 || !Number.isInteger(weekendPriceEuros) || weekendPriceEuros < 0) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/calendly/mappings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ calendlyEventTypeUri: eventType.uri, calendlyEventTypeName: eventType.name, serviceTypeId: newMapping.serviceTypeId, weekdayPriceEuros, weekendPriceEuros }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setNewMapping({ eventTypeUri: "", serviceTypeId: "", weekdayPriceEuros: "", weekendPriceEuros: "" });
      await loadMappings();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Salvataggio mappatura non riuscito."); } finally { setBusy(false); }
  }

  async function removeMapping(id: string) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/calendly/mappings/${id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await loadMappings();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Rimozione mappatura non riuscita."); } finally { setBusy(false); }
  }

  async function preview() {
    setBusy(true); setError(null); setResult(null);
    try {
      const response = await fetch("/api/calendly/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setItems(body.items ?? []);
      setUnmapped(body.unmapped ?? []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Anteprima non riuscita."); } finally { setBusy(false); }
  }

  async function startSync() {
    setSyncing(true); setError(null); setResult(null);
    try {
      const response = await fetch("/api/calendly/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ execute: true }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setResult(body as SyncResult);
      setItems([]); setUnmapped([]);
      setLastSyncAt(new Date().toISOString());
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Sincronizzazione non riuscita."); } finally { setSyncing(false); }
  }

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-6xl">
        <header className="border-b border-[#d8d0c5] pb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b5d43]">Integrazione</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Calendly</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#675f57]">Importa in sola lettura le prenotazioni Calendly come nuove sessioni. Il piano Free non supporta i webhook: la sincronizzazione va avviata manualmente.</p>
        </header>

        {error ? <p className="mt-5 border border-[#d9aaa0] bg-[#fff7f5] p-3 text-sm text-[#a53e31]">{error}</p> : null}
        {loading ? <p className="mt-8 text-sm text-[#675f57]">Caricamento...</p> : (
          <>
            <section className="mt-7 border border-[#d8d0c5] bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-lg font-semibold">Mappatura Eventi Calendly → Servizi</h2><p className="mt-1 text-xs text-[#675f57]">Ogni &quot;Evento&quot; Calendly deve corrispondere a un tipo di servizio del CRM prima di poter essere importato.</p></div>
                <button className="flex items-center gap-2 border border-[#d8d0c5] px-3 py-2 text-xs font-semibold transition-colors hover:border-[#9b5d43] disabled:opacity-60" disabled={busy || syncing} onClick={() => void loadEventTypes()} type="button"><RefreshCw className="size-4 text-[#9b5d43]" strokeWidth={1.8} />Carica eventi da Calendly</button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_6rem_6rem_auto]">
                <select className="h-10 border border-[#cfc5b8] bg-white px-3 text-sm" disabled={eventTypes.length === 0} onChange={(event) => setNewMapping((current) => ({ ...current, eventTypeUri: event.target.value }))} value={newMapping.eventTypeUri}>
                  <option value="">{eventTypes.length === 0 ? "Carica prima gli eventi" : "Seleziona evento Calendly"}</option>
                  {eventTypes.map((eventType) => <option key={eventType.uri} value={eventType.uri}>{eventType.name}{eventType.active ? "" : " (non attivo)"}</option>)}
                </select>
                <select className="h-10 border border-[#cfc5b8] bg-white px-3 text-sm" onChange={(event) => setNewMapping((current) => ({ ...current, serviceTypeId: event.target.value }))} value={newMapping.serviceTypeId}>
                  <option value="">Seleziona servizio CRM</option>
                  {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                </select>
                <input className="h-10 border border-[#cfc5b8] bg-white px-3 text-sm" inputMode="numeric" min={0} onChange={(event) => setNewMapping((current) => ({ ...current, weekdayPriceEuros: event.target.value }))} placeholder="Feriale €" type="number" value={newMapping.weekdayPriceEuros} />
                <input className="h-10 border border-[#cfc5b8] bg-white px-3 text-sm" inputMode="numeric" min={0} onChange={(event) => setNewMapping((current) => ({ ...current, weekendPriceEuros: event.target.value }))} placeholder="Festivo €" type="number" value={newMapping.weekendPriceEuros} />
                <button className="h-10 bg-[#9b5d43] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || !newMapping.eventTypeUri || !newMapping.serviceTypeId || newMapping.weekdayPriceEuros === "" || newMapping.weekendPriceEuros === ""} onClick={() => void saveMapping()} type="button">Salva mappatura</button>
              </div>
              <p className="mt-2 text-xs text-[#958b80]">Calendly non gestisce un prezzo per evento: indicalo qui. Il prezzo festivo (sabato e domenica) viene applicato in base alla data della sessione.</p>

              {mappings.length > 0 ? (
                <div className="mt-5 divide-y divide-[#eee8df] border-t border-[#eee8df]">
                  {mappings.map((mapping) => (
                    <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm" key={mapping.id}>
                      <p><span className="font-medium">{mapping.calendly_event_type_name}</span> → {mapping.service_type?.name ?? "servizio rimosso"} <span className="text-xs text-[#958b80]">(feriale {(mapping.weekday_price_cents / 100).toFixed(2)}€ · festivo {(mapping.weekend_price_cents / 100).toFixed(2)}€)</span></p>
                      <button className="text-xs font-semibold text-[#a53e31] hover:underline" disabled={busy} onClick={() => void removeMapping(mapping.id)} type="button">Rimuovi</button>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-5 text-sm text-[#958b80]">Nessuna mappatura configurata.</p>}
            </section>

            <section className="mt-7 grid gap-4 md:grid-cols-2">
              <button className="flex min-h-28 flex-col items-start justify-between border border-[#d8d0c5] bg-white p-5 text-left transition-colors hover:border-[#9b5d43] disabled:opacity-60" disabled={busy || syncing} onClick={() => void preview()} type="button">
                <CalendarClock className="size-5 text-[#9b5d43]" strokeWidth={1.8} />
                <span><span className="block font-semibold">Controlla nuove prenotazioni</span><span className="mt-1 block text-xs font-normal text-[#675f57]">Anteprima delle sessioni da importare</span></span>
              </button>
              <button className="flex min-h-28 flex-col items-start justify-between border border-[#d8d0c5] bg-white p-5 text-left transition-colors hover:border-[#9b5d43] disabled:opacity-60" disabled={busy || syncing || items.length === 0} onClick={() => void startSync()} type="button">
                <UploadCloud className="size-5 text-[#9b5d43]" strokeWidth={1.8} />
                <span><span className="block font-semibold">Importa sessioni</span><span className="mt-1 block text-xs font-normal text-[#675f57]">Crea le sessioni in anteprima nel CRM</span></span>
              </button>
            </section>

            <section className="mt-7 border border-[#d8d0c5] bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee8df] pb-4">
                <div><h2 className="text-lg font-semibold">Prenotazioni pronte per l&apos;importazione</h2><p className="mt-1 text-xs text-[#675f57]">{items.length > 0 ? `${items.length} prenotazioni pronte` : "Avvia il controllo per caricare l'elenco."}</p></div>
                <p className="text-xs text-[#675f57]">Ultima sincronizzazione: {lastSyncAt ? new Date(lastSyncAt).toLocaleString("it-IT") : "mai eseguita"}</p>
              </div>
              {items.length > 0 ? (
                <div className="mt-4 max-h-[28rem] divide-y divide-[#eee8df] overflow-auto">
                  {items.map((item) => (
                    <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm" key={item.eventUri}>
                      <div><p className="font-medium">{item.inviteeName}</p><p className="text-xs text-[#675f57]">{item.inviteeEmail} · {item.serviceTypeName}</p></div>
                      <div className="text-right text-xs text-[#675f57]"><p>{new Date(item.startTime).toLocaleString("it-IT")}</p><p>{item.clientAction === "create" ? "Nuovo cliente" : "Cliente esistente"}</p></div>
                    </div>
                  ))}
                </div>
              ) : <div className="grid min-h-24 place-items-center text-center text-sm text-[#958b80]"><p>Nessuna prenotazione in attesa</p></div>}
              {unmapped.length > 0 ? (
                <details className="mt-5 border border-[#e4c98f] bg-[#fffaf0] p-3"><summary className="cursor-pointer text-sm font-semibold text-[#8a6d1f]">{unmapped.length} prenotazioni ignorate: evento Calendly senza mappatura</summary>
                  <div className="mt-3 space-y-2 text-xs">{unmapped.map((item) => <p key={item.eventUri}>{item.eventName} · {item.calendlyEventTypeName} · {new Date(item.startTime).toLocaleString("it-IT")}</p>)}</div>
                </details>
              ) : null}
            </section>

            {result ? (
              <section className="mt-7 border border-[#b9cfb9] bg-[#f8fcf7] p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-[#315d38]">Importazione completata</h2>
                <p className="mt-2 text-sm">Sessioni create: {result.created}. Ignorate (senza mappatura): {result.skippedUnmapped}. Errori: {result.errors.length}.</p>
                {result.errors.length > 0 ? <details className="mt-4 border border-[#d8d0c5] bg-white p-3"><summary className="cursor-pointer text-sm font-semibold">Mostra dettaglio errori</summary><div className="mt-3 max-h-64 space-y-2 overflow-auto text-xs">{result.errors.map((item, index) => <p className="border-b border-[#eee8df] pb-2 last:border-0" key={`${item.eventName}-${index}`}><span className="font-semibold">{item.eventName}</span>: {item.error}</p>)}</div></details> : null}
              </section>
            ) : null}
          </>
        )}
      </section>

      {syncing ? <div aria-modal="true" className="fixed inset-0 z-40 grid place-items-center bg-[#27231f]/45 p-4" role="dialog"><section className="w-full max-w-md bg-[#fdfbf8] p-6 shadow-xl"><h2 className="text-lg font-semibold">Importazione in corso</h2><p className="mt-2 text-sm text-[#675f57]">Non chiudere questa finestra.</p><div className="mt-6 h-3 overflow-hidden bg-[#e7ddd3]"><div className="h-full w-2/5 animate-[progress_1.4s_ease-in-out_infinite] bg-[#9b5d43]" /></div></section></div> : null}
    </main>
  );
}
