"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useState } from "react";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { MONTH_NAMES, planCoherence, priceListFor, serviceTargetValueCents, ticketAboveListMax, type ActivePackage, type EconomicPlan } from "@/lib/economic-plans";
import { addDraftService, removeDraftService, updateDraftService, updateDraftServiceMonth, type DraftService } from "@/lib/economic-plan-draft";

type Dashboard = {
  year: number;
  years: number[];
  planYears: number[];
  hasPlan: boolean;
  kpis: {
    annualTargetCents: number | null;
    acquiredCents: number;
    realizedCents: number;
    futureCents: number;
    coverage: number | null;
    toGenerateCents: number | null;
    cashInCents: number;
    averageTicketCents: number | null;
    realizedSessions: number;
    futureSessions: number;
  };
  months: { month: number; label: string; targetSessions: number | null; acquiredSessions: number; targetCents: number | null; realizedCents: number; futureCents: number; acquiredCents: number; gapCents: number | null; coverage: number | null }[];
  services: { serviceTypeId: string; name: string; inPlan: boolean; targetSessions: number | null; distributedSessions: number | null; acquiredSessions: number; targetValueCents: number | null; acquiredValueCents: number; gapCents: number | null }[];
  baseVsExtra: { baseCents: number; extrasCents: number; extraShare: number | null };
  cash: { collectedCents: number; receivableCents: number; voucherSalesCents: number; voucherSalesCount: number };
};
type Service = { id: string; name: string; is_active: boolean };
type Draft = { annual: string; uplift: string; notes: string; months: string[]; services: DraftService[] };

const SHORT_MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const EXTRA_ATTESI_TOOLTIP = "Valore aggiuntivo previsto oltre ai target base dei servizi, ad esempio extra fotografici, supplementi o altri incrementi.";
const toSessions = (value: string) => Math.max(0, Math.round(Number(value || 0)));

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const percent = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 1 });
const money = (cents: number | null) => (cents === null ? "—" : euro.format(cents / 100));
const rate = (value: number | null) => (value === null ? "—" : percent.format(value));
const toCents = (value: string) => Math.round(Number(value || 0) * 100);
const wholeEuro = (cents: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
const toEuros = (cents: number) => String(cents / 100);
const selectClass = "h-11 border border-[#cfc5b8] bg-white px-3";
const inputClass = "h-10 w-full border border-[#cfc5b8] bg-white px-3 text-right text-sm";
const NO_PLAN = "Nessun piano configurato";

export function EconomicAnalysis() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") === "piano" ? "piano" : "dashboard");
  const [year, setYear] = useState(searchParams.get("year") ?? "");

  useEffect(() => {
    const params = new URLSearchParams();
    if (tab === "piano") params.set("tab", "piano");
    if (year) params.set("year", year);
    router.replace(`/analisi/economico${params.size ? `?${params}` : ""}`, { scroll: false });
  }, [tab, year, router]);

  const openPlan = useCallback((planYear: number) => { setYear(String(planYear)); setTab("piano"); }, []);

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-6xl">
        <header className="border-b border-[#d8d0c5] pb-5">
          <h1 className="text-3xl font-semibold sm:text-4xl">Economico</h1>
          <p className="mt-2 text-sm text-[#675f57]">Valore commerciale delle sessioni (prezzo concordato + extra, annullate escluse) confrontato con il piano dell&apos;anno. L&apos;incassato è mostrato a parte.</p>
          <div className="mt-5 flex gap-1" role="tablist">
            {(["dashboard", "piano"] as const).map((value) => (
              <button aria-selected={tab === value} className={`border px-4 py-2 text-sm font-semibold ${tab === value ? "border-[#9b5d43] bg-[#9b5d43] text-white" : "border-[#cfc5b8] bg-white text-[#675f57] hover:border-[#9b5d43]"}`} key={value} onClick={() => setTab(value)} role="tab" type="button">
                {value === "dashboard" ? "Dashboard" : "Piano"}
              </button>
            ))}
          </div>
        </header>
        {tab === "dashboard" ? <DashboardView onOpenPlan={openPlan} setYear={setYear} year={year} /> : <PlanView setYear={setYear} year={year} />}
      </section>
    </main>
  );
}

function DashboardView({ year, setYear, onOpenPlan }: { year: string; setYear: (value: string) => void; onOpenPlan: (year: number) => void }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/analytics/economic${year ? `?year=${year}` : ""}`);
        const body = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(body.error);
        setData(body as Dashboard);
        setError(null);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Caricamento non riuscito.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [year]);

  async function createPlan(planYear: number) {
    const response = await fetch("/api/economic-plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year: planYear }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error); return; }
    onOpenPlan(planYear);
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-2 text-sm font-medium">Anno
          <select className={selectClass} onChange={(event) => setYear(event.target.value)} value={year || String(data?.year ?? "")}>
            {(data?.years ?? []).map((option) => <option key={option} value={option}>{option}{data?.planYears.includes(option) ? "" : " (senza piano)"}</option>)}
          </select>
        </label>
      </div>
      {error ? <p className="mt-6 text-sm text-[#a53e31]">{error}</p> : null}
      {loading && !data ? <p className="mt-6 text-sm text-[#675f57]">Caricamento analisi...</p> : null}
      {data ? (
        <div className={loading ? "opacity-60" : ""}>
          {!data.hasPlan ? (
            <div className="mt-6 flex flex-col gap-3 border border-[#d8b7a5] bg-[#f1e3db] px-4 py-3 text-sm text-[#8a4f37] sm:flex-row sm:items-center sm:justify-between">
              <span>{NO_PLAN} per il {data.year}: i dati reali sono disponibili, i confronti con il target no.</span>
              <button className="bg-[#9b5d43] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7f4934]" onClick={() => void createPlan(data.year)} type="button">Crea piano {data.year}</button>
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Target annuale" tooltip="Obiettivo di valore commerciale fissato nel piano dell'anno selezionato." value={data.hasPlan ? money(data.kpis.annualTargetCents) : NO_PLAN} />
            <Metric label="Valore commerciale acquisito" tooltip="Prezzo concordato + extra delle sessioni dell'anno non annullate: già svolte più future prenotate. Non è l'incassato." value={money(data.kpis.acquiredCents)} />
            <Metric label="Copertura target" tooltip="Valore commerciale acquisito / target annuale." value={data.hasPlan ? rate(data.kpis.coverage) : NO_PLAN} />
            <Metric label="Da generare" tooltip="Target annuale meno valore acquisito (minimo 0): quanto manca ancora da prenotare." value={data.hasPlan ? money(data.kpis.toGenerateCents) : NO_PLAN} />
            <Metric label="Incassato" tooltip="Pagamenti registrati nell'anno, inclusi acquisti di buoni. I riscatti di buoni non contano: sono già stati incassati all'acquisto." value={money(data.kpis.cashInCents)} />
            <Metric label="Ticket medio" tooltip="Valore commerciale acquisito / numero di sessioni acquisite (svolte + future) nell'anno." value={money(data.kpis.averageTicketCents)} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Metric label="Realizzato" tooltip="Valore delle sessioni dell'anno già avvenute." value={money(data.kpis.realizedCents)} />
            <Metric label="Futuro prenotato" tooltip="Valore delle sessioni dell'anno non ancora avvenute e non annullate." value={money(data.kpis.futureCents)} />
            <Metric label="Sessioni" tooltip="Sessioni non annullate dell'anno: già svolte + future prenotate." value={`${data.kpis.realizedSessions} + ${data.kpis.futureSessions}`} />
          </div>

          <DataTable
            columns={["Mese", "Sessioni target", "Sessioni acquisite", "Target €", "Realizzato", "Futuro", "Acquisito €", "Scostamento", "Copertura"]}
            rows={data.months.map((row) => [row.label, row.targetSessions === null ? "—" : String(row.targetSessions), String(row.acquiredSessions), data.hasPlan ? money(row.targetCents) : "—", money(row.realizedCents), money(row.futureCents), money(row.acquiredCents), money(row.gapCents), rate(row.coverage)])}
            title={<span className="inline-flex items-center gap-1.5">Target mensile vs reale {data.year}<InfoTooltip label="Informazioni su Sessioni target" text="Sessioni target: numero di sessioni pianificate per il mese, sommando tutti i servizi del Piano Economico. Sessioni acquisite: sessioni non annullate del mese, svolte e future." /></span>}
          />

          <DataTable
            columns={["Servizio", "Sessioni target", "Sessioni acquisite", "Valore target", "Valore acquisito", "Gap"]}
            emptyLabel="Nessun servizio pianificato né sessione nell'anno."
            rows={data.services.map((row) => [
              row.inPlan ? row.name : `${row.name} (fuori piano)`,
              row.targetSessions === null ? "—" : row.distributedSessions !== null && row.distributedSessions !== row.targetSessions ? `${row.targetSessions} (${row.distributedSessions} nei mesi)` : String(row.targetSessions),
              String(row.acquiredSessions),
              money(row.targetValueCents),
              money(row.acquiredValueCents),
              money(row.gapCents),
            ])}
            title="Target per servizio vs reale"
          />

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Panel title="Base vs extra">
              <Row label="Valore base" tooltip="Somma dei prezzi concordati delle sessioni dell'anno." value={money(data.baseVsExtra.baseCents)} />
              <Row label="Valore extra" tooltip="Somma dei totali riga degli extra venduti sulle sessioni dell'anno." value={money(data.baseVsExtra.extrasCents)} />
              <Row label="Contributo extra %" tooltip="Valore extra / (valore base + valore extra)." value={rate(data.baseVsExtra.extraShare)} />
            </Panel>
            <Panel title="Cassa">
              <Row label="Incassato anno" tooltip="Pagamenti con data nell'anno, esclusi i riscatti di buoni." value={money(data.cash.collectedCents)} />
              <Row label="Residuo da incassare" tooltip="Per le sessioni dell'anno: valore commerciale meno quanto già coperto (pagamenti e buoni riscattati)." value={money(data.cash.receivableCents)} />
              <Row label="Voucher venduti" tooltip="Incassi per acquisto di buoni regalo nell'anno. Il riscatto successivo non viene ricontato." value={`${money(data.cash.voucherSalesCents)} (${data.cash.voucherSalesCount})`} />
            </Panel>
          </div>
        </div>
      ) : null}
    </>
  );
}

function PlanView({ year, setYear }: { year: string; setYear: (value: string) => void }) {
  const [planYears, setPlanYears] = useState<number[] | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [packages, setPackages] = useState<ActivePackage[]>([]);
  const [loadedDraft, setLoadedDraft] = useState<{ year: number; draft: Draft } | null>(null);
  const [newYear, setNewYear] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadIndex = useCallback(async () => {
    const response = await fetch("/api/economic-plans");
    const body = await response.json();
    if (!response.ok) { setMessage({ kind: "error", text: body.error }); return null; }
    setPlanYears(body.years);
    setServices(body.services);
    setPackages(body.packages ?? []);
    return body.years as number[];
  }, []);

  useEffect(() => {
    void (async () => {
      const years = await loadIndex();
      if (years && years.length > 0 && !year) setYear(String(years[0]));
    })();
  }, [loadIndex, setYear, year]);

  const selected = year && planYears?.includes(Number(year)) ? Number(year) : null;
  // La bozza vale solo per l'anno da cui è stata caricata: mai salvare i valori di un altro anno.
  const draft = loadedDraft && loadedDraft.year === selected ? loadedDraft.draft : null;
  const setDraft = (next: Draft) => { if (selected !== null) setLoadedDraft({ year: selected, draft: next }); };

  useEffect(() => {
    if (selected === null) return;
    let active = true;
    void (async () => {
      const response = await fetch(`/api/economic-plans/${selected}`);
      const body = await response.json();
      if (!active) return;
      if (!response.ok) { setMessage({ kind: "error", text: body.error }); return; }
      setLoadedDraft({ year: selected, draft: toDraft(body as EconomicPlan) });
    })();
    return () => { active = false; };
  }, [selected]);

  const summary = useMemo(() => (draft ? planCoherence(fromDraft(draft)) : null), [draft]);
  const serviceName = (id: string) => services.find((service) => service.id === id)?.name ?? "Servizio non disponibile";
  const available = services.filter((service) => service.is_active && !draft?.services.some((row) => row.serviceTypeId === service.id));

  async function createPlan() {
    setBusy(true);
    const response = await fetch("/api/economic-plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year: Number(newYear) }) });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) { setMessage({ kind: "error", text: body.error }); return; }
    await loadIndex();
    setShowNew(false);
    setNewYear("");
    setYear(String(body.year));
    setMessage({ kind: "ok", text: `Piano ${body.year} creato con valori a zero.` });
  }

  async function save() {
    if (!draft || selected === null) return;
    setBusy(true);
    const response = await fetch(`/api/economic-plans/${selected}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fromDraft(draft)) });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) { setMessage({ kind: "error", text: body.error }); return; }
    setDraft(toDraft(body as EconomicPlan));
    setMessage({ kind: "ok", text: `Piano ${selected} salvato.` });
  }

  async function remove() {
    if (selected === null) return;
    if (!window.confirm(`Eliminare il Piano Economico ${selected}? Verranno rimossi solo target e note del piano: sessioni, pagamenti e servizi restano invariati.`)) return;
    setBusy(true);
    const response = await fetch(`/api/economic-plans/${selected}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) { setMessage({ kind: "error", text: "Eliminazione non riuscita." }); return; }
    const years = await loadIndex();
    setYear(years && years.length > 0 ? String(years[0]) : "");
    setMessage({ kind: "ok", text: `Piano ${selected} eliminato.` });
  }

  const update = (patch: Partial<Draft>) => { if (draft) setDraft({ ...draft, ...patch }); };

  return (
    <>
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2 text-sm font-medium">Anno
          <select className={selectClass} disabled={!planYears?.length} onChange={(event) => { setMessage(null); setYear(event.target.value); }} value={selected === null ? "" : String(selected)}>
            {selected === null ? <option value="">—</option> : null}
            {(planYears ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <button className="h-11 border border-[#cfc5b8] bg-white px-4 text-sm font-semibold hover:border-[#9b5d43]" onClick={() => setShowNew((open) => !open)} type="button">Nuovo piano</button>
        {selected !== null ? <button className="h-11 border border-[#e2c3bd] bg-white px-4 text-sm font-semibold text-[#a53e31] hover:border-[#a53e31]" disabled={busy} onClick={() => void remove()} type="button">Elimina piano</button> : null}
      </div>
      {showNew ? (
        <form className="mt-3 flex flex-wrap items-end gap-3 border border-[#d8d0c5] bg-white p-4" onSubmit={(event) => { event.preventDefault(); void createPlan(); }}>
          <label className="flex flex-col gap-2 text-sm font-medium">Anno del nuovo piano
            <input className="h-10 w-32 border border-[#cfc5b8] px-3 text-sm" max={2100} min={2000} onChange={(event) => setNewYear(event.target.value)} required type="number" value={newYear} />
          </label>
          <button className="h-10 bg-[#9b5d43] px-4 text-sm font-semibold text-white hover:bg-[#7f4934] disabled:opacity-50" disabled={busy || !newYear} type="submit">Crea piano vuoto</button>
          <p className="text-xs text-[#675f57]">Il nuovo piano parte da zero: nessun valore viene copiato da altri anni.</p>
        </form>
      ) : null}
      {message ? <p className={`mt-4 text-sm ${message.kind === "error" ? "text-[#a53e31]" : "text-[#3f6b4f]"}`}>{message.text}</p> : null}
      {planYears && planYears.length === 0 ? <p className="mt-6 text-sm text-[#675f57]">Nessun piano configurato. Usa &quot;Nuovo piano&quot; per crearne uno.</p> : null}

      {draft && summary && selected !== null ? (
        <div className="mt-6">
          <h2 className="text-2xl font-semibold">Piano Economico {selected}</h2>

          <section className="mt-5 border border-[#d8d0c5] bg-white p-5">
            <h3 className="text-lg font-semibold">Configurazione generale</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <EuroField label="Target annuale (EUR)" onChange={(value) => update({ annual: value })} value={draft.annual} />
              <EuroField label="Extra attesi (EUR)" onChange={(value) => update({ uplift: value })} tooltip={EXTRA_ATTESI_TOOLTIP} value={draft.uplift} />
              <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">Note
                <textarea className="min-h-20 border border-[#cfc5b8] bg-white px-3 py-2 text-sm" maxLength={2000} onChange={(event) => update({ notes: event.target.value })} value={draft.notes} />
              </label>
            </div>
            <dl className="mt-4 divide-y divide-[#eee8df] border border-[#eee8df] text-sm">
              <SummaryRow label="Target servizi totale" value={money(summary.serviceValueCents)} />
              <SummaryRow label="+ Extra attesi" value={money(toCents(draft.uplift))} />
              <SummaryRow label="= Valore pianificato" strong value={money(summary.plannedValueCents)} />
              <SummaryRow label="Target annuale" value={money(toCents(draft.annual))} />
            </dl>
            {summary.plannedDifferenceCents !== 0 ? <Warning>Servizi + extra attesi ({money(summary.plannedValueCents)}) non coincidono con il target annuale: differenza {money(summary.plannedDifferenceCents)}.</Warning> : null}
          </section>

          <section className="mt-6 border border-[#d8d0c5] bg-white p-5">
            <h3 className="text-lg font-semibold">Target mensili</h3>
            <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {MONTH_NAMES.map((name, index) => (
                <EuroField key={name} label={name} onChange={(value) => update({ months: draft.months.map((current, position) => (position === index ? value : current)) })} value={draft.months[index]} />
              ))}
            </div>
            <dl className="mt-4 divide-y divide-[#eee8df] border border-[#eee8df] text-sm">
              <SummaryRow label="Somma target mensili" value={money(summary.monthlySumCents)} />
              <SummaryRow label="Target annuale" value={money(toCents(draft.annual))} />
              <SummaryRow label="Differenza" strong value={money(summary.monthlyDifferenceCents)} />
            </dl>
            {summary.monthlyDifferenceCents !== 0 ? <Warning>La somma dei target mensili non coincide con il target annuale.</Warning> : null}
          </section>

          <section className="mt-6 overflow-x-auto border border-[#d8d0c5] bg-white">
            <p className="border-b border-[#d8d0c5] bg-[#eee8df] px-4 py-2 text-sm font-semibold">Target per servizio</p>
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead><tr className="text-xs font-semibold uppercase tracking-[0.06em] text-[#675f57]">
                <th className="px-4 py-2 text-left">Servizio</th>
                <th className="px-4 py-2 text-right">Sessioni target</th>
                <th className="px-4 py-2 text-left"><span className="inline-flex items-center gap-1">Listino attuale<InfoTooltip label="Informazioni su Listino attuale" text="Prezzi dei pacchetti attivi oggi in /pacchetti. Solo riferimento: non modifica il piano." /></span></th>
                <th className="px-4 py-2 text-right"><span className="inline-flex items-center gap-1">Ticket medio base pianificato (EUR)<InfoTooltip label="Informazioni su Ticket medio base pianificato" text="Valore medio base che prevedi di generare per ogni sessione di questo servizio, prima degli Extra attesi." /></span></th>
                <th className="px-4 py-2 text-right"><span className="inline-flex items-center gap-1">Valore base target<InfoTooltip label="Informazioni su Valore base target" text="Valore pianificato del servizio calcolato come Sessioni target × Ticket medio base pianificato." /></span></th>
                <th className="px-4 py-2" />
              </tr></thead>
              <tbody>
                {draft.services.length === 0 ? <tr><td className="px-4 py-3 text-[#675f57]" colSpan={6}>Nessun servizio nel piano.</td></tr> : draft.services.map((row) => {
                  const ticketCents = toCents(row.ticket);
                  const priceList = priceListFor(row.serviceTypeId, packages);
                  const change = (patch: Partial<Omit<DraftService, "serviceTypeId">>) => update({ services: updateDraftService(draft.services, row.serviceTypeId, patch) });
                  return (
                    <tr className="border-t border-[#eee8df] align-top" key={row.serviceTypeId}>
                      <td className="px-4 py-2 font-medium">{serviceName(row.serviceTypeId)}</td>
                      <td className="px-4 py-2"><input aria-label={`Sessioni target ${serviceName(row.serviceTypeId)}`} className={`${inputClass} ml-auto max-w-24`} min={0} onChange={(event) => change({ sessions: event.target.value })} step={1} type="number" value={row.sessions} /></td>
                      <td className="whitespace-nowrap px-4 py-2 text-[#675f57]">
                        {priceList ? (
                          <span className="inline-flex items-center gap-1">
                            {priceList.minCents === priceList.maxCents ? wholeEuro(priceList.minCents) : `${wholeEuro(priceList.minCents)}–${wholeEuro(priceList.maxCents)}`}
                            <InfoTooltip label={`Pacchetti attivi ${serviceName(row.serviceTypeId)}`} text={priceList.packages.map((entry) => `${entry.name} — ${wholeEuro(entry.priceCents)}`).join(" · ")} />
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <input aria-label={`Ticket medio base pianificato ${serviceName(row.serviceTypeId)}`} className={`${inputClass} ml-auto max-w-32`} min={0} onChange={(event) => change({ ticket: event.target.value })} step={0.01} type="number" value={row.ticket} />
                        {ticketAboveListMax(ticketCents, priceList) ? <p className="mt-1 max-w-56 text-right text-[11px] leading-snug text-[#7a5a17]">Il ticket medio pianificato supera il prezzo massimo del listino attuale. Potrebbe includere supplementi o condizioni non rappresentate dal listino.</p> : null}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">{money(serviceTargetValueCents(toSessions(row.sessions), ticketCents))}</td>
                      <td className="px-4 py-2 text-right"><button className="text-xs font-semibold text-[#a53e31] hover:underline" onClick={() => update({ services: removeDraftService(draft.services, row.serviceTypeId) })} type="button">Rimuovi</button></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr className="border-t border-[#d8d0c5] font-semibold">
                <td className="px-4 py-2">Totale</td><td className="px-4 py-2 text-right">{summary.serviceSessions}</td><td colSpan={2} /><td className="px-4 py-2 text-right">{money(summary.serviceValueCents)}</td><td />
              </tr></tfoot>
            </table>
            {available.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-[#eee8df] px-4 py-3">
                <select aria-label="Servizio da aggiungere" className="h-10 border border-[#cfc5b8] bg-white px-3 text-sm" defaultValue="" onChange={(event) => { if (event.target.value) update({ services: addDraftService(draft.services, event.target.value) }); event.target.value = ""; }}>
                  <option value="">+ Aggiungi servizio…</option>
                  {available.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                </select>
              </div>
            ) : null}
          </section>

          <section className="mt-6 border border-[#d8d0c5] bg-white">
            <div className="flex items-center gap-1.5 border-b border-[#d8d0c5] bg-[#eee8df] px-4 py-2">
              <p className="text-sm font-semibold">Distribuzione mensile sessioni</p>
              <InfoTooltip label="Informazioni su Distribuzione mensile sessioni" text="Indica quante sessioni di ciascun servizio prevedi di svolgere in ogni mese. La somma mensile può essere confrontata con il target annuale del servizio." />
            </div>
            {draft.services.length === 0 ? <p className="px-4 py-3 text-sm text-[#675f57]">Aggiungi un servizio al piano per distribuirne le sessioni nei mesi.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] border-collapse text-sm">
                  <thead><tr className="text-xs font-semibold uppercase tracking-[0.06em] text-[#675f57]">
                    <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left">Servizio</th>
                    {SHORT_MONTHS.map((label) => <th className="px-1 py-2 text-center" key={label}>{label}</th>)}
                    <th className="px-3 py-2 text-right">Tot</th>
                    <th className="px-3 py-2 text-right">Target</th>
                  </tr></thead>
                  <tbody>
                    {draft.services.map((row) => {
                      const total = row.monthlySessions.reduce((sum, value) => sum + toSessions(value), 0);
                      const target = toSessions(row.sessions);
                      return (
                        <tr className="border-t border-[#eee8df]" key={row.serviceTypeId}>
                          <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5 font-medium">{serviceName(row.serviceTypeId)}</td>
                          {row.monthlySessions.map((value, monthIndex) => (
                            <td className="px-1 py-1.5" key={SHORT_MONTHS[monthIndex]}>
                              <input
                                aria-label={`Sessioni ${serviceName(row.serviceTypeId)} ${MONTH_NAMES[monthIndex]}`}
                                className="h-9 w-full min-w-11 border border-[#cfc5b8] bg-white px-1 text-center text-sm"
                                min={0}
                                onChange={(event) => update({ services: updateDraftServiceMonth(draft.services, row.serviceTypeId, monthIndex, event.target.value) })}
                                step={1}
                                type="number"
                                value={value}
                              />
                            </td>
                          ))}
                          <td className={`px-3 py-1.5 text-right font-semibold ${total !== target ? "text-[#7a5a17]" : ""}`}>{total}</td>
                          <td className="px-3 py-1.5 text-right text-[#675f57]">{target}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot><tr className="border-t border-[#d8d0c5] font-semibold">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2">Sessioni distribuite</td>
                    {summary.distributedByMonth.map((value, index) => <td className="px-1 py-2 text-center" key={SHORT_MONTHS[index]}>{value}</td>)}
                    <td className="px-3 py-2 text-right">{summary.distributedSessions}</td>
                    <td className="px-3 py-2 text-right">{summary.serviceSessions}</td>
                  </tr></tfoot>
                </table>
              </div>
            )}
            {summary.undistributedServices.length > 0 || summary.distributionDifference !== 0 ? (
              <div className="px-4 pb-4">
                {summary.undistributedServices.map((entry) => (
                  <Warning key={entry.serviceTypeId}>{serviceName(entry.serviceTypeId)} — distribuzione mensile: {entry.distributedSessions} sessioni su target annuale {entry.targetSessions}.</Warning>
                ))}
                {summary.distributionDifference !== 0 ? <Warning>Totale sessioni distribuite {summary.distributedSessions} su {summary.serviceSessions} sessioni target di tutti i servizi (differenza {summary.distributionDifference > 0 ? "+" : ""}{summary.distributionDifference}).</Warning> : null}
              </div>
            ) : null}
          </section>

          <div className="sticky bottom-16 mt-6 flex justify-end sm:bottom-4">
            <button className="bg-[#9b5d43] px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#7f4934] disabled:opacity-50" disabled={busy} onClick={() => void save()} type="button">Salva piano {selected}</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function toDraft(plan: EconomicPlan): Draft {
  return {
    annual: toEuros(plan.annualTargetCents),
    uplift: toEuros(plan.expectedUpliftCents),
    notes: plan.notes ?? "",
    months: plan.monthlyTargets.map((entry) => toEuros(entry.targetCents)),
    services: plan.serviceTargets.map((entry) => ({ serviceTypeId: entry.serviceTypeId, sessions: String(entry.targetSessions), ticket: toEuros(entry.plannedBaseTicketCents), monthlySessions: entry.monthlySessions.map(String) })),
  };
}

function fromDraft(draft: Draft) {
  return {
    annualTargetCents: toCents(draft.annual),
    expectedUpliftCents: toCents(draft.uplift),
    notes: draft.notes,
    monthlyTargets: draft.months.map((value, index) => ({ month: index + 1, targetCents: toCents(value) })),
    serviceTargets: draft.services.map((row) => {
      const targetSessions = toSessions(row.sessions);
      const plannedBaseTicketCents = toCents(row.ticket);
      return { serviceTypeId: row.serviceTypeId, targetSessions, plannedBaseTicketCents, targetValueCents: serviceTargetValueCents(targetSessions, plannedBaseTicketCents), monthlySessions: row.monthlySessions.map(toSessions) };
    }),
  };
}

function EuroField({ label, value, onChange, tooltip }: { label: string; value: string; onChange: (value: string) => void; tooltip?: string }) {
  const inputId = useId();
  return (
    <div className="flex flex-col gap-1 text-sm font-medium">
      <span className="inline-flex items-center gap-1.5"><label htmlFor={inputId}>{label}</label>{tooltip ? <InfoTooltip label={`Informazioni su ${label}`} text={tooltip} /> : null}</span>
      <input className={inputClass} id={inputId} min={0} onChange={(event) => onChange(event.target.value)} step={0.01} type="number" value={value} />
    </div>
  );
}

function Metric({ label, value, tooltip }: { label: string; value: string; tooltip: string }) {
  return (
    <div className="border border-[#d8d0c5] bg-white px-4 py-3">
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">{label}</p>
        <InfoTooltip label={`Informazioni su ${label}`} text={tooltip} />
      </div>
      <p className={`mt-1 font-semibold ${value === NO_PLAN ? "text-sm text-[#8a8178]" : "text-2xl"}`}>{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-[#d8d0c5] bg-white">
      <p className="border-b border-[#d8d0c5] bg-[#eee8df] px-4 py-2 text-sm font-semibold">{title}</p>
      <dl className="divide-y divide-[#eee8df] text-sm">{children}</dl>
    </section>
  );
}

function Row({ label, value, tooltip }: { label: string; value: string; tooltip: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <dt className="flex items-center gap-1.5">{label}<InfoTooltip label={`Informazioni su ${label}`} text={tooltip} /></dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 ${strong ? "font-semibold" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return <p className="mt-3 border border-[#e6c98f] bg-[#fbf3e0] px-3 py-2 text-xs text-[#7a5a17]" role="status">{children}</p>;
}

function DataTable({ title, columns, rows, emptyLabel = "Nessun dato." }: { title: ReactNode; columns: string[]; rows: string[][]; emptyLabel?: string }) {
  return (
    <div className="mt-8 overflow-x-auto border border-[#d8d0c5] bg-white">
      <p className="border-b border-[#d8d0c5] bg-[#eee8df] px-4 py-2 text-sm font-semibold">{title}</p>
      <table className="w-full border-collapse text-sm">
        <thead><tr className="text-xs font-semibold uppercase tracking-[0.06em] text-[#675f57]">
          {columns.map((column, index) => <th className={`whitespace-nowrap px-4 py-2 ${index === 0 ? "text-left" : "text-right"}`} key={column}>{column}</th>)}
        </tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td className="px-4 py-3 text-[#675f57]" colSpan={columns.length}>{emptyLabel}</td></tr> : rows.map((row) => (
            <tr className="border-t border-[#eee8df]" key={row[0]}>
              {row.map((cell, index) => <td className={`whitespace-nowrap px-4 py-2 ${index === 0 ? "" : "text-right font-medium"}`} key={`${row[0]}-${columns[index]}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
