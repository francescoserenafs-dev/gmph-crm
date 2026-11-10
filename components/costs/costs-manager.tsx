"use client";

import { useDeferredValue, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, LoaderCircle, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Modal } from "@/components/shared/modal";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { AuditLogPanel } from "@/components/shared/audit-log-panel";
import { CostAnalysis } from "@/components/costs/cost-analysis";
import { ExpenseEditor, costButtonClass, costInputClass } from "@/components/costs/expense-editor";
import { toLocalDateKey } from "@/lib/datetime";
import { MONTH_NAMES } from "@/lib/economic-plans";
import { formatMoney } from "@/lib/money";
import { expenseTotal, FREQUENCIES, nextRecurringOccurrence, type CostAnalytics, type Expense, type ExpenseCategory, type ExpenseOptions, type RecurringExpenseRule } from "@/lib/expenses";

type Tab = "movimenti" | "ricorrenze" | "categorie";
type Editor = { kind: "expense"; entry?: Expense } | { kind: "rule"; entry?: RecurringExpenseRule } | { kind: "category"; entry?: ExpenseCategory };
type Loaded = { year: number; expenses: Expense[]; options: ExpenseOptions; rules: RecurringExpenseRule[]; analytics: CostAnalytics | null; analyticsError: string | null };
const tabs: { value: Tab; label: string }[] = [{ value: "movimenti", label: "Movimenti" }, { value: "ricorrenze", label: "Ricorrenze" }, { value: "categorie", label: "Categorie" }];
const iconClass = "grid size-11 shrink-0 place-items-center border border-[#cfc5b8] text-[#675f57] hover:bg-[#eee8df] focus-visible:outline-2 focus-visible:outline-[#9b5d43] disabled:opacity-50";
const dateLabel = (date: string | null) => date ? date.split("-").reverse().join("/") : "\u2014";

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Operazione non riuscita.");
  return body;
}

export function CostsManager() {
  const [year, setYear] = useState(Number(toLocalDateKey(new Date()).slice(0, 4)));
  const [tab, setTab] = useState<Tab>("movimenti");
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(1);
  const search = useDeferredValue(query).trim().toLocaleLowerCase("it");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true); setError(null);
      try {
        const [movements, rules, analytics] = await Promise.all([
          requestJson(`/api/expenses?year=${year}`, { signal: controller.signal }),
          requestJson("/api/recurring-expenses", { signal: controller.signal }),
          requestJson(`/api/analytics/costs?year=${year}`, { signal: controller.signal }).then((result) => ({ data: result as CostAnalytics, error: null })).catch((reason) => ({ data: null, error: reason instanceof Error ? reason.message : "Analisi non disponibile." })),
        ]);
        if (!controller.signal.aborted) setData({ ...movements, rules: rules.rules, analytics: analytics.data, analyticsError: analytics.error });
      } catch (reason) { if (!controller.signal.aborted) { setData(null); setError(reason instanceof Error ? reason.message : "Caricamento non riuscito."); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [year, revision]);

  const current = data?.year === year ? data : null;
  const filtered = (current?.expenses ?? []).filter((row) => (!categoryFilter || row.expense_category_id === categoryFilter) && (!methodFilter || row.payment_method_id === methodFilter) && (!month || Number(row.paid_date.slice(5, 7)) === Number(month)) && (!search || [row.description, row.supplier, row.notes].some((value) => value?.toLocaleLowerCase("it").includes(search))));
  const totalPages = Math.max(1, Math.ceil(filtered.length / 50));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * 50, currentPage * 50);
  const today = toLocalDateKey(new Date());
  const locked = busy || loading;
  const open = (value: Editor) => { setMessage(null); setEditor(value); };
  const saved = () => { setEditor(null); setMessage("Salvataggio completato."); setRevision((value) => value + 1); };

  async function removeExpense(row: Expense) {
    if (locked || !window.confirm(`Eliminare il costo "${row.description}" di ${formatMoney(expenseTotal(row))}?${row.recurring_rule_id ? " Questa occorrenza non verra rigenerata; la ricorrenza resta attiva." : ""}`)) return;
    setBusy(true); setError(null); setMessage(null);
    try { await requestJson(`/api/expenses/${row.id}`, { method: "DELETE" }); setMessage("Costo eliminato."); setRevision((value) => value + 1); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Eliminazione non riuscita."); }
    finally { setBusy(false); }
  }

  async function toggleRule(rule: RecurringExpenseRule) {
    if (locked) return;
    if (!window.confirm(rule.is_active ? `Disattivare "${rule.description}"? I movimenti gia maturati resteranno nello storico.` : `Riattivare "${rule.description}"? Ripartira dalle scadenze future, senza recuperare il periodo di pausa.`)) return;
    setBusy(true); setError(null); setMessage(null);
    try { await requestJson(`/api/recurring-expenses/${rule.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: !rule.is_active }) }); setMessage(rule.is_active ? "Ricorrenza disattivata." : "Ricorrenza riattivata."); setRevision((value) => value + 1); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Modifica non riuscita."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 pb-28 text-[#27231f] sm:px-8 sm:pb-10 lg:px-12">
    <div className="mx-auto min-w-0 max-w-6xl">
      <header className="border-b border-[#d8d0c5] pb-5"><div className="flex flex-wrap items-center justify-between gap-4"><h1 className="flex items-center gap-2 text-3xl font-semibold sm:text-4xl">Costi<InfoTooltip text="Gestione delle uscite effettivamente pagate e della marginalita. Non e contabilita fiscale. I costi diretti di extra e pacchetti provengono dagli snapshot delle sessioni e non creano nuovi movimenti." /></h1><div className="flex items-end gap-2"><label className="grid gap-1 text-xs text-[#675f57]">Anno<select className={costInputClass} value={year} disabled={busy} onChange={(event) => { setYear(Number(event.target.value)); setPage(1); setMessage(null); }}>{Array.from({ length: 101 }, (_, index) => 2100 - index).map((value) => <option value={value} key={value}>{value}</option>)}</select></label><button aria-label="Aggiorna costi" title="Aggiorna costi" className={iconClass} disabled={locked} onClick={() => setRevision((value) => value + 1)} type="button"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></button></div></div>
        <div className="mt-5 flex gap-1" role="tablist" aria-label="Gestione costi">{tabs.map((item, index) => <button key={item.value} id={`cost-tab-${item.value}`} aria-controls={`cost-panel-${item.value}`} role="tab" aria-selected={tab === item.value} tabIndex={tab === item.value ? 0 : -1} type="button" className={`min-h-11 px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[#9b5d43] ${tab === item.value ? "bg-[#9b5d43] text-white" : "border border-[#cfc5b8] bg-white text-[#675f57]"}`} onClick={() => setTab(item.value)} onKeyDown={(event) => { const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null; if (next !== null) { event.preventDefault(); setTab(tabs[next].value); document.getElementById(`cost-tab-${tabs[next].value}`)?.focus(); } }}>{item.label}</button>)}</div>
      </header>
      {error ? <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-[#a53e31]" role="alert"><span>{error}</span><button className={iconClass} title="Riprova caricamento" aria-label="Riprova caricamento" onClick={() => setRevision((value) => value + 1)} disabled={locked} type="button"><RefreshCw className="size-4" /></button></div> : null}
      {message ? <p className="mt-4 text-sm text-[#516e64]" role="status">{message}</p> : null}
      {loading ? <p className="mt-5 flex items-center gap-2 text-sm text-[#675f57]" role="status"><LoaderCircle className="size-4 animate-spin" />Caricamento costi...</p> : null}
      <section id={`cost-panel-${tab}`} role="tabpanel" aria-labelledby={`cost-tab-${tab}`} aria-busy={loading} className="mt-6 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{tab === "movimenti" ? `Movimenti ${year}` : tab === "ricorrenze" ? "Ricorrenze" : "Categorie"}</h2><button className={costButtonClass} disabled={locked || !current} type="button" onClick={() => open({ kind: tab === "movimenti" ? "expense" : tab === "ricorrenze" ? "rule" : "category" })}><Plus className="size-4" />{tab === "movimenti" ? "Nuovo costo" : tab === "ricorrenze" ? "Nuova ricorrenza" : "Nuova categoria"}</button></div>
        {current && tab === "movimenti" ? <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="grid gap-1 text-xs text-[#675f57]">Descrizione, fornitore o note<input className={costInputClass} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></label><label className="grid gap-1 text-xs text-[#675f57]">Categoria<select className={costInputClass} value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}><option value="">Tutte</option>{current.options.categories.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="grid gap-1 text-xs text-[#675f57]">Metodo<select className={costInputClass} value={methodFilter} onChange={(event) => { setMethodFilter(event.target.value); setPage(1); }}><option value="">Tutti</option>{current.options.methods.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="grid gap-1 text-xs text-[#675f57]">Mese<select className={costInputClass} value={month} onChange={(event) => { setMonth(event.target.value); setPage(1); }}><option value="">Tutti</option>{MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label></div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm"><span>{filtered.length} movimenti{categoryFilter || methodFilter || month || search ? " filtrati" : ""}</span><span className="font-medium">Totale elenco: {formatMoney(filtered.reduce((sum, row) => sum + expenseTotal(row), 0))}</span></div>
          <Table label="Movimenti pagati" columns={["Data", "Descrizione", "Categoria", "Fornitore", "Imponibile", "IVA", "Totale pagato", "Metodo", "Origine", "Campagna", "Note", "Azioni"]} empty={!visible.length}>
            {visible.map((row) => <tr key={row.id}><Cell>{dateLabel(row.paid_date)}</Cell><Cell wrap>{row.description}</Cell><Cell wrap>{row.category_name_snapshot}</Cell><Cell wrap>{row.supplier || "\u2014"}</Cell><Cell>{formatMoney(row.net_amount_cents)}</Cell><Cell>{formatMoney(row.vat_amount_cents)}</Cell><Cell>{formatMoney(expenseTotal(row))}</Cell><Cell>{row.payment_method_name_snapshot}</Cell><Cell>{row.recurring_rule_id ? "Ricorrenza" : "Manuale"}</Cell><Cell wrap>{row.marketing_service_name_snapshot ? `${row.marketing_service_name_snapshot} ${row.marketing_campaign_year}` : "\u2014"}</Cell><Cell wrap>{row.notes || "\u2014"}</Cell><Cell><div className="flex gap-1"><button className={iconClass} aria-label={`Modifica costo ${row.description}`} title="Modifica costo e cronologia" disabled={locked} onClick={() => open({ kind: "expense", entry: row })} type="button"><Pencil className="size-4" /></button><button className={`${iconClass} text-[#a53e31]`} aria-label={`Elimina costo ${row.description}`} title="Elimina costo" disabled={locked} onClick={() => void removeExpense(row)} type="button"><Trash2 className="size-4" /></button></div></Cell></tr>)}
          </Table>
          {totalPages > 1 ? <div className="mt-3 flex items-center justify-end gap-3 text-sm"><button className={iconClass} title="Pagina precedente" aria-label="Pagina precedente" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} type="button"><ChevronLeft className="size-4" /></button><span>{currentPage} / {totalPages}</span><button className={iconClass} title="Pagina successiva" aria-label="Pagina successiva" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} type="button"><ChevronRight className="size-4" /></button></div> : null}
          {current.analytics ? <CostAnalysis data={current.analytics} /> : <p className="mt-6 text-sm text-[#a53e31]" role="alert">{current.analyticsError}</p>}
        </> : null}
        {current && tab === "ricorrenze" ? <Table label="Regole ricorrenti" columns={["Descrizione", "Categoria", "Totale / scadenza", "Frequenza", "Inizio", "Fine", "Prossima", "Attiva", "Azioni"]} empty={!current.rules.length}>
          {current.rules.map((rule) => <tr key={rule.id}><Cell wrap>{rule.description}</Cell><Cell wrap>{current.options.categories.find((row) => row.id === rule.expense_category_id)?.name ?? "\u2014"}</Cell><Cell>{formatMoney(expenseTotal(rule))}</Cell><Cell>{FREQUENCIES[rule.frequency]}</Cell><Cell>{dateLabel(rule.start_date)}</Cell><Cell>{dateLabel(rule.end_date)}</Cell><Cell>{dateLabel(nextRecurringOccurrence(rule, today))}</Cell><Cell><input className="size-5 accent-[#9b5d43]" type="checkbox" aria-label={`Ricorrenza attiva ${rule.description}`} checked={rule.is_active} disabled={locked} onChange={() => void toggleRule(rule)} /></Cell><Cell><button className={iconClass} title="Modifica ricorrenza e cronologia" aria-label={`Modifica ricorrenza ${rule.description}`} disabled={locked} onClick={() => open({ kind: "rule", entry: rule })} type="button"><Pencil className="size-4" /></button></Cell></tr>)}
        </Table> : null}
        {current && tab === "categorie" ? <Table label="Categorie di costo" columns={["Categoria", "Tipo", "Ordine", "Stato", "Azioni"]} empty={!current.options.categories.length}>
          {current.options.categories.map((row) => <tr key={row.id}><Cell wrap>{row.name}</Cell><Cell>{row.kind === "tax_contribution" ? "Imposte / contributi" : row.is_marketing ? "Operativo / marketing" : "Operativo"}</Cell><Cell>{row.sort_order}</Cell><Cell>{row.is_active ? "Attiva" : "Disattivata"}</Cell><Cell><button className={iconClass} title="Modifica categoria e cronologia" aria-label={`Modifica categoria ${row.name}`} disabled={locked} onClick={() => open({ kind: "category", entry: row })} type="button"><Pencil className="size-4" /></button></Cell></tr>)}
        </Table> : null}
      </section>
      {editor && current ? <Modal busy={busy} title={editor.kind === "category" ? editor.entry ? "Modifica categoria" : "Nuova categoria" : editor.kind === "rule" ? editor.entry ? "Modifica ricorrenza" : "Nuova ricorrenza" : editor.entry ? "Modifica costo" : "Nuovo costo"} onClose={() => { if (!busy) setEditor(null); }}>
        {editor.kind === "category" ? <CategoryEditor entry={editor.entry} busy={busy} onBusy={setBusy} onSaved={saved} /> : <ExpenseEditor entry={editor.entry} recurring={editor.kind === "rule"} options={current.options} busy={busy} onBusy={setBusy} onSaved={saved} />}
      </Modal> : null}
    </div>
  </main>;
}

function Table({ label, columns, children, empty }: { label: string; columns: string[]; children: ReactNode; empty: boolean }) {
  return <div className="mt-3 overflow-x-auto border-y border-[#d8d0c5]" role="region" aria-label={label} tabIndex={0}><table className="w-full text-left text-sm [&_td:last-child]:sticky [&_td:last-child]:right-0 [&_td:last-child]:bg-[#f5f1eb] [&_th:last-child]:sticky [&_th:last-child]:right-0 [&_th:last-child]:bg-[#ebe5dd]"><thead className="bg-[#ebe5dd] text-xs text-[#675f57]"><tr>{columns.map((column) => <th key={column} scope="col" className="whitespace-nowrap px-3 py-3 font-medium">{column}</th>)}</tr></thead><tbody className="divide-y divide-[#e3dbd1]">{empty ? <tr><td className="p-5 text-[#675f57]" colSpan={columns.length}>Nessun elemento.</td></tr> : children}</tbody></table></div>;
}

function Cell({ children, wrap = false }: { children: ReactNode; wrap?: boolean }) {
  return <td className={`px-3 py-3 align-top tabular-nums ${wrap ? "min-w-40 max-w-64 break-words whitespace-normal" : "whitespace-nowrap"}`}>{children}</td>;
}

function CategoryEditor({ entry, busy, onBusy, onSaved }: { entry?: ExpenseCategory; busy: boolean; onBusy: (value: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState(entry?.name ?? "");
  const [kind, setKind] = useState(entry?.kind ?? "operating");
  const [order, setOrder] = useState(String(entry?.sort_order ?? 90));
  const [active, setActive] = useState(entry?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    onBusy(true); setError(null);
    try { await requestJson(`/api/expense-categories${entry ? `/${entry.id}` : ""}`, { method: entry ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, kind, sort_order: Number(order), is_active: active }) }); onSaved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Salvataggio non riuscito."); }
    finally { onBusy(false); }
  }
  return <form onSubmit={submit}><fieldset disabled={busy} className="grid gap-4"><label className="grid gap-1 text-sm">Nome categoria<input className={costInputClass} required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label><label className="grid gap-1 text-sm">Tipo<select className={costInputClass} disabled={Boolean(entry)} value={kind} onChange={(event) => setKind(event.target.value as ExpenseCategory["kind"])}><option value="operating">Operativo</option><option value="tax_contribution">Imposte e contributi</option></select></label><label className="grid gap-1 text-sm">Ordine<input className={costInputClass} type="number" min={0} max={10000} step={1} required value={order} onChange={(event) => setOrder(event.target.value)} /></label><label className="flex items-center gap-2 text-sm"><input className="size-4 accent-[#9b5d43]" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />Categoria attiva<InfoTooltip text="Una categoria disattivata non e disponibile per nuovi costi. I movimenti storici e le ricorrenze esistenti mantengono i riferimenti; per interrompere una ricorrenza occorre disattivarla." /></label></fieldset>{error ? <p className="mt-4 text-sm text-[#a53e31]" role="alert">{error}</p> : null}<div className="mt-5 flex justify-end"><button className={costButtonClass} type="submit" disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}{busy ? "Salvataggio..." : "Salva categoria"}</button></div>{entry ? <AuditLogPanel table="expense_categories" recordId={entry.id} /> : null}</form>;
}