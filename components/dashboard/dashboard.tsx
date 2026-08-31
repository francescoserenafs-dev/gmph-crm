"use client";

import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BudgetGaugeChart } from "@/components/dashboard/budget-gauge-chart";
import { IncomeTrendChart } from "@/components/dashboard/income-trend-chart";

type Dashboard = {
  calendar: {
    id: string;
    scheduled_at: string;
    service_name: string;
    client: { id: string; first_name: string; last_name: string } | null;
    stage: string;
    status: string;
  }[];
  receivable: number;
  paymentStatus: { unpaid: number; partial: number; settled: number };
  sessionsTotalValue: number;
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

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const dateOnly = new Intl.DateTimeFormat("it-IT", { dateStyle: "long" });
const timeOnly = new Intl.DateTimeFormat("it-IT", { timeStyle: "short" });
const weekDays = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const periods = [
  { value: "month", label: "Questo mese" },
  { value: "last30", label: "Ultimi 30 giorni" },
  { value: "year", label: "Quest'anno" },
  { value: "all", label: "Sempre" },
];

function localDayKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function Dashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsYear, setAnalyticsYear] = useState<number | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [budgetProgress, setBudgetProgress] = useState<{ achieved: number; budget: number } | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);

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
        if (active && response.ok) {
          setBudgetProgress({ achieved: body.total, budget: body.annualBudgetCents });
        }
      } catch {
        if (active) setBudgetProgress(null);
      }
    })();
    return () => { active = false; };
  }, []);

  const calendarByDay = useMemo(() => {
    const calendar = new Map<string, number>();
    for (const session of data?.calendar ?? []) {
      const day = localDayKey(session.scheduled_at);
      calendar.set(day, (calendar.get(day) ?? 0) + 1);
    }
    return calendar;
  }, [data]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(calendarMonth.year, calendarMonth.month, 1);
    const firstDayOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(calendarMonth.year, calendarMonth.month + 1, 0).getDate();
    return [
      ...Array.from({ length: firstDayOffset }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [calendarMonth]);

  const selectedCalendarSessions = useMemo(
    () => (data?.calendar ?? []).filter((session) => localDayKey(session.scheduled_at) === selectedCalendarDay),
    [data, selectedCalendarDay],
  );

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-6xl">
        {loading ? <p className="mt-8 text-sm text-[#675f57]">Caricamento dashboard...</p> : error ? <p className="mt-8 text-sm text-[#a53e31]">{error}</p> : data ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="Valore sessioni" value={euro.format(data.sessionsTotalValue / 100)} />
              <Metric label="Da incassare" value={euro.format(data.receivable / 100)} />
              <Metric label="Sessioni da saldare" value={String(data.paymentStatus.unpaid)} />
              <Metric label="Parzialmente pagate" value={String(data.paymentStatus.partial)} />
              <Metric label="Sessioni saldate" value={String(data.paymentStatus.settled)} />
            </div>

            <div className="mt-8 flex flex-col items-start gap-6 lg:flex-row">
              <section className="flex aspect-square w-full max-w-[420px] flex-col border border-[#d8d0c5] bg-white p-3 sm:p-5">
                {selectedCalendarDay ? (
                  <div className="dashboard-calendar-detail flex min-h-0 flex-1 flex-col">
                    <div className="flex items-center gap-3">
                      <button aria-label="Torna al calendario" className="grid size-8 place-items-center border border-[#cfc5b8] hover:bg-[#eee8df]" onClick={() => setSelectedCalendarDay(null)} title="Torna al calendario" type="button">
                        <ArrowLeft className="size-4" />
                      </button>
                      <h2 className="text-lg font-semibold">{dateOnly.format(new Date(`${selectedCalendarDay}T00:00:00`))}</h2>
                    </div>
                    <div className="mt-4 min-h-0 flex-1 overflow-y-auto divide-y divide-[#eee8df]">
                      {selectedCalendarSessions.map((session) => (
                        <Link className="block py-3 hover:bg-[#f5f1eb]" href={`/sessions/${session.id}`} key={session.id}>
                          <p className="text-sm font-semibold">{timeOnly.format(new Date(session.scheduled_at))} - {session.service_name}</p>
                          <p className="mt-1 text-xs text-[#675f57]">{session.client ? `${session.client.first_name} ${session.client.last_name}` : "-"} - {session.stage} - {session.status}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <button aria-label="Mese precedente" className="grid size-8 place-items-center border border-[#cfc5b8] hover:bg-[#eee8df]" onClick={() => setCalendarMonth(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 })} title="Mese precedente" type="button">
                        <ChevronLeft className="size-4" />
                      </button>
                      <h2 className="text-lg font-semibold">{monthNames[calendarMonth.month]} {calendarMonth.year}</h2>
                      <button aria-label="Mese successivo" className="grid size-8 place-items-center border border-[#cfc5b8] hover:bg-[#eee8df]" onClick={() => setCalendarMonth(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 })} title="Mese successivo" type="button">
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                    <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[#675f57]">
                      {weekDays.map((day) => <span key={day}>{day}</span>)}
                    </div>
                    <div className="mt-1 grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-1">
                      {calendarCells.map((day, index) => {
                        if (!day) return <span key={`empty-${index}`} />;
                        const dayKey = `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const count = calendarByDay.get(dayKey) ?? 0;
                        const className = "flex min-h-0 flex-col items-center justify-center border text-xs transition-colors";
                        return count > 0 ? (
                          <button aria-label={`Mostra ${count} sessioni del ${day}`} className={`${className} border-[#9b5d43] bg-[#f1e3db] hover:bg-[#ead8ce]`} key={dayKey} onClick={() => setSelectedCalendarDay(dayKey)} type="button">
                            <span>{day}</span><span className="mt-1 font-semibold">{count}</span>
                          </button>
                        ) : <span className={`${className} border-[#eee8df]`} key={dayKey}>{day}</span>;
                      })}
                    </div>
                  </>
                )}
              </section>

              <div className="flex w-full max-w-[320px] flex-col gap-4 lg:h-[420px]">
                {budgetProgress ? (
                  <section className="flex min-h-0 flex-1 flex-col border border-[#d8d0c5] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">Budget {new Date().getFullYear()}</p>
                    <BudgetGaugeChart achievedCents={budgetProgress.achieved} budgetCents={budgetProgress.budget} />
                    <p className="mt-1 text-center text-xs text-[#675f57]">{euro.format(budgetProgress.achieved / 100)} di {euro.format(budgetProgress.budget / 100)}</p>
                  </section>
                ) : null}
                <section className="min-h-0 flex-1 border border-[#d8d0c5] bg-white p-4">
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

              <section className="flex w-full max-w-[360px] flex-col border border-[#d8d0c5] bg-white p-4 lg:h-[420px]">
                <h2 className="text-lg font-semibold">Buoni regalo</h2>
                <div className="mt-4 grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-3">
                  <Metric centered label="Venduti" value={String(data.vouchers.sold)} small />
                  <Metric centered label="Attivi" value={String(data.vouchers.active)} small />
                  <Metric centered label="Riscattati" value={String(data.vouchers.redeemed)} small />
                  <Metric centered label="Scaduti" value={String(data.vouchers.expired)} small />
                  <Metric centered label="Scad. 30gg" value={String(data.vouchers.expiringSoon)} small />
                  <Metric centered label="Valore attivo" value={euro.format(data.vouchers.activeValue / 100)} small />
                </div>
              </section>
            </div>
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

function Metric({ label, value, small = false, centered = false }: { label: string; value: string; small?: boolean; centered?: boolean }) {
  return (
    <div className={`border border-[#d8d0c5] bg-white px-4 py-3 ${centered ? "flex flex-col" : ""}`}>
      <p className={`${centered ? "text-center" : "whitespace-nowrap"} text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]`}>{label}</p>
      <p className={`${centered ? "flex flex-1 items-center justify-center text-center" : "mt-1"} font-semibold ${small ? "text-xl" : "text-2xl"}`}>{value}</p>
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
