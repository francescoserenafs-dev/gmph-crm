"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ExtraMonthlyChart } from "@/components/extras/extra-monthly-chart";
import { EXTRA_CATEGORIES, EXTRA_CATEGORY_LABELS, type ExtraCategory } from "@/lib/extra-products";

type Summary = {
  sessions: number;
  withExtras: number;
  upsellRate: number | null;
  extrasCents: number;
  averageExtraPerSessionCents: number | null;
  averageExtraPerBuyerCents: number | null;
  averageInitialTicketCents: number | null;
  averageFinalTicketCents: number | null;
};
type Analysis = {
  year: number;
  years: number[];
  services: { id: string; name: string }[];
  totals: Summary & { ticketIncreaseCents: number | null; ticketIncreaseRate: number | null };
  byMonth: { month: number; extrasCents: number; upsellRate: number | null; sessions: number }[];
  byService: (Summary & { id: string; label: string })[];
  byCategory: { category: ExtraCategory | null; lines: number; quantity: number; valueCents: number; share: number | null }[];
  margin: { revenueCents: number; registeredCostCents: number; marginCents: number; marginRate: number | null; costCoverage: number | null };
};

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const percent = new Intl.NumberFormat("it-IT", { style: "percent", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const monthLabels = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

const formatRate = (value: number | null) => (value === null ? "—" : percent.format(value));
const formatCents = (value: number | null) => (value === null ? "—" : euro.format(value / 100));

export function ExtraAnalysis() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [year, setYear] = useState(searchParams.get("year") ?? "");
  const [serviceTypeId, setServiceTypeId] = useState(searchParams.get("serviceTypeId") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (year) params.set("year", year);
    if (serviceTypeId) params.set("serviceTypeId", serviceTypeId);
    if (category) params.set("category", category);
    return params.toString();
  }, [year, serviceTypeId, category]);

  useEffect(() => {
    router.replace(`/analisi/extra${query ? `?${query}` : ""}`, { scroll: false });
  }, [query, router]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/analytics/extras?${query}`);
        const body = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(body.error);
        setData(body as Analysis);
        setError(null);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Caricamento non riuscito.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [query]);

  const chart = useMemo(() => ({
    values: data?.byMonth.map((entry) => entry.extrasCents) ?? [],
    rates: data?.byMonth.map((entry) => entry.upsellRate) ?? [],
  }), [data]);

  const selectClass = "h-11 border border-[#cfc5b8] bg-white px-3";
  const categoryLabel = category ? EXTRA_CATEGORY_LABELS[category as ExtraCategory] : null;

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-[#d8d0c5] pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold sm:text-4xl">Extra &amp; Upsell</h1>
            <p className="mt-2 text-sm text-[#675f57]">Valori commerciali delle sessioni del periodo (annullate escluse), non incassi.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:flex">
            <label className="flex flex-col gap-2 text-sm font-medium">Anno
              <select className={selectClass} onChange={(event) => setYear(event.target.value)} value={year || String(data?.year ?? "")}>
                {(data?.years ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">Servizio
              <select className={selectClass} onChange={(event) => setServiceTypeId(event.target.value)} value={serviceTypeId}>
                <option value="">Tutti</option>
                {(data?.services ?? []).map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">Categoria extra
              <select className={selectClass} onChange={(event) => setCategory(event.target.value)} value={category}>
                <option value="">Tutte</option>
                {EXTRA_CATEGORIES.map((option) => <option key={option} value={option}>{EXTRA_CATEGORY_LABELS[option]}</option>)}
              </select>
            </label>
          </div>
        </header>

        {categoryLabel ? <p className="mt-5 border border-[#d8b7a5] bg-[#f1e3db] px-4 py-2 text-sm text-[#8a4f37]">Solo extra &quot;{categoryLabel}&quot;: sessioni con extra, valori e ticket finale considerano unicamente questa categoria.</p> : null}
        {error ? <p className="mt-6 text-sm text-[#a53e31]">{error}</p> : null}
        {loading && !data ? <p className="mt-6 text-sm text-[#675f57]">Caricamento analisi...</p> : null}

        {data ? (
          <div className={loading ? "opacity-60" : ""}>
            <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Metric hint="Sessioni del periodo, annullate escluse" label="Sessioni analizzate" value={String(data.totals.sessions)} />
              <Metric hint="Sessioni con almeno un extra di valore > 0" label="Sessioni con extra" value={String(data.totals.withExtras)} />
              <Metric hint="Sessioni con extra ÷ sessioni analizzate" label="Upsell rate" value={formatRate(data.totals.upsellRate)} />
              <Metric hint="Somma dei totali delle righe extra vendute" label="Valore extra totale" value={euro.format(data.totals.extrasCents / 100)} />
              <Metric hint="Valore extra totale ÷ sessioni analizzate" label="Extra medio per sessione" value={formatCents(data.totals.averageExtraPerSessionCents)} />
              <Metric hint="Valore extra totale ÷ sessioni con extra" label="Extra medio tra acquirenti" value={formatCents(data.totals.averageExtraPerBuyerCents)} />
            </div>

            <section className="mt-8 border border-[#d8d0c5] bg-white p-5">
              <h2 className="text-lg font-semibold">Ticket iniziale vs finale</h2>
              <p className="mt-1 text-sm text-[#675f57]">Iniziale = prezzo concordato. Finale = prezzo concordato + extra{categoryLabel ? ` "${categoryLabel}"` : ""}. Media sulle sessioni analizzate.</p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Metric hint="Media dei prezzi concordati" label="Ticket iniziale medio" value={formatCents(data.totals.averageInitialTicketCents)} />
                <Metric hint={categoryLabel ? `Media di prezzo concordato + solo extra "${categoryLabel}"` : "Media di prezzo concordato + extra"} label={categoryLabel ? `Ticket medio con ${categoryLabel}` : "Ticket finale medio"} value={formatCents(data.totals.averageFinalTicketCents)} />
                <Metric hint={categoryLabel ? "Contributo medio della sola categoria" : "Ticket finale − ticket iniziale"} label={categoryLabel ? `Incremento medio da ${categoryLabel}` : "Incremento medio"} value={formatCents(data.totals.ticketIncreaseCents)} />
                <Metric hint={categoryLabel ? "Incremento medio della categoria ÷ ticket iniziale" : "Ticket finale ÷ ticket iniziale − 1"} label={categoryLabel ? `Incremento % da ${categoryLabel}` : "Incremento %"} value={formatRate(data.totals.ticketIncreaseRate)} />
              </div>
            </section>

            <section className="mt-8 border border-[#d8d0c5] bg-white p-5">
              <h2 className="text-lg font-semibold">Andamento mensile {data.year}</h2>
              {data.totals.sessions === 0 ? <p className="py-10 text-center text-sm text-[#675f57]">Nessuna sessione nel periodo selezionato.</p> : (
                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#675f57]">Valore extra</h3>
                    <ExtraMonthlyChart kind="euro" labels={monthLabels} values={chart.values} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#675f57]">Upsell rate</h3>
                    <ExtraMonthlyChart kind="percent" labels={monthLabels} values={chart.rates} />
                  </div>
                </div>
              )}
            </section>

            <div className="mt-8">
              <DataTable
                columns={["Servizio", "Sessioni", "Con extra", "Upsell rate", "Extra totale", "Extra medio", categoryLabel ? `Ticket medio con ${categoryLabel}` : "Ticket finale medio"]}
                emptyLabel="Nessuna sessione."
                rows={data.byService.map((row) => [row.label, String(row.sessions), String(row.withExtras), formatRate(row.upsellRate), euro.format(row.extrasCents / 100), formatCents(row.averageExtraPerSessionCents), formatCents(row.averageFinalTicketCents)])}
                title="Per servizio"
              />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <DataTable
                columns={["Categoria", "Righe", "Quantità", "Valore", "% sul totale"]}
                emptyLabel="Nessun extra venduto."
                rows={data.byCategory.map((row) => [row.category ? EXTRA_CATEGORY_LABELS[row.category] : "Senza categoria", String(row.lines), String(row.quantity), euro.format(row.valueCents / 100), formatRate(row.share)])}
                title="Per categoria (al momento della vendita)"
              />

              <section className="border border-[#d8d0c5] bg-white">
                <p className="border-b border-[#d8d0c5] bg-[#eee8df] px-4 py-2 text-sm font-semibold">Margine diretto extra</p>
                <dl className="divide-y divide-[#eee8df] text-sm">
                  <MarginRow label="Ricavi extra" value={euro.format(data.margin.revenueCents / 100)} />
                  <MarginRow label="Costi diretti registrati" value={euro.format(data.margin.registeredCostCents / 100)} />
                  <MarginRow label="Margine diretto calcolato" value={euro.format(data.margin.marginCents / 100)} />
                  <MarginRow label="Margine %" value={formatRate(data.margin.marginRate)} />
                  <MarginRow label="Copertura costi" value={formatRate(data.margin.costCoverage)} />
                </dl>
                {data.margin.costCoverage !== null && data.margin.costCoverage < 1 ? (
                  <p className="border-t border-[#eee8df] px-4 py-3 text-xs text-[#8a4f37]">Margine calcolato sui costi registrati: le vendite senza costo indicato pesano come se il costo fosse zero, quindi il margine reale può essere più basso.</p>
                ) : null}
              </section>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="border border-[#d8d0c5] bg-white px-4 py-3" title={hint}>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-[#8a8178]">{hint}</p>
    </div>
  );
}

function MarginRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <dt>{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function DataTable({ title, columns, rows, emptyLabel }: { title: string; columns: string[]; rows: string[][]; emptyLabel: string }) {
  return (
    <div className="overflow-x-auto border border-[#d8d0c5] bg-white">
      <p className="border-b border-[#d8d0c5] bg-[#eee8df] px-4 py-2 text-sm font-semibold">{title}</p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-xs font-semibold uppercase tracking-[0.06em] text-[#675f57]">
            {columns.map((column, index) => <th className={`px-4 py-2 ${index === 0 ? "text-left" : "text-right"}`} key={column}>{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td className="px-4 py-3 text-sm text-[#675f57]" colSpan={columns.length}>{emptyLabel}</td></tr>
          ) : rows.map((row) => (
            <tr className="border-t border-[#eee8df]" key={row[0]}>
              {row.map((cell, index) => <td className={`px-4 py-2 ${index === 0 ? "" : "text-right font-medium"}`} key={`${row[0]}-${columns[index]}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
