"use client";

import { useState, type FormEvent } from "react";
import { Calculator, Check, LoaderCircle } from "lucide-react";
import { AuditLogPanel } from "@/components/shared/audit-log-panel";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { centsToEuroInput, euroToCents } from "@/lib/economic-plan-draft";
import { toLocalDateKey } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { FREQUENCIES, parseExpenseValues, type Expense, type ExpenseOptions, type RecurringExpenseRule } from "@/lib/expenses";

export const costInputClass = "min-h-11 w-full min-w-0 border border-[#cfc5b8] bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[#9b5d43] disabled:bg-[#eee8df] disabled:text-[#675f57]";
export const costButtonClass = "inline-flex min-h-11 items-center justify-center gap-2 bg-[#9b5d43] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7f4934] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b5d43] disabled:opacity-50";

export function ExpenseEditor({ entry, recurring, options, busy, onBusy, onSaved }: { entry?: Expense | RecurringExpenseRule; recurring: boolean; options: ExpenseOptions; busy: boolean; onBusy: (value: boolean) => void; onSaved: () => void }) {
  const rule = entry && "frequency" in entry ? entry : undefined;
  const expense = entry && "paid_date" in entry ? entry : undefined;
  const today = toLocalDateKey(new Date());
  const [description, setDescription] = useState(entry?.description ?? "");
  const [categoryId, setCategoryId] = useState(entry?.expense_category_id ?? "");
  const [supplier, setSupplier] = useState(entry?.supplier ?? "");
  const [date, setDate] = useState(rule?.start_date ?? expense?.paid_date ?? today);
  const [net, setNet] = useState(entry ? centsToEuroInput(entry.net_amount_cents) : "");
  const [vat, setVat] = useState(entry ? centsToEuroInput(entry.vat_amount_cents) : "0");
  const [vatRate, setVatRate] = useState("22");
  const [methodId, setMethodId] = useState(entry?.payment_method_id ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [frequency, setFrequency] = useState(rule?.frequency ?? "monthly");
  const [endDate, setEndDate] = useState(rule?.end_date ?? "");
  const [active, setActive] = useState(rule?.is_active ?? true);
  const [linked, setLinked] = useState(Boolean(entry?.marketing_service_type_id));
  const [serviceId, setServiceId] = useState(entry?.marketing_service_type_id ?? "");
  const [campaignYear, setCampaignYear] = useState(String(entry?.marketing_campaign_year ?? Number(date.slice(0, 4))));
  const [error, setError] = useState<string | null>(null);
  const category = options.categories.find((row) => row.id === categoryId);
  const isMarketing = category?.is_marketing === true;
  const validMoney = (value: string) => /^\d+(?:[.,]\d{0,2})?$/.test(value.trim());
  const netCents = validMoney(net) ? euroToCents(net) : null;
  const vatCents = validMoney(vat) ? euroToCents(vat) : null;
  const total = netCents !== null && vatCents !== null ? netCents + vatCents : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (netCents === null || vatCents === null) { setError("Imponibile e IVA devono avere al massimo due decimali, senza separatori delle migliaia."); return; }
    const values = { description, expense_category_id: categoryId, supplier, net_amount_cents: netCents, vat_amount_cents: vatCents, payment_method_id: methodId, notes, marketing_service_type_id: isMarketing && linked ? serviceId : null, marketing_campaign_year: isMarketing && linked ? Number(campaignYear) : null };
    const parsed = parseExpenseValues(values);
    if (typeof parsed === "string") { setError(parsed); return; }
    const payload = { ...parsed, ...(recurring ? { frequency, start_date: date, end_date: endDate || null, is_active: active } : { paid_date: date }) };
    const endpoint = `/api/${recurring ? "recurring-expenses" : "expenses"}${entry ? `/${entry.id}` : ""}`;
    const send = async (confirmationCount?: number) => {
      const response = await fetch(endpoint, { method: entry ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, ...(confirmationCount !== undefined ? { confirmationCount } : {}) }) });
      return { response, body: await response.json() };
    };
    onBusy(true);
    try {
      let result = await send();
      if (result.response.status === 409 && Number.isInteger(result.body.confirmationCount)) {
        if (!window.confirm(result.body.error)) return;
        result = await send(result.body.confirmationCount);
      }
      if (!result.response.ok) throw new Error(result.body.error ?? "Salvataggio non riuscito.");
      onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Salvataggio non riuscito."); }
    finally { onBusy(false); }
  }

  return <form onSubmit={submit}>
    <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <label className="grid gap-1 text-sm sm:col-span-2">Descrizione<input className={costInputClass} required maxLength={200} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <label className="grid gap-1 text-sm">Categoria<select className={costInputClass} required value={categoryId} onChange={(event) => { setCategoryId(event.target.value); if (!options.categories.find((row) => row.id === event.target.value)?.is_marketing) { setLinked(false); setServiceId(""); } }}><option value="">Seleziona categoria</option>{options.categories.filter((row) => row.is_active || row.id === entry?.expense_category_id).map((row) => <option key={row.id} value={row.id}>{row.name}{row.is_active ? "" : " (disattivata)"}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Fornitore<input className={costInputClass} maxLength={200} value={supplier} onChange={(event) => setSupplier(event.target.value)} /></label>
      <label className="grid gap-1 text-sm">{recurring ? "Data inizio" : "Data pagamento"}<input className={costInputClass} type="date" min="2000-01-01" max={recurring ? "2100-12-31" : today} required value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label className="grid gap-1 text-sm">Metodo di pagamento<select className={costInputClass} required value={methodId} onChange={(event) => setMethodId(event.target.value)}><option value="">Seleziona metodo</option>{options.methods.filter((row) => !row.is_system && (row.is_active || row.id === entry?.payment_method_id)).map((row) => <option key={row.id} value={row.id}>{row.name}{row.is_active ? "" : " (disattivato)"}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Imponibile (EUR)<input className={costInputClass} required inputMode="decimal" maxLength={15} value={net} onChange={(event) => setNet(event.target.value)} /></label>
      <label className="grid gap-1 text-sm">IVA effettiva (EUR)<input className={costInputClass} required inputMode="decimal" maxLength={15} value={vat} onChange={(event) => setVat(event.target.value)} /></label>
      <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
        <label className="grid gap-1 text-xs text-[#675f57]">Aliquota IVA<select className={`${costInputClass} w-24`} value={vatRate} onChange={(event) => setVatRate(event.target.value)}>{[0, 4, 5, 10, 22].map((value) => <option key={value} value={value}>{value}%</option>)}</select></label>
        <button className="grid size-11 place-items-center border border-[#cfc5b8] disabled:opacity-50" type="button" title="Calcola IVA dall'imponibile" aria-label="Calcola IVA dall'imponibile" disabled={netCents === null} onClick={() => { if (netCents !== null) setVat(centsToEuroInput(Math.round(netCents * Number(vatRate) / 100))); }}><Calculator className="size-5" /></button>
        <div className="ml-auto min-w-0 text-right"><span className="inline-flex items-center gap-1 text-xs text-[#675f57]">Totale {recurring ? "per scadenza" : "pagato"}<InfoTooltip text="Imponibile + IVA effettiva. Questo totale entra nei costi, senza ipotesi di deducibilita. L'aliquota e solo un aiuto di calcolo: l'IVA resta modificabile." /></span><output className="block break-words text-xl font-semibold tabular-nums" aria-live="polite">{formatMoney(total)}</output></div>
      </div>
      {recurring ? <>
        <label className="grid gap-1 text-sm">Frequenza<select className={costInputClass} value={frequency} onChange={(event) => setFrequency(event.target.value as RecurringExpenseRule["frequency"])}>{Object.entries(FREQUENCIES).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
        <label className="grid gap-1 text-sm">Data fine (facoltativa)<input className={costInputClass} type="date" min={date} max="2100-12-31" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="size-4 accent-[#9b5d43]" checked={active} onChange={(event) => setActive(event.target.checked)} />Ricorrenza attiva<InfoTooltip text="Le scadenze maturate vengono registrate come pagate. Le modifiche valgono per le scadenze future: i movimenti esistenti non vengono riscritti. La riattivazione non recupera il periodo di pausa." /></label>
      </> : null}
      {isMarketing ? <div className="border-t border-[#d8d0c5] pt-4 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm"><input className="size-4 accent-[#9b5d43]" type="checkbox" checked={linked} onChange={(event) => setLinked(event.target.checked)} />Attribuisci a un servizio / campagna<InfoTooltip text="Facoltativo. Il marketing generico resta nei costi operativi. L'anno campagna puo differire dall'anno di pagamento e determina solo la redditivita di quella campagna." /></label>
        {linked ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">Servizio<select className={costInputClass} required value={serviceId} onChange={(event) => setServiceId(event.target.value)}><option value="">Seleziona servizio</option>{options.services.filter((row) => !row.is_addon && (row.is_active || row.id === entry?.marketing_service_type_id)).map((row) => <option key={row.id} value={row.id}>{row.name}{row.is_active ? "" : " (disattivato)"}</option>)}</select></label><label className="grid gap-1 text-sm">Anno campagna<input className={costInputClass} required type="number" min={2000} max={2100} step={1} value={campaignYear} onChange={(event) => setCampaignYear(event.target.value)} /></label></div> : null}
      </div> : null}
      <label className="grid gap-1 text-sm sm:col-span-2">Note<textarea className={costInputClass} rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
    </fieldset>
    {expense?.recurring_rule_id ? <p className="mt-4 text-xs text-[#675f57]">Movimento generato da ricorrenza. La correzione riguarda solo questo movimento.</p> : null}
    {error ? <p className="mt-4 text-sm text-[#a53e31]" role="alert">{error}</p> : null}
    <div className="mt-5 flex justify-end"><button className={costButtonClass} disabled={busy} type="submit">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}{busy ? "Salvataggio..." : recurring ? "Salva ricorrenza" : "Salva costo"}</button></div>
    {entry ? <AuditLogPanel table={recurring ? "recurring_expense_rules" : "expenses"} recordId={entry.id} /> : null}
  </form>;
}