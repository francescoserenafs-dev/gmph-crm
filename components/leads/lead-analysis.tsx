"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LeadMonthlyChart } from "@/components/leads/lead-monthly-chart";
import { LEAD_LOST_REASON_LABELS, LEAD_SOURCE_LABELS, type LeadLostReason, type LeadSource } from "@/lib/leads";

type Rates = { leads: number; booked: number; bookedValueCents: number; conversionRate: number | null; averageTicketCents: number | null };
type Analysis = {
  year: number;
  years: number[];
  services: { id: string; name: string }[];
  totals: Rates;
  byMonth: { month: number; leads: number; booked: number }[];
  byService: (Rates & { id: string; label: string })[];
  bySource: (Rates & { source: LeadSource })[];
  lostReasons: { reason: LeadLostReason; count: number; share: number | null }[];
  lostTotal: number;
};

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const percent = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 1 });
const monthLabels = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

const formatRate = (value: number | null) => (value === null ? "—" : percent.format(value));
const formatCents = (value: number | null) => (value === null ? "—" : euro.format(value / 100));

export function LeadAnalysis() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [year, setYear] = useState(searchParams.get("year") ?? "");
  const [serviceTypeId, setServiceTypeId] = useState(searchParams.get("serviceTypeId") ?? "");
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (year) params.set("year", year);
    if (serviceTypeId) params.set("serviceTypeId", serviceTypeId);
    return params.toString();
  }, [year, serviceTypeId]);

  useEffect(() => {
    router.replace(`/leads/analisi${query ? `?${query}` : ""}`, { scroll: false });
  }, [query, router]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/leads/analytics?${query}`);
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
    leads: data?.byMonth.map((entry) => entry.leads) ?? [],
    booked: data?.byMonth.map((entry) => entry.booked) ?? [],
  }), [data]);

  const selectClass = "h-11 border border-[#cfc5b8] bg-white px-3";

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-[#d8d0c5] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold sm:text-4xl">Analisi Lead</h1>
            <p className="mt-2 text-sm text-[#675f57]">Lead per anno di ingresso: le prenotazioni contano nella coorte anche se avvenute dopo.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:flex">
            <label className="flex flex-col gap-2 text-sm font-medium">Anno di ingresso
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
          </div>
        </header>

        {error ? <p className="mt-6 text-sm text-[#a53e31]">{error}</p> : null}
        {loading && !data ? <p className="mt-6 text-sm text-[#675f57]">Caricamento analisi...</p> : null}

        {data ? (
          <div className={loading ? "opacity-60" : ""}>
            <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="Lead ricevuti" value={String(data.totals.leads)} />
              <Metric label="Prenotazioni" value={String(data.totals.booked)} />
              <Metric label="Conversion rate" value={formatRate(data.totals.conversionRate)} />
              <Metric label="Valore prenotato" value={euro.format(data.totals.bookedValueCents / 100)} />
              <Metric label="Ticket medio" value={formatCents(data.totals.averageTicketCents)} />
            </div>

            <section className="mt-8 border border-[#d8d0c5] bg-white p-5">
              <h2 className="text-lg font-semibold">Andamento mensile {data.year}</h2>
              <p className="mt-1 text-sm text-[#675f57]">Lead entrati nel mese e quanti di loro risultano prenotati.</p>
              <div className="mt-4">
                {data.totals.leads === 0 ? <p className="py-10 text-center text-sm text-[#675f57]">Nessun lead nel periodo selezionato.</p> : <LeadMonthlyChart booked={chart.booked} labels={monthLabels} leads={chart.leads} />}
              </div>
            </section>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <DataTable
                columns={["Servizio", "Lead", "Prenotazioni", "Conversione", "Valore prenotato"]}
                emptyLabel="Nessun lead."
                rows={data.byService.map((row) => [row.label, String(row.leads), String(row.booked), formatRate(row.conversionRate), euro.format(row.bookedValueCents / 100)])}
                title="Per servizio"
              />
              <DataTable
                columns={["Origine", "Lead", "Prenotazioni", "Conversione"]}
                emptyLabel="Nessun lead."
                rows={data.totals.leads === 0 ? [] : data.bySource.map((row) => [LEAD_SOURCE_LABELS[row.source], String(row.leads), String(row.booked), formatRate(row.conversionRate)])}
                title="Per origine"
              />
              <DataTable
                columns={["Motivo", "Numero", "% sui persi"]}
                emptyLabel="Nessun lead perso."
                rows={data.lostTotal === 0 ? [] : data.lostReasons.map((row) => [LEAD_LOST_REASON_LABELS[row.reason], String(row.count), formatRate(row.share)])}
                title={`Motivi di perdita${data.lostTotal > 0 ? ` (${data.lostTotal} persi)` : ""}`}
              />
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#d8d0c5] bg-white px-4 py-3">
      <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
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
