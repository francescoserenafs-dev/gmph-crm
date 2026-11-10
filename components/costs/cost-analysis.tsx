"use client";

import { type ReactNode } from "react";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { formatMoney as money, formatPercent as rate } from "@/lib/money";
import type { CostAnalytics } from "@/lib/expenses";

export function CostAnalysis({ data }: { data: CostAnalytics }) {
  const partial = data.directCostsMissingItems > 0;
  const resultLabel = partial ? " (parziale)" : "";
  const maxMonthly = Math.max(1, ...data.monthlyCosts.map((row) => row.totalPaidCents));
  return (
    <section className="mt-8 min-w-0 border-t border-[#d8d0c5] pt-6" aria-label={`Costi e risultati ${data.year}`}>
      <h2 className="flex items-center gap-2 text-xl font-semibold">Costi e risultati {data.year}<InfoTooltip text="Indicatori gestionali, non contabili o fiscali. Servizi e costi diretti per data sessione; uscite per data di pagamento, IVA compresa. I costi annuali restano nel mese del pagamento. Nessuna deducibilita applicata." /></h2>
      {partial ? <p className="mt-4 border border-[#e6c98f] bg-[#fbf3e0] p-3 text-sm text-[#7a5a17]" role="status">Margine parziale: {data.directCostsMissingItems} voci senza costo storico su {data.directCostItems}. I risultati sottraggono solo i costi noti.</p> : null}
      <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 border-b border-[#d8d0c5] pb-6 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Costi operativi pagati" value={money(data.operatingCostsCents)} hint="Movimenti operativi nell'anno, imponibile + IVA. Nessuna ripartizione tra servizi." />
        <Metric label="Imposte e contributi" value={money(data.taxContributionCostsCents)} hint="Uscite registrate in questa categoria, separate dai costi operativi. Nessuna stima automatica." />
        <Metric label="Costi diretti noti" value={money(data.directCostsKnownCents)} hint="Extra venduti e inclusioni del pacchetto: quantita per costo unitario storico delle sessioni gia svolte. Non sono nuovi movimenti di cassa." />
        <Metric label={`Costi gestionali totali${resultLabel}`} value={money(data.totalManagementCostsCents)} hint="Costi operativi + imposte e contributi + costi diretti noti delle sessioni svolte. Non e il totale delle uscite monetarie." />
        <Metric label="Valore servizi erogati" value={money(data.deliveredValueCents)} hint="Prezzo concordato + extra delle sessioni gia svolte, escluse annullate e servizi aggiuntivi legacy. Non usa i pagamenti." />
        <Metric label={`Margine diretto${resultLabel}`} value={money(data.directMarginCents)} hint="Valore servizi erogati meno costi diretti noti. Non comprende spese generali, imposte o contributi." />
        <Metric label={`Risultato operativo${resultLabel}`} value={money(data.operatingResultCents)} hint="Valore servizi erogati - costi diretti noti - costi operativi pagati. Usa basi temporali diverse: sessione e pagamento." />
        <Metric label={`Risultato finale gestionale${resultLabel}`} value={money(data.finalResultCents)} hint="Risultato operativo meno imposte e contributi registrati. Non e un utile fiscale." />
        <Metric label="Uscite pagate" value={money(data.totalPaidCents)} hint="Costi operativi pagati + imposte e contributi. I costi diretti non sono sommati nuovamente." />
        <Metric label="IVA registrata" value={money(data.vatCents)} hint="Somma dell'IVA effettivamente inserita nei movimenti dell'anno. E gia inclusa nelle uscite, senza deduzioni o scorpori dai KPI." />
        <Metric label="Cassa incassata" value={money(data.cashCents)} hint="Pagamenti monetari, comprese le vendite dei buoni regalo, esclusi i riscatti." />
        <Metric label="Saldo gestionale di cassa" value={money(data.cashBalanceCents)} hint="Cassa incassata - costi operativi pagati - imposte e contributi. Non sottrae i costi diretti, che non sono movimenti di pagamento." />
      </dl>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#675f57]">
        <span className="inline-flex items-center gap-1">Copertura costi storici: {data.directCostItems - data.directCostsMissingItems}/{data.directCostItems}<InfoTooltip text="Numero di righe extra e inclusioni con costo noto / righe totali delle sessioni svolte. Zero esplicito e noto; costo assente e sconosciuto. Le sessioni senza componenti non richiedono un costo manuale." /></span>
        <span className="inline-flex items-center gap-1">Servizi futuri: {money(data.future.valueCents)}<InfoTooltip text="Sessioni prenotate ma non ancora svolte; non entrano nel risultato operativo. Costi e valore futuro sono separati dai risultati delle sessioni svolte." /></span>
        <span>Costi diretti futuri noti: {money(data.future.directCostsKnownCents)}</span>
        <span>Margine diretto futuro{data.future.missingCostItems ? " (parziale)" : ""}: {money(data.future.directMarginCents)}</span>
        {data.future.missingCostItems ? <span className="text-[#7a5a17]">{data.future.missingCostItems} costi futuri mancanti su {data.future.totalCostItems}</span> : null}
      </div>

      <h3 className="mt-8 text-base font-semibold">Uscite per mese</h3>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#675f57]"><span><span className="mr-1 inline-block size-2 bg-[#516e64]" />Operativi</span><span><span className="mr-1 inline-block size-2 bg-[#a16c53]" />Imposte e contributi</span></div>
      <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Grafico uscite mensili">
        <div className="grid min-w-[36rem] grid-cols-12 gap-2 border-b border-[#d8d0c5] pb-2">
          {data.monthlyCosts.map((row) => <div key={row.month} className="flex h-40 min-w-0 flex-col justify-end text-center" title={`${row.label}: ${money(row.totalPaidCents)}`}>
            <div className="flex min-h-0 flex-1 flex-col justify-end px-1" aria-hidden="true"><div className="bg-[#a16c53]" style={{ height: `${row.taxContributionCostsCents / maxMonthly * 100}%` }} /><div className="bg-[#516e64]" style={{ height: `${row.operatingCostsCents / maxMonthly * 100}%` }} /></div>
            <span className="mt-2 text-xs text-[#675f57]">{row.label.slice(0, 3)}</span>
          </div>)}
        </div>
      </div>
      <AnalysisTable title="Dettaglio mensile" hint="Importi nelle rispettive basi temporali. Il risultato sottrae i costi diretti solo dal valore erogato; il saldo di cassa sottrae esclusivamente le uscite registrate." columns={["Mese", "Operativi", "Imposte / contributi", "IVA inclusa", "Uscite", "Diretti noti", "Erogati", "Risultato operativo", "Risultato finale", "Saldo cassa", "Copertura"]}
        rows={data.monthlyCosts.map((row) => [row.label, money(row.operatingCostsCents), money(row.taxContributionCostsCents), money(row.vatCents), money(row.totalPaidCents), money(row.directCostsKnownCents), money(row.deliveredValueCents), money(row.operatingResultCents), money(row.finalResultCents), money(row.cashBalanceCents), coverage(row.directCostsMissingItems, row.directCostItems)])} />
      <AnalysisTable title="Costi per categoria" hint="Importi pagati nell'anno, IVA compresa. Incidenza solo delle categorie operative sul totale operativo; imposte e contributi restano separati. I nomi sono quelli salvati sui movimenti." columns={["Categoria", "Tipo", "Movimenti", "Totale pagato", "IVA inclusa", "% costi operativi"]}
        rows={data.categoryBreakdown.map((row) => [row.name, row.kind === "operating" ? "Operativo" : "Imposte / contributi", row.count, money(row.totalCents), money(row.vatCents), rate(row.operatingShare)])} />
      <AnalysisTable title="Marginalita per servizio" hint="Solo sessioni gia svolte nell'anno. Margine diretto = prezzo concordato + extra - costi snapshot noti. I costi generali non vengono ripartiti tra i servizi." columns={["Servizio", "Sessioni svolte", "Valore", "Diretti noti", "Margine diretto", "% margine", "Copertura"]}
        rows={data.serviceMargins.map((row) => [row.name, row.sessions, money(row.valueCents), money(row.directCostsKnownCents), money(row.directMarginCents), rate(row.directMarginRate), coverage(row.missingCostItems, row.totalCostItems)])} />
      <AnalysisTable title={`Redditivita campagne ${data.year}`} hint="Valore erogato del servizio nell'anno campagna - costi diretti noti - marketing attribuito a quel servizio e anno. Il marketing puo essere stato pagato in un altro anno; il marketing generico resta solo nei costi operativi. Non ripartisce altri costi generali." columns={["Servizio / campagna", "Valore erogato", "Diretti noti", "Marketing attribuito", "Risultato campagna", "% margine", "Copertura"]}
        rows={data.campaignMargins.map((row) => [`${row.name} ${row.campaignYear}`, money(row.valueCents), money(row.directCostsKnownCents), money(row.marketingCents), money(row.resultCents), rate(row.marginRate), coverage(row.missingCostItems, row.totalCostItems)])} />
    </section>
  );
}

function coverage(missing: number, total: number) {
  return <span className={missing ? "text-[#7a5a17]" : "text-[#516e64]"}>{missing ? `Margine parziale (${total - missing}/${total})` : `Completa (${total}/${total})`}</span>;
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <div className="min-w-0"><dt className="flex items-center gap-1 text-xs font-medium text-[#675f57]">{label}<InfoTooltip text={hint} /></dt><dd className="mt-2 break-words text-xl font-semibold tabular-nums text-[#27231f]">{value}</dd></div>;
}

function AnalysisTable({ title, hint, columns, rows }: { title: string; hint: string; columns: string[]; rows: ReactNode[][] }) {
  return <section className="mt-7 min-w-0"><h3 className="flex items-center gap-2 text-base font-semibold">{title}<InfoTooltip text={hint} /></h3><div className="mt-3 overflow-x-auto border-y border-[#d8d0c5]" role="region" aria-label={title} tabIndex={0}><table className="w-full text-left text-sm"><thead className="bg-[#ebe5dd] text-xs text-[#675f57]"><tr>{columns.map((column) => <th key={column} scope="col" className="whitespace-nowrap px-3 py-3 font-medium">{column}</th>)}</tr></thead><tbody className="divide-y divide-[#e3dbd1]">{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td key={index} className={`px-3 py-3 tabular-nums ${index === 0 ? "min-w-40 font-medium" : "whitespace-nowrap"}`}>{cell}</td>)}</tr>)}{!rows.length ? <tr><td className="p-4 text-[#675f57]" colSpan={columns.length}>Nessun dato per questo anno.</td></tr> : null}</tbody></table></div></section>;
}