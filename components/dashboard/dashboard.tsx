"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IncomeTrendChart } from "@/components/dashboard/income-trend-chart";
import { BudgetGaugeChart } from "@/components/dashboard/budget-gauge-chart";

type Upcoming = { id: string; scheduled_at: string; service_name: string; client: { first_name: string; last_name: string } | null; stage: string; status: string };
type Dashboard = {
  upcoming: Upcoming[];
  receivable: number;
  paymentStatus: { unpaid: number; partial: number; settled: number };
  income: { total: number; byMethod: Record<string, number> };
  vouchers: { sold: number; active: number; redeemed: number; expired: number; expiringSoon: number; activeValue: number };
};

type AnalyticsEntry = { label: string; total_cents: number };
type MonthEntry = { month: number; label: string; total_cents: number };
type Analytics = {
  year: number;
  years: number[];
  total: number;
  byMonth: MonthEntry[];
  byServiceType: AnalyticsEntry[];
  byMethod: AnalyticsEntry[];
  cumulative: MonthEntry[];
};

const dateTime = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" });
const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const periods = [
  { value: "month", label: "Questo mese" },
  { value: "last30", label: "Ultimi 30 giorni" },
  { value: "year", label: "Quest'anno" },
  { value: "all", label: "Sempre" },
];

export function Dashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsYear, setAnalyticsYear] = useState<number | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [budgetProgress, setBudgetProgress] = useState<{ achieved: number; budget: number } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/dashboard?period=${period}`);
        const body = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(body.error);
        setData(body as Dashboard);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Caricamento non riuscito.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [period]);

  useEffect(() => {
    let active = true;
    (async () => {
      setAnalyticsLoading(true);
      try {
        const response = await fetch(`/api/dashboard/analytics${analyticsYear ? `?year=${analyticsYear}` : ""}`);
        const body = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(body.error);
        setAnalytics(body as Analytics);
        if (!analyticsYear) setAnalyticsYear(body.year);
      } catch {
        if (active) setAnalytics(null);
      } finally {
        if (active) setAnalyticsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [analyticsYear]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/dashboard/analytics?year=${new Date().getFullYear()}`);
        const body = await response.json();
        if (!active) return;
        if (response.ok) setBudgetProgress({ achieved: body.total, budget: body.annualBudgetCents });
      } catch {
        if (active) setBudgetProgress(null);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-[#d8d0c5] pb-7 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold sm:text-4xl">Dashboard</h1>
            <p className="mt-2 text-sm text-[#675f57]">Riepilogo operativo e finanziario.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link className="grid h-11 place-items-center bg-[#9b5d43] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#7f4934]" href="/clients?new=1">Nuovo cliente</Link>
              <Link className="grid h-11 place-items-center bg-[#9b5d43] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#7f4934]" href="/sessions?new=1">Crea sessione</Link>
              <Link className="grid h-11 place-items-center bg-[#9b5d43] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#7f4934]" href="/payments?new=1">Registra pagamento</Link>
              <Link className="grid h-11 place-items-center bg-[#9b5d43] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#7f4934]" href="/vouchers?new=1">Nuovo buono regalo</Link>
            </div>
          </div>
          {budgetProgress ? (
            <div className="w-full border border-[#d8d0c5] bg-white p-4 sm:w-64">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">Budget {new Date().getFullYear()}</p>
              <BudgetGaugeChart achievedCents={budgetProgress.achieved} budgetCents={budgetProgress.budget} />
              <p className="-mt-2 text-center text-xs text-[#675f57]">{euro.format(budgetProgress.achieved / 100)} di {euro.format(budgetProgress.budget / 100)}</p>
            </div>
          ) : null}
        </header>

        {loading ? <p className="mt-8 text-sm text-[#675f57]">Caricamento dashboard...</p> : error ? <p className="mt-8 text-sm text-[#a53e31]">{error}</p> : data ? (
          <>
            <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Da incassare" value={euro.format(data.receivable / 100)} />
              <Metric label="Sessioni da saldare" value={String(data.paymentStatus.unpaid)} />
              <Metric label="Parzialmente pagate" value={String(data.paymentStatus.partial)} />
              <Metric label="Sessioni saldate" value={String(data.paymentStatus.settled)} />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <section className="border border-[#d8d0c5] bg-white p-5">
                <h2 className="text-lg font-semibold">Prossime sessioni</h2>
                <div className="mt-4 divide-y divide-[#eee8df]">
                  {data.upcoming.length === 0 ? <p className="py-4 text-sm text-[#675f57]">Nessuna sessione in programma.</p> : data.upcoming.map((session) => (
                    <Link className="flex items-center justify-between gap-4 py-3 hover:underline" href={`/sessions/${session.id}`} key={session.id}>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{dateTime.format(new Date(session.scheduled_at))}</p>
                        <p className="mt-1 text-xs text-[#675f57]">{session.client ? `${session.client.first_name} ${session.client.last_name}` : "-"} - {session.service_name} - {session.stage}</p>
                      </div>
                      <span className="text-xs font-medium">{session.status}</span>
                    </Link>
                  ))}
                </div>
              </section>

              <section className="border border-[#d8d0c5] bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Incassi</h2>
                  <select className="h-9 border border-[#cfc5b8] bg-white px-2 text-sm" onChange={(e) => setPeriod(e.target.value)} value={period}>
                    {periods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <p className="mt-4 text-3xl font-semibold">{euro.format(data.income.total / 100)}</p>
                <div className="mt-4 space-y-2">
                  {Object.keys(data.income.byMethod).length === 0 ? <p className="text-sm text-[#675f57]">Nessun incasso nel periodo.</p> : Object.entries(data.income.byMethod).map(([method, amount]) => (
                    <div className="flex items-center justify-between text-sm" key={method}>
                      <span>{method}</span>
                      <span className="font-medium">{euro.format(amount / 100)}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="mt-8 border border-[#d8d0c5] bg-white p-5">
              <h2 className="text-lg font-semibold">Buoni regalo</h2>
              <div className="mt-4 grid gap-5 sm:grid-cols-3 lg:grid-cols-6">
                <Metric label="Venduti" value={String(data.vouchers.sold)} small />
                <Metric label="Attivi" value={String(data.vouchers.active)} small />
                <Metric label="Riscattati" value={String(data.vouchers.redeemed)} small />
                <Metric label="Scaduti" value={String(data.vouchers.expired)} small />
                <Metric label="Scad. 30gg" value={String(data.vouchers.expiringSoon)} small />
                <Metric label="Valore attivo" value={euro.format(data.vouchers.activeValue / 100)} small />
              </div>
            </section>
          </>
        ) : null}

        <section className="mt-8 border border-[#d8d0c5] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Analisi incassi</h2>
            {analytics ? (
              <label className="flex items-center gap-2 text-sm font-medium">
                Anno
                <select
                  className="h-9 border border-[#cfc5b8] bg-white px-2 text-sm"
                  onChange={(event) => setAnalyticsYear(Number(event.target.value))}
                  value={analyticsYear ?? analytics.year}
                >
                  {analytics.years.map((yearOption) => (
                    <option key={yearOption} value={yearOption}>{yearOption}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {analyticsLoading ? (
            <p className="mt-4 text-sm text-[#675f57]">Caricamento analisi...</p>
          ) : !analytics ? (
            <p className="mt-4 text-sm text-[#a53e31]">Non e stato possibile caricare le analisi.</p>
          ) : (
            <>
              <p className="mt-4 text-sm text-[#675f57]">Totale incassato nel {analytics.year}: <span className="font-semibold text-[#27231f]">{euro.format(analytics.total / 100)}</span></p>

              <div className="mt-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#675f57]">Andamento progressivo</h3>
                <div className="mt-3">
                  <IncomeTrendChart
                    labels={analytics.cumulative.map((entry) => entry.label)}
                    values={analytics.cumulative.map((entry) => entry.total_cents)}
                  />
                </div>
              </div>

              <div className="mt-8 grid gap-6 lg:grid-cols-3">
                <AnalyticsTable
                  columnLabel="Mese"
                  rows={analytics.byMonth.map((entry) => ({ label: entry.label, total_cents: entry.total_cents }))}
                  title="Incassi per mese"
                />
                <AnalyticsTable
                  columnLabel="Tipo sessione"
                  rows={analytics.byServiceType}
                  title="Incassi per tipo di sessione"
                />
                <AnalyticsTable
                  columnLabel="Metodo"
                  rows={analytics.byMethod}
                  title="Incassi per metodo"
                />
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="border border-[#d8d0c5] bg-white px-4 py-3">
      <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">{label}</p>
      <p className={`mt-1 font-semibold ${small ? "text-xl" : "text-2xl"}`}>{value}</p>
    </div>
  );
}

function AnalyticsTable({ title, columnLabel, rows }: { title: string; columnLabel: string; rows: { label: string; total_cents: number }[] }) {
  const total = rows.reduce((sum, row) => sum + row.total_cents, 0);
  return (
    <div className="border border-[#d8d0c5]">
      <p className="border-b border-[#d8d0c5] bg-[#eee8df] px-4 py-2 text-sm font-semibold">{title}</p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-xs font-semibold uppercase tracking-[0.06em] text-[#675f57]">
            <th className="px-4 py-2 text-left">{columnLabel}</th>
            <th className="px-4 py-2 text-right">Incasso</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td className="px-4 py-3 text-sm text-[#675f57]" colSpan={2}>Nessun dato.</td></tr>
          ) : rows.map((row) => (
            <tr className="border-t border-[#eee8df]" key={row.label}>
              <td className="px-4 py-2">{row.label}</td>
              <td className="px-4 py-2 text-right font-medium">{euro.format(row.total_cents / 100)}</td>
            </tr>
          ))}
        </tbody>
        {rows.length > 0 ? (
          <tfoot>
            <tr className="border-t border-[#d8d0c5] bg-[#fbf7f2] font-semibold">
              <td className="px-4 py-2">Totale</td>
              <td className="px-4 py-2 text-right">{euro.format(total / 100)}</td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
