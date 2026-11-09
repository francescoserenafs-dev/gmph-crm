"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { MONTH_NAMES, computePlanTotals, computeVoucherPlanTotals, priceListFor, ticketAboveListMax, type ActivePackage, type EconomicDashboard, type EconomicPlan } from "@/lib/economic-plans";
import { addDraftService, draftToServices, draftToVoucherPlan, euroToCents, removeDraftService, servicesToDraft, updateDraftService, updateDraftServiceMonth, voucherPlanToDraft, type DraftService, type DraftVoucherPlan } from "@/lib/economic-plan-draft";

type Dashboard = EconomicDashboard & { years: number[]; planYears: number[] };
type Service = { id: string; name: string; is_active: boolean };
type Draft = { notes: string; services: DraftService[]; voucher: DraftVoucherPlan };

const SHORT_MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const percent = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 1 });
const money = (cents: number | null) => (cents === null ? "—" : euro.format(cents / 100));
const rate = (value: number | null) => (value === null ? "—" : percent.format(value));
const wholeEuro = (cents: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
const selectClass = "h-11 border border-[#cfc5b8] bg-white px-3";
const inputClass = "h-10 w-full border border-[#cfc5b8] bg-white px-3 text-right text-sm";
// Celle calcolate: sfondo neutro, mai modificabili.
const computedClass = "bg-[#f5f1eb] text-[#514a43]";
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
          <h1 className="flex items-center gap-2 text-3xl font-semibold sm:text-4xl">Economico<InfoTooltip label="Informazioni sui valori economici" text="I valori mostrati sono indicatori gestionali del CRM e non sostituiscono la contabilità fiscale." /></h1>
          <p className="mt-2 text-sm text-[#675f57]">Due viste separate: valore servizi (prezzo concordato + extra delle sessioni, per data sessione) e cassa (denaro ricevuto, per data pagamento). Un buono è cassa quando viene venduto e copertura della sessione quando viene usato.</p>
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
              <span>{NO_PLAN} per il {data.year}: valore servizi e cassa sono disponibili, il confronto con il piano no.</span>
              <button className="bg-[#9b5d43] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7f4934]" onClick={() => void createPlan(data.year)} type="button">Crea piano {data.year}</button>
            </div>
          ) : null}

          <SectionHeading
            title="Piano e servizi"
            tooltip="Valore del lavoro fotografico per data della sessione: prezzo concordato + extra, indipendentemente da come \u00e8 stato pagato (denaro o buoni). Sessioni annullate e servizi aggiuntivi legacy esclusi."
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Valore servizi pianificato" tooltip="Dal Piano dell'anno: sessioni pianificate nei mesi \u00d7 ticket medio pianificato di ciascun servizio." value={data.hasPlan ? money(data.services.plannedValueCents) : NO_PLAN} />
            <Metric label="Valore servizi acquisiti" tooltip="Sessioni dell'anno gi\u00e0 svolte + future gi\u00e0 prenotate. Non \u00e8 cassa." value={money(data.services.acquiredCents)} />
            <Metric label="Copertura del piano" tooltip="Valore servizi acquisiti / valore servizi pianificato. Non usa la cassa." value={data.hasPlan ? rate(data.services.coverage) : NO_PLAN} />
            <Metric label="Da generare" tooltip="Valore servizi pianificato meno acquisiti (minimo 0): quanto lavoro manca ancora da prenotare." value={data.hasPlan ? money(data.services.toGenerateCents) : NO_PLAN} />
            <Metric label="Valore servizi erogati" tooltip="Valore delle sessioni gi\u00e0 svolte, indipendentemente da come sono state pagate. Pu\u00f2 comprendere sessioni coperte da buoni regalo acquistati in precedenza." value={money(data.services.deliveredCents)} />
            <Metric label="Valore servizi futuri" tooltip="Valore delle sessioni dell'anno non ancora svolte e gi\u00e0 prenotate." value={money(data.services.futureCents)} />
            <Metric label="Sessioni" tooltip="Sessioni dell'anno: svolte + future prenotate. Esclusi i servizi aggiuntivi legacy." value={`${data.services.deliveredSessions} + ${data.services.futureSessions}`} />
            <Metric label="Ticket medio sessione" tooltip="Valore servizi acquisiti / numero di sessioni acquisite." value={money(data.services.averageTicketCents)} />
          </div>

          <DataTable
            columns={["Mese", "Sessioni pianificate", "Sessioni acquisite", "Valore pianificato", "Erogati", "Futuri", "Acquisiti", "Scostamento", "Copertura"]}
            rows={data.monthlyServices.map((row) => [row.label, row.plannedSessions === null ? "\u2014" : String(row.plannedSessions), String(row.acquiredSessions), money(row.plannedValueCents), money(row.deliveredCents), money(row.futureCents), money(row.acquiredCents), money(row.gapCents), rate(row.coverage)])}
            title={<span className="inline-flex items-center gap-1.5">Performance servizi per mese {data.year}<InfoTooltip label="Informazioni su Performance servizi per mese" text="Per mese della sessione. Valori in euro = valore servizi (prezzo + extra). Copertura = acquisiti / pianificato. La cassa \u00e8 nella tabella separata pi\u00f9 sotto, per data del pagamento: \u00e8 normale che i totali non coincidano." /></span>}
          />

          <DataTable
            columns={["Servizio", "Sessioni pianificate", "Sessioni acquisite", "Valore pianificato", "Valore acquisiti", "Scostamento"]}
            emptyLabel="Nessun servizio pianificato n\u00e9 sessione nell'anno."
            rows={data.serviceRows.map((row) => [
              row.inPlan ? row.name : `${row.name} (fuori piano)`,
              row.plannedSessions === null ? "\u2014" : String(row.plannedSessions),
              String(row.acquiredSessions),
              money(row.plannedValueCents),
              money(row.acquiredValueCents),
              money(row.gapCents),
            ])}
            title="Servizi: piano vs acquisiti"
          />

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Panel title="Copertura del valore servizi" tooltip="Come \u00e8 stato coperto il valore delle sessioni dell'anno: denaro registrato sulle sessioni (in qualunque data), buoni applicati (importo effettivamente usato) e parte ancora scoperta.">
              <Row label="Valore da coprire" tooltip="Valore servizi acquisiti, pi\u00f9 l'eventuale valore delle sessioni legacy indicate sotto." value={money(data.coverage.valueCents)} />
              <Row label="Copertura monetaria registrata" tooltip="Caparre, saldi e pagamenti completi registrati sulle sessioni dell'anno." value={money(data.coverage.monetaryCents)} />
              <Row label="Copertura tramite buoni" tooltip="Credito di buoni regalo applicato alle sessioni dell'anno. Non \u00e8 nuovo denaro." value={money(data.coverage.voucherCents)} />
              <Row label="Residuo da incassare" tooltip="Parte del valore non ancora coperta n\u00e9 da denaro n\u00e9 da buoni." value={money(data.coverage.residualCents)} />
              {data.legacyAddon.sessions > 0 ? <Row label={`di cui sessioni legacy (${data.legacyAddon.sessions})`} tooltip="Sessioni registrate con un servizio aggiuntivo (es. Provini Extra): non contano come sessioni n\u00e9 nel valore servizi, ma il loro valore resta qui per la riconciliazione." value={money(data.legacyAddon.valueCents)} /> : null}
            </Panel>
            <Panel title="Base vs extra">
              <Row label="Valore base" tooltip="Somma dei prezzi concordati delle sessioni dell'anno." value={money(data.baseVsExtra.baseCents)} />
              <Row label="Valore extra" tooltip="Somma dei totali riga degli extra venduti sulle sessioni dell'anno." value={money(data.baseVsExtra.extrasCents)} />
              <Row label="Contributo extra %" tooltip="Valore extra / (valore base + valore extra)." value={rate(data.baseVsExtra.extraShare)} />
            </Panel>
          </div>

          <SectionHeading
            title="Cassa e buoni"
            tooltip="Denaro effettivamente ricevuto, per data del pagamento. Comprende i buoni venduti, non i riscatti: un buono \u00e8 cassa quando viene venduto e copertura della sessione quando viene usato. Un anno pu\u00f2 quindi avere pi\u00f9 cassa che valore servizi (molti buoni venduti) o il contrario (riscatti di buoni venduti negli anni precedenti)."
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Cassa anno" tooltip="Denaro effettivamente ricevuto nell'anno. Comprende anche i buoni regalo venduti, ma non i riscatti dei buoni." value={money(data.cash.totalCents)} />
            <Metric label="Cassa da sessioni" tooltip="Caparre, saldi e pagamenti completi delle sessioni, per data del pagamento." value={money(data.cash.sessionCashCents)} />
            <Metric label="Vendite buoni" tooltip="Cassa da acquisto di buoni regalo nell'anno (numero di buoni tra parentesi)." value={`${money(data.cash.voucherSalesCents)} (${data.cash.voucherSalesCount})`} />
            <Metric label="Vendite buoni previste" tooltip="Dal Piano dell'anno: buoni previsti \u00d7 ticket medio buono. Previsione separata dal valore servizi." value={data.hasPlan ? money(data.plan.voucherSalesValueCents) : NO_PLAN} />
            <Metric label="Riscatti buoni" tooltip="Credito di buoni regalo utilizzato per coprire le sessioni dell'anno (importo effettivamente applicato). Non rappresenta nuovo denaro incassato." value={money(data.redemptions.totalCents)} />
            <Metric label="Riscatti buoni pregressi" tooltip="Parte dei riscatti dell'anno relativa a buoni incassati in anni precedenti: lavoro svolto quest'anno ma gi\u00e0 pagato prima." value={money(data.redemptions.priorYearCents)} />
            <Metric label="Riscatti buoni omaggio" tooltip="Parte dei riscatti dell'anno coperta da buoni omaggio, che non hanno mai generato cassa." value={money(data.redemptions.complimentaryCents)} />
            <Metric label="Buoni attivi da erogare" tooltip="Credito nominale dei buoni ancora attivi (omaggi inclusi): lavoro che resta da svolgere. Indicatore operativo, non un dato contabile o fiscale." value={`${money(data.activeVouchers.creditCents)} (${data.activeVouchers.count})`} />
          </div>
          {data.redemptions.unknownCount > 0 ? (
            <p className="mt-4 border border-[#e6c98f] bg-[#fbf3e0] px-3 py-2 text-xs text-[#7a5a17]" role="status">
              {data.redemptions.unknownCount} riscatti non classificati ({money(data.redemptions.unknownCents)}): buono senza pagamento di acquisto, con data di acquisto mancante o successiva alla sessione, o non collegato. Sono inclusi nei riscatti ma non tra pregressi o omaggi; i dati non vengono corretti automaticamente.
            </p>
          ) : null}

          <DataTable
            columns={["Mese", "Cassa da sessioni", "Vendite buoni", "Cassa totale", "Riscatti buoni", "di cui pregressi", "di cui omaggio", ...(data.hasPlan ? ["Vendite buoni previste"] : [])]}
            rows={data.monthlyCash.map((row) => [row.label, money(row.sessionCashCents), money(row.voucherSalesCents), money(row.totalCashCents), money(row.redemptionsCents), money(row.priorYearRedemptionsCents), money(row.complimentaryRedemptionsCents), ...(data.hasPlan ? [money(row.plannedVoucherSalesCents)] : [])])}
            title={<span className="inline-flex items-center gap-1.5">Cassa e buoni per mese {data.year}<InfoTooltip label="Informazioni su Cassa e buoni per mese" text="Per data del pagamento. Cassa totale = cassa da sessioni + vendite buoni, mai i riscatti. I riscatti sono mostrati per data di registrazione e non sono denaro. I totali annuali dei riscatti possono differire di poco dai KPI, che si riferiscono alle sessioni dell'anno." /></span>}
          />
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

  const totals = useMemo(() => (draft ? computePlanTotals(draftToServices(draft.services)) : null), [draft]);
  const voucherTotals = useMemo(() => (draft ? computeVoucherPlanTotals(draftToVoucherPlan(draft.voucher)) : null), [draft]);
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
    setMessage({ kind: "ok", text: `Piano ${body.year} creato vuoto.` });
  }

  async function save() {
    if (!draft || selected === null) return;
    setBusy(true);
    const response = await fetch(`/api/economic-plans/${selected}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: draft.notes, services: draftToServices(draft.services), voucherPlan: draftToVoucherPlan(draft.voucher) }) });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) { setMessage({ kind: "error", text: body.error }); return; }
    setDraft(toDraft(body as EconomicPlan));
    setMessage({ kind: "ok", text: `Piano ${selected} salvato.` });
  }

  async function remove() {
    if (selected === null) return;
    if (!window.confirm(`Eliminare il Piano Economico ${selected}? Verranno rimossi solo servizi pianificati, ticket, sessioni mensili, buoni previsti e note del piano: sessioni reali, pagamenti, buoni, catalogo e listini restano invariati.`)) return;
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

      {draft && totals && voucherTotals && selected !== null ? (
        <div className="mt-6">
          <h2 className="text-2xl font-semibold">Piano Economico {selected}</h2>
          <p className="mt-1 text-sm text-[#675f57]">Decidi servizi, sessioni per mese e ticket medio: tutti i totali sono calcolati automaticamente (sessioni × ticket medio pianificato).</p>

          <section className="mt-5 border border-[#d8d0c5] bg-white p-5">
            <h3 className="text-lg font-semibold">Riepilogo Piano {selected}</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className={`border border-[#d8d0c5] px-4 py-3 ${computedClass}`}>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">Valore servizi pianificato {selected}</p>
                  <InfoTooltip label="Informazioni su Valore servizi pianificato" text="Valore del lavoro fotografico pianificato: somma, per ogni servizio, delle sessioni dei 12 mesi × ticket medio pianificato. Non è cassa prevista e non comprende le vendite di buoni. Calcolato, non modificabile." />
                </div>
                <p className="mt-1 text-3xl font-semibold text-[#27231f]">{money(totals.totalValueCents)}</p>
              </div>
              <div className={`border border-[#d8d0c5] px-4 py-3 ${computedClass}`}>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">Vendite buoni previste {selected}</p>
                  <InfoTooltip label="Informazioni su Vendite buoni previste" text="Previsione separata: buoni previsti × ticket medio buono. Non si somma al valore servizi pianificato, perché un buono venduto diventa una sessione in seguito (anche in un altro anno)." />
                </div>
                <p className="mt-1 text-3xl font-semibold text-[#27231f]">{money(voucherTotals.totalValueCents)}</p>
                <p className="text-xs text-[#675f57]">{voucherTotals.totalCount} buoni previsti</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Metric computed label="Sessioni pianificate" tooltip="Somma delle sessioni inserite nei 12 mesi per tutti i servizi." value={String(totals.totalSessions)} />
              <Metric computed label="Ticket medio complessivo" tooltip="Valore servizi pianificato / sessioni pianificate. Senza sessioni non è calcolabile." value={money(totals.averageTicketCents)} />
              <Metric computed label="Servizi pianificati" tooltip="Servizi del piano con almeno una sessione pianificata." value={String(totals.plannedServices)} />
            </div>
            <label className="mt-4 flex flex-col gap-2 text-sm font-medium">Note
              <textarea className="min-h-20 border border-[#cfc5b8] bg-white px-3 py-2 text-sm" maxLength={2000} onChange={(event) => update({ notes: event.target.value })} placeholder="Note libere: non influiscono sui calcoli." value={draft.notes} />
            </label>
          </section>

          <section className="mt-6 overflow-x-auto border border-[#d8d0c5] bg-white">
            <div className="flex items-center gap-1.5 border-b border-[#d8d0c5] bg-[#eee8df] px-4 py-2">
              <p className="text-sm font-semibold">Piano per servizio</p>
              <InfoTooltip label="Informazioni su Piano per servizio" text="Unico campo modificabile: il ticket medio pianificato. Sessioni e valore derivano dalla distribuzione mensile." />
            </div>
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead><tr className="text-xs font-semibold uppercase tracking-[0.06em] text-[#675f57]">
                <th className="px-4 py-2 text-left">Servizio</th>
                <th className="px-4 py-2 text-right"><span className="inline-flex items-center gap-1">Sessioni pianificate<InfoTooltip label="Informazioni su Sessioni pianificate" text="Somma delle sessioni inserite nei 12 mesi della distribuzione mensile. Calcolato, non modificabile." /></span></th>
                <th className="px-4 py-2 text-left"><span className="inline-flex items-center gap-1">Listino attuale<InfoTooltip label="Informazioni su Listino attuale" text="Prezzi dei pacchetti attivi oggi nel Catalogo. Solo riferimento: non modifica il piano." /></span></th>
                <th className="px-4 py-2 text-right"><span className="inline-flex items-center gap-1">Ticket medio pianificato (EUR)<InfoTooltip label="Informazioni su Ticket medio pianificato" text="Ricavo medio previsto per una sessione del servizio, inclusi extra, stampe, album, supplementi e upgrade. Può essere inferiore, uguale o superiore al listino." /></span></th>
                <th className="px-4 py-2 text-right"><span className="inline-flex items-center gap-1">Valore pianificato<InfoTooltip label="Informazioni su Valore pianificato" text="Sessioni pianificate × Ticket medio pianificato. Calcolato, non modificabile." /></span></th>
                <th className="px-4 py-2" />
              </tr></thead>
              <tbody>
                {draft.services.length === 0 ? <tr><td className="px-4 py-3 text-[#675f57]" colSpan={6}>Nessun servizio nel piano. Aggiungine uno per iniziare.</td></tr> : draft.services.map((row, index) => {
                  const computed = totals.services[index];
                  const priceList = priceListFor(row.serviceTypeId, packages);
                  const name = serviceName(row.serviceTypeId);
                  return (
                    <tr className="border-t border-[#eee8df] align-top" key={row.serviceTypeId}>
                      <td className="px-4 py-2 font-medium">{name}</td>
                      <td className="px-4 py-2 text-right"><span className={`inline-block min-w-12 px-2 py-2 font-medium ${computedClass}`}>{computed.sessions}</span></td>
                      <td className="whitespace-nowrap px-4 py-2 text-[#675f57]">
                        {priceList ? (
                          <span className="inline-flex items-center gap-1">
                            {priceList.minCents === priceList.maxCents ? wholeEuro(priceList.minCents) : `${wholeEuro(priceList.minCents)}–${wholeEuro(priceList.maxCents)}`}
                            <InfoTooltip label={`Pacchetti attivi ${name}`} text={priceList.packages.map((entry) => `${entry.name} — ${wholeEuro(entry.priceCents)}`).join(" · ")} />
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          aria-label={`Ticket medio pianificato ${name}`}
                          className={`${inputClass} ml-auto max-w-32`}
                          inputMode="decimal"
                          onBlur={() => { if (!row.ticket.trim()) update({ services: updateDraftService(draft.services, row.serviceTypeId, { ticket: "0" }) }); }}
                          onChange={(event) => { if (/^\d*([.,]\d{0,2})?$/.test(event.target.value)) update({ services: updateDraftService(draft.services, row.serviceTypeId, { ticket: event.target.value }) }); }}
                          type="text"
                          value={row.ticket}
                        />
                        {ticketAboveListMax(euroToCents(row.ticket), priceList) ? <p className="mt-1 max-w-56 text-right text-[11px] leading-snug text-[#675f57]">Sopra il massimo del listino: ammesso se include extra, stampe, album o supplementi.</p> : null}
                      </td>
                      <td className="px-4 py-2 text-right"><span className={`inline-block px-2 py-2 font-semibold ${computedClass}`}>{money(computed.valueCents)}</span></td>
                      <td className="px-4 py-2 text-right">
                        <button
                          className="py-2 text-xs font-semibold text-[#a53e31] hover:underline"
                          onClick={() => {
                            if (computed.sessions > 0 && !window.confirm(`Rimuovere ${name} dal piano? Verranno eliminate le ${computed.sessions} sessioni mensili pianificate. Il servizio resta nel catalogo.`)) return;
                            update({ services: removeDraftService(draft.services, row.serviceTypeId) });
                          }}
                          type="button"
                        >
                          Rimuovi
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr className="border-t border-[#d8d0c5] font-semibold">
                <td className="px-4 py-2">Totale</td><td className="px-4 py-2 text-right">{totals.totalSessions}</td><td colSpan={2} /><td className="px-4 py-2 text-right">{money(totals.totalValueCents)}</td><td />
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
              <InfoTooltip label="Informazioni su Distribuzione mensile sessioni" text="Fonte di verità del piano: quante sessioni di ciascun servizio prevedi in ogni mese (numeri interi ≥ 0). Il totale per servizio e i fatturati derivano da qui." />
            </div>
            {draft.services.length === 0 ? <p className="px-4 py-3 text-sm text-[#675f57]">Aggiungi un servizio al piano per distribuirne le sessioni nei mesi.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] border-collapse text-sm">
                  <thead><tr className="text-xs font-semibold uppercase tracking-[0.06em] text-[#675f57]">
                    <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left">Servizio</th>
                    {SHORT_MONTHS.map((label) => <th className="px-1 py-2 text-center" key={label}>{label}</th>)}
                    <th className="px-3 py-2 text-right"><span className="inline-flex items-center gap-1">Tot<InfoTooltip label="Informazioni su Tot" text="Somma dei 12 mesi: coincide con le Sessioni pianificate del servizio." /></span></th>
                  </tr></thead>
                  <tbody>
                    {draft.services.map((row, index) => (
                      <tr className="border-t border-[#eee8df]" key={row.serviceTypeId}>
                        <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5 font-medium">{serviceName(row.serviceTypeId)}</td>
                        {row.monthlySessions.map((value, monthIndex) => (
                          <td className="px-1 py-1.5" key={SHORT_MONTHS[monthIndex]}>
                            <input
                              aria-label={`Sessioni ${serviceName(row.serviceTypeId)} ${MONTH_NAMES[monthIndex]}`}
                              className="h-9 w-full min-w-11 border border-[#cfc5b8] bg-white px-1 text-center text-sm"
                              inputMode="numeric"
                              onBlur={() => { if (!value.trim()) update({ services: updateDraftServiceMonth(draft.services, row.serviceTypeId, monthIndex, "0") }); }}
                              onChange={(event) => { if (/^\d{0,4}$/.test(event.target.value)) update({ services: updateDraftServiceMonth(draft.services, row.serviceTypeId, monthIndex, event.target.value) }); }}
                              onFocus={(event) => event.target.select()}
                              type="text"
                              value={value}
                            />
                          </td>
                        ))}
                        <td className={`px-3 py-1.5 text-right font-semibold ${computedClass}`}>{totals.services[index].sessions}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="border-t border-[#d8d0c5] font-semibold">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2">Totale sessioni</td>
                    {totals.monthlySessions.map((value, index) => <td className="px-1 py-2 text-center" key={SHORT_MONTHS[index]}>{value}</td>)}
                    <td className="px-3 py-2 text-right">{totals.totalSessions}</td>
                  </tr></tfoot>
                </table>
              </div>
            )}
          </section>

          <section className="mt-6 border border-[#d8d0c5] bg-white">
            <div className="flex items-center gap-1.5 border-b border-[#d8d0c5] bg-[#eee8df] px-4 py-2">
              <p className="text-sm font-semibold">Valore servizi mensile pianificato</p>
              <InfoTooltip label="Informazioni su Valore servizi mensile pianificato" text="Per ogni mese: somma di sessioni del servizio nel mese × ticket medio pianificato del servizio. Calcolato, non modificabile." />
            </div>
            <dl className="grid gap-px bg-[#eee8df] sm:grid-cols-3 lg:grid-cols-4">
              {MONTH_NAMES.map((name, index) => (
                <div className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${computedClass}`} key={name}>
                  <dt>{name} <span className="text-xs text-[#81776d]">({totals.monthlySessions[index]} sess.)</span></dt>
                  <dd className="font-semibold text-[#27231f]">{money(totals.monthlyValueCents[index])}</dd>
                </div>
              ))}
            </dl>
            <div className="flex items-center justify-between border-t border-[#d8d0c5] px-4 py-3 font-semibold">
              <span>Totale annuale</span>
              <span>{money(totals.monthlyValueCents.reduce((sum, value) => sum + value, 0))}</span>
            </div>
          </section>

          <section className="mt-6 border border-[#d8d0c5] bg-white">
            <div className="flex items-center gap-1.5 border-b border-[#d8d0c5] bg-[#eee8df] px-4 py-2">
              <p className="text-sm font-semibold">Vendite buoni regalo previste</p>
              <InfoTooltip label="Informazioni su Vendite buoni regalo previste" text="Facoltativo. Indica il ticket medio di un buono e quanti buoni prevedi di vendere ogni mese: il valore è calcolato. È una previsione di cassa separata dal valore servizi pianificato e non si somma ad esso." />
            </div>
            <div className="px-4 pt-4">
              <label className="flex max-w-xs flex-col gap-2 text-sm font-medium">Ticket medio buono (EUR)
                <input
                  aria-label="Ticket medio buono"
                  className={inputClass}
                  inputMode="decimal"
                  onBlur={() => { if (!draft.voucher.ticket.trim()) update({ voucher: { ...draft.voucher, ticket: "0" } }); }}
                  onChange={(event) => { if (/^\d*([.,]\d{0,2})?$/.test(event.target.value)) update({ voucher: { ...draft.voucher, ticket: event.target.value } }); }}
                  type="text"
                  value={draft.voucher.ticket}
                />
              </label>
            </div>
            <div className="overflow-x-auto px-4 pb-4 pt-3">
              <table className="w-full min-w-[52rem] border-collapse text-sm">
                <thead><tr className="text-xs font-semibold uppercase tracking-[0.06em] text-[#675f57]">
                  <th className="py-2 pr-3 text-left" />
                  {SHORT_MONTHS.map((label) => <th className="px-1 py-2 text-center" key={label}>{label}</th>)}
                  <th className="px-3 py-2 text-right">Tot</th>
                </tr></thead>
                <tbody>
                  <tr className="border-t border-[#eee8df]">
                    <td className="whitespace-nowrap py-1.5 pr-3 font-medium">Buoni previsti</td>
                    {draft.voucher.monthlyCounts.map((value, monthIndex) => (
                      <td className="px-1 py-1.5" key={SHORT_MONTHS[monthIndex]}>
                        <input
                          aria-label={`Buoni previsti ${MONTH_NAMES[monthIndex]}`}
                          className="h-9 w-full min-w-11 border border-[#cfc5b8] bg-white px-1 text-center text-sm"
                          inputMode="numeric"
                          onBlur={() => { if (!value.trim()) update({ voucher: { ...draft.voucher, monthlyCounts: draft.voucher.monthlyCounts.map((cell, index) => (index === monthIndex ? "0" : cell)) } }); }}
                          onChange={(event) => { if (/^\d{0,4}$/.test(event.target.value)) update({ voucher: { ...draft.voucher, monthlyCounts: draft.voucher.monthlyCounts.map((cell, index) => (index === monthIndex ? event.target.value : cell)) } }); }}
                          onFocus={(event) => event.target.select()}
                          type="text"
                          value={value}
                        />
                      </td>
                    ))}
                    <td className={`px-3 py-1.5 text-right font-semibold ${computedClass}`}>{voucherTotals.totalCount}</td>
                  </tr>
                  <tr className="border-t border-[#eee8df]">
                    <td className="whitespace-nowrap py-1.5 pr-3 font-medium">Valore previsto</td>
                    {voucherTotals.monthlyValueCents.map((cents, index) => <td className={`px-1 py-1.5 text-center text-xs ${computedClass}`} key={SHORT_MONTHS[index]}>{wholeEuro(cents)}</td>)}
                    <td className={`whitespace-nowrap px-3 py-1.5 text-right font-semibold ${computedClass}`}>{money(voucherTotals.totalValueCents)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
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
    notes: plan.notes ?? "",
    services: servicesToDraft(plan.services),
    voucher: voucherPlanToDraft(plan.voucherPlan),
  };
}

function Metric({ label, value, tooltip, computed = false }: { label: string; value: string; tooltip: string; computed?: boolean }) {
  return (
    <div className={`border border-[#d8d0c5] px-4 py-3 ${computed ? computedClass : "bg-white"}`}>
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">{label}</p>
        <InfoTooltip label={`Informazioni su ${label}`} text={tooltip} />
      </div>
      <p className={`mt-1 font-semibold ${value === NO_PLAN ? "text-sm text-[#8a8178]" : "text-2xl"}`}>{value}</p>
    </div>
  );
}

function SectionHeading({ title, tooltip }: { title: string; tooltip: string }) {
  return (
    <h2 className="mt-10 flex items-center gap-1.5 border-b border-[#d8d0c5] pb-2 text-xl font-semibold first:mt-6">{title}<InfoTooltip label={`Informazioni su ${title}`} text={tooltip} /></h2>
  );
}

function Panel({ title, tooltip, children }: { title: string; tooltip?: string; children: ReactNode }) {
  return (
    <section className="border border-[#d8d0c5] bg-white">
      <p className="flex items-center gap-1.5 border-b border-[#d8d0c5] bg-[#eee8df] px-4 py-2 text-sm font-semibold">{title}{tooltip ? <InfoTooltip label={`Informazioni su ${title}`} text={tooltip} /> : null}</p>
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
