"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RetentionMonthlyChart } from "@/components/clients/retention-monthly-chart";
import { InfoTooltip } from "@/components/shared/info-tooltip";

type Analysis = {
  year: number;
  years: number[];
  reactivationMonths: number;
  services: { id: string; name: string }[];
  totals: {
    servedClients: number;
    newClients: number;
    returningClients: number;
    repeatClientRate: number | null;
    averageSessionsPerClient: number | null;
    averageCommercialValuePerClientCents: number | null;
    futureReturningClients: number;
  };
  byMonth: { month: number; newClients: number; returningClients: number }[];
  secondServiceMedianMonths: number | null;
  secondServiceAverageMonths: number | null;
  customerValue: {
    oneSession: { clients: number; averageCents: number | null };
    returning: { clients: number; averageCents: number | null };
  };
  journeys: { fromId: string; fromName: string; toId: string; toName: string; clients: number }[];
  reactivationRows: {
    clientId: string;
    clientName: string;
    lastSessionAt: string;
    lastServiceName: string;
    monthsSinceLastSession: number;
    sessions: number;
    cumulativeValueCents: number;
  }[];
};

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const percent = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 1 });
const monthLabels = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const thresholds = [6, 12, 18, 24];
const formatMoney = (cents: number | null) => cents === null ? "—" : euro.format(cents / 100);
const formatCount = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(value);

const KPI_HINTS = {
  servedClients: "Numero di clienti distinti con almeno una sessione fotografica valida nel periodo selezionato. Le prenotazioni future non sono incluse.",
  newClients: "Clienti la cui prima sessione valida nel CRM ricade nel periodo selezionato. Se tornano nello stesso periodo, risultano anche tra i clienti di ritorno. Se lo storico CRM è incompleto, il numero può sovrastimare i nuovi clienti reali.",
  returningClients: "Numero di clienti che, nel periodo selezionato, hanno effettuato una sessione che non era la loro prima sessione valida. Le sessioni successive al periodo non rendono retroattivamente un cliente \"di ritorno\".",
  repeatRate: "Percentuale dei clienti serviti nel periodo che, considerando tutta la storia disponibile nel CRM, hanno effettuato almeno due sessioni valide. Può quindi includere ritorni avvenuti dopo il periodo selezionato.",
  sessionsPerClient: "Sessioni fotografiche valide svolte nel periodo ÷ clienti distinti serviti nel periodo.",
  valuePerClient: "Valore commerciale delle sessioni valide svolte nel periodo, prezzo concordato più extra, ÷ clienti distinti. Non rappresenta necessariamente l'incassato.",
};

export function ClientRetentionAnalysis() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [year, setYear] = useState(searchParams.get("year") ?? "");
  const [initialServiceId, setInitialServiceId] = useState(searchParams.get("initialServiceId") ?? "");
  const [nextServiceId, setNextServiceId] = useState(searchParams.get("nextServiceId") ?? "");
  const [reactivationMonths, setReactivationMonths] = useState(searchParams.get("reactivationMonths") ?? "6");
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (year) params.set("year", year);
    if (initialServiceId) params.set("initialServiceId", initialServiceId);
    if (nextServiceId) params.set("nextServiceId", nextServiceId);
    if (reactivationMonths !== "6") params.set("reactivationMonths", reactivationMonths);
    return params.toString();
  }, [year, initialServiceId, nextServiceId, reactivationMonths]);

  useEffect(() => {
    router.replace(`/analisi/clienti-retention${query ? `?${query}` : ""}`, { scroll: false });
  }, [query, router]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/analytics/retention${query ? `?${query}` : ""}`);
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
    newClients: data?.byMonth.map((entry) => entry.newClients) ?? [],
    returningClients: data?.byMonth.map((entry) => entry.returningClients) ?? [],
  }), [data]);

  const selectClass = "h-11 border border-[#cfc5b8] bg-white px-3";
  const noServedClients = !data || data.totals.servedClients === 0;

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-[#d8d0c5] pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold sm:text-4xl">Clienti &amp; Retention</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#675f57]">Sessioni valide svolte nell&apos;anno selezionato. Le prenotazioni future sono mostrate separatamente.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:flex">
            <label className="flex flex-col gap-2 text-sm font-medium">Anno
              <select className={selectClass} onChange={(event) => setYear(event.target.value)} value={year || String(data?.year ?? "")}>
                {(data?.years ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">Servizio iniziale
              <select className={selectClass} onChange={(event) => setInitialServiceId(event.target.value)} value={initialServiceId}>
                <option value="">Tutti</option>
                {(data?.services ?? []).map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">Servizio successivo
              <select className={selectClass} onChange={(event) => setNextServiceId(event.target.value)} value={nextServiceId}>
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
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Metric hint={KPI_HINTS.servedClients} label="Clienti serviti" value={String(data.totals.servedClients)} />
              <Metric hint={KPI_HINTS.newClients} label="Nuovi clienti" value={String(data.totals.newClients)} />
              <Metric hint={KPI_HINTS.returningClients} label="Clienti di ritorno" value={String(data.totals.returningClients)} />
              <Metric hint={KPI_HINTS.repeatRate} label="Repeat Client Rate" value={data.totals.repeatClientRate === null ? "—" : percent.format(data.totals.repeatClientRate)} />
              <Metric hint={KPI_HINTS.sessionsPerClient} label="Sessioni medie per cliente" value={formatCount(data.totals.averageSessionsPerClient)} />
              <Metric hint={KPI_HINTS.valuePerClient} label="Valore medio cliente" value={formatMoney(data.totals.averageCommercialValuePerClientCents)} />
            </div>

            <section className="mt-8 border border-[#d8d0c5] bg-white p-5">
              <h2 className="text-lg font-semibold">Nuovi vs ritorno nel tempo</h2>
              <p className="mt-1 text-sm text-[#675f57]">Clienti distinti per mese; chi debutta e torna nello stesso mese è conteggiato come nuovo in quel mese.</p>
              {data.totals.servedClients === 0 ? <EmptyState>Non ci sono sessioni valide nell&apos;anno selezionato.</EmptyState> : (
                <div className="mt-4"><RetentionMonthlyChart labels={monthLabels} newClients={chart.newClients} returningClients={chart.returningClients} /></div>
              )}
            </section>

            <section className="mt-8 border border-[#d8d0c5] bg-white p-5">
              <h2 className="text-lg font-semibold">Tempo al secondo servizio</h2>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <Metric hint="Tempo mediano trascorso tra la prima e la seconda sessione valida dei clienti che sono tornati. Mesi calcolati sui giorni effettivi, usando 30,44 giorni per mese." label="Mediana mesi al secondo servizio" value={formatCount(data.secondServiceMedianMonths)} />
                <Metric hint="Media del tempo tra prima e seconda sessione valida; può essere influenzata da intervalli molto lunghi." label="Media mesi al secondo servizio" value={formatCount(data.secondServiceAverageMonths)} />
              </div>
            </section>

            <section className="mt-8 border border-[#d8d0c5] bg-white p-5">
              <h2 className="text-lg font-semibold">Valore cumulato cliente</h2>
              <p className="mt-1 text-sm text-[#675f57]">Clienti serviti nel {data.year}; valori calcolati su tutta la storia svolta disponibile per ciascun cliente, prezzo concordato più extra. Non è LTV predittivo.</p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <ValueComparison
                  count={data.customerValue.oneSession.clients}
                  label="Cliente con 1 sola sessione"
                  value={formatMoney(data.customerValue.oneSession.averageCents)}
                />
                <ValueComparison
                  count={data.customerValue.returning.clients}
                  label="Cliente returning"
                  value={formatMoney(data.customerValue.returning.averageCents)}
                />
              </div>
            </section>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <DataTable
                columns={["Servizio precedente", "Servizio successivo", "Clienti"]}
                emptyLabel="Nessun percorso nel periodo e con i filtri selezionati."
                rows={data.journeys.map((row) => [row.fromName, row.toName, String(row.clients)])}
                title="Percorsi servizi (intera storia disponibile)"
              />
              <section className="border border-[#d8d0c5] bg-white">
                <p className="border-b border-[#d8d0c5] bg-[#eee8df] px-4 py-2 text-sm font-semibold">Ritorni già prenotati</p>
                <p className="px-4 py-4 text-3xl font-semibold">{data.totals.futureReturningClients}</p>
                <p className="border-t border-[#eee8df] px-4 py-3 text-xs text-[#675f57]">Clienti con almeno una sessione valida già svolta e una sessione futura non annullata. Non contribuiscono al Repeat Client Rate.</p>
              </section>
            </div>

            <section className="mt-8 border border-[#d8d0c5] bg-white">
              <div className="flex flex-col gap-3 border-b border-[#d8d0c5] bg-[#eee8df] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Clienti potenzialmente da riattivare</h2>
                  <p className="mt-1 text-xs text-[#675f57]">Escluse le persone con una sessione futura già prenotata; vista informativa, senza automazioni.</p>
                </div>
                <div aria-label="Mesi dall'ultima sessione" className="flex flex-wrap gap-1" role="group">
                  {thresholds.map((months) => (
                    <button
                      aria-pressed={Number(reactivationMonths) === months}
                      className={`border px-3 py-2 text-xs font-semibold ${Number(reactivationMonths) === months ? "border-[#9b5d43] bg-[#9b5d43] text-white" : "border-[#cfc5b8] bg-white text-[#675f57] hover:border-[#9b5d43]"}`}
                      key={months}
                      onClick={() => setReactivationMonths(String(months))}
                      type="button"
                    >
                      {months}+ mesi
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead><tr className="text-left text-xs font-semibold uppercase text-[#675f57]">
                    {["Cliente", "Ultima sessione", "Ultimo servizio", "Mesi trascorsi", "Sessioni totali", "Valore cumulato"].map((column) => <th className="px-4 py-3" key={column}>{column}</th>)}
                  </tr></thead>
                  <tbody>
                    {data.reactivationRows.length === 0 ? <tr><td className="border-t border-[#eee8df] px-4 py-4 text-sm text-[#675f57]" colSpan={6}>Nessun cliente oltre la soglia selezionata.</td></tr> : data.reactivationRows.map((row) => (
                      <tr className="border-t border-[#eee8df]" key={row.clientId}>
                        <td className="px-4 py-3 font-medium"><Link className="underline decoration-[#cfc5b8] underline-offset-2 hover:text-[#9b5d43]" href={`/clients/${row.clientId}`}>{row.clientName}</Link></td>
                        <td className="whitespace-nowrap px-4 py-3">{formatDate(row.lastSessionAt)}</td>
                        <td className="px-4 py-3">{row.lastServiceName}</td>
                        <td className="px-4 py-3">{row.monthsSinceLastSession}</td>
                        <td className="px-4 py-3">{row.sessions}</td>
                        <td className="whitespace-nowrap px-4 py-3">{euro.format(row.cumulativeValueCents / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {noServedClients ? <p className="mt-4 text-xs text-[#675f57]">Valori e tassi non disponibili quando il periodo non contiene clienti serviti.</p> : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="border border-[#d8d0c5] bg-white px-4 py-3">
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">{label}</p>
        <InfoTooltip label={`Informazioni su ${label}`} text={hint} />
      </div>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ValueComparison({ label, value, count }: { label: string; value: string; count: number }) {
  return (
    <div className="border border-[#e4ddd4] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-[#8a8178]">{count} {count === 1 ? "cliente" : "clienti"} nel confronto</p>
    </div>
  );
}

function DataTable({ title, columns, rows, emptyLabel }: { title: string; columns: string[]; rows: string[][]; emptyLabel: string }) {
  return (
    <div className="overflow-x-auto border border-[#d8d0c5] bg-white">
      <p className="border-b border-[#d8d0c5] bg-[#eee8df] px-4 py-2 text-sm font-semibold">{title}</p>
      <table className="w-full border-collapse text-sm">
        <thead><tr className="text-xs font-semibold uppercase tracking-[0.06em] text-[#675f57]">
          {columns.map((column, index) => <th className={`px-4 py-2 ${index === 0 ? "text-left" : "text-right"}`} key={column}>{column}</th>)}
        </tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td className="px-4 py-3 text-sm text-[#675f57]" colSpan={columns.length}>{emptyLabel}</td></tr> : rows.map((row) => (
            <tr className="border-t border-[#eee8df]" key={`${row[0]}-${row[1]}`}>
              {row.map((cell, index) => <td className={`px-4 py-2 ${index === 0 ? "" : "text-right font-medium"}`} key={`${row[0]}-${columns[index]}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return <p className="py-10 text-center text-sm text-[#675f57]">{children}</p>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeZone: "Europe/Rome" }).format(new Date(value));
}