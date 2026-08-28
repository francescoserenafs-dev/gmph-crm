"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuditLogPanel } from "@/components/shared/audit-log-panel";
import { ExportButton } from "@/components/shared/export-button";

type SessionOption = { id: string; scheduled_at: string; service_name: string; client: { first_name: string; last_name: string } | null };
type Method = { id: string; name: string };
type EligibleVoucher = { id: string; code: string; voucher_type: "service" | "value"; service_name: string | null; value_cents: number | null; purchase_price_cents: number | null };

const VOUCHER_METHOD = "__voucher__";
type Payment = {
  id: string;
  amount_cents: number;
  paid_at: string;
  category: string;
  payment_method_name: string;
  applied_voucher_id: string | null;
  notes: string | null;
  session: { id: string; service_name: string; scheduled_at: string; client: { first_name: string; last_name: string } | null } | null;
  voucher: { id: string; code: string; purchaser: { first_name: string; last_name: string } | null } | null;
};

const dateOnly = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" });
const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const categoryLabels: Record<string, string> = {
  deposit: "Caparra",
  balance: "Saldo",
  full_payment: "Pagamento completo",
  voucher_purchase: "Pagamento completo",
  voucher_redemption: "Utilizzo buono regalo",
};

function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function PaymentDirectory() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [page, setPage] = useState(() => Number(searchParams.get("page")) || 1);
  const [pageSize, setPageSize] = useState(() => Number(searchParams.get("pageSize")) || 25);
  const [total, setTotal] = useState(0);
  const [methodFilter, setMethodFilter] = useState(searchParams.get("method") ?? "");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("category") ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"new" | "edit" | null>(searchParams.get("new") === "1" ? "new" : null);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [form, setForm] = useState({ sessionId: "", amountEuros: "", paidAt: toLocalInput(new Date()), methodId: "", category: "balance", notes: "" });
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [eligibleVouchers, setEligibleVouchers] = useState<EligibleVoucher[]>([]);
  const [voucherId, setVoucherId] = useState("");
  const [historyPayment, setHistoryPayment] = useState<Payment | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (methodFilter) params.set("method", methodFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    return params.toString();
  }, [page, pageSize, methodFilter, categoryFilter]);

  useEffect(() => {
    router.replace(`/payments?${query}`, { scroll: false });
  }, [query, router]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [sessionsRes, methodsRes] = await Promise.all([fetch("/api/sessions?page=1&pageSize=100"), fetch("/api/payments/options")]);
      const sessionsBody = await sessionsRes.json();
      const methodsBody = await methodsRes.json();
      if (!active) return;
      if (sessionsRes.ok) setSessions(sessionsBody.sessions);
      if (methodsRes.ok) setMethods(methodsBody.methods);
    })().catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/payments?${query}`);
        const body = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(body.error);
        setPayments(body.payments as Payment[]);
        setTotal(body.total as number);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Caricamento non riuscito.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [query, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (dialog !== "new" || !form.sessionId) { setEligibleVouchers([]); return; }
    let active = true;
    fetch(`/api/sessions/${form.sessionId}/eligible-vouchers`)
      .then((response) => response.json())
      .then((body) => { if (active) setEligibleVouchers(body.vouchers ?? []); })
      .catch(() => { if (active) setEligibleVouchers([]); });
    return () => { active = false; };
  }, [dialog, form.sessionId]);

  function openNew() {
    setForm({ sessionId: "", amountEuros: "", paidAt: toLocalInput(new Date()), methodId: methods[0]?.id ?? "", category: "balance", notes: "" });
    setVoucherId("");
    setError(null);
    setDialog("new");
  }

  function openEdit(payment: Payment) {
    if (payment.applied_voucher_id) return;
    setEditing(payment);
    setForm({ sessionId: payment.session?.id ?? "", amountEuros: String(payment.amount_cents / 100), paidAt: toLocalInput(new Date(payment.paid_at)), methodId: methods.find((method) => method.name === payment.payment_method_name)?.id ?? "", category: payment.category, notes: payment.notes ?? "" });
    setError(null);
    setDialog("edit");
  }

  async function submitNew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const response = form.methodId === VOUCHER_METHOD
        ? await fetch(`/api/sessions/${form.sessionId}/redeem`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voucherId }) })
        : await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setDialog(null); setPage(1); setRefreshKey((key) => key + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Registrazione non riuscita."); } finally { setBusy(false); }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/payments/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setDialog(null); setEditing(null); setRefreshKey((key) => key + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Aggiornamento non riuscito."); } finally { setBusy(false); }
  }

  async function remove(payment: Payment) {
    if (!window.confirm(payment.applied_voucher_id ? "Eliminare il pagamento? Il buono verra riattivato." : "Eliminare il pagamento?")) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/payments/${payment.id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setRefreshKey((key) => key + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Eliminazione non riuscita."); } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-[#d8d0c5] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold sm:text-4xl">Pagamenti</h1>
            <p className="mt-2 text-sm text-[#675f57]">Incassi registrati per sessioni e buoni.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButton
              fetchRows={async () => {
                const params = new URLSearchParams({ page: "1", pageSize: "10000" });
                if (methodFilter) params.set("method", methodFilter);
                if (categoryFilter) params.set("category", categoryFilter);
                const response = await fetch(`/api/payments?${params.toString()}`);
                const body = await response.json();
                return ((body.payments ?? []) as Payment[]).map((payment) => {
                  const payer = payment.session?.client ?? payment.voucher?.purchaser ?? null;
                  return {
                    Cliente: payer ? `${payer.first_name} ${payer.last_name}` : "",
                    Data: dateOnly.format(new Date(payment.paid_at)),
                    Riferimento: payment.session ? payment.session.service_name : payment.voucher ? `Buono ${payment.voucher.code}` : "",
                    Causale: categoryLabels[payment.category] ?? payment.category,
                    Metodo: payment.payment_method_name,
                    Importo: (payment.amount_cents / 100).toFixed(2),
                  };
                });
              }}
              filename="pagamenti"
            />
            <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white" onClick={openNew} type="button">Nuovo pagamento</button>
          </div>
        </header>

        <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row">
            <label className="flex flex-col gap-2 text-sm font-medium">Metodo
              <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }} value={methodFilter}>
                <option value="">Tutti</option>
                {methods.map((method) => <option key={method.id} value={method.name}>{method.name}</option>)}
                <option value="Buono regalo">Buono regalo</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">Causale
              <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} value={categoryFilter}>
                <option value="">Tutte</option>
                {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">Per pagina
            <select className="h-10 border border-[#cfc5b8] bg-white px-2" onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} value={pageSize}>{[10, 25, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}</select>
          </label>
        </div>

        {error ? <p className="mt-5 text-sm text-[#a53e31]">{error}</p> : null}

        <section className="mt-5 overflow-hidden border border-[#d8d0c5] bg-white">
          <div className="grid grid-cols-[1fr_0.9fr_1.4fr_1fr_1fr_0.9fr_230px] gap-3 bg-[#eee8df] px-5 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#675f57]">
            <span>Cliente</span><span>Data</span><span>Riferimento</span><span>Causale</span><span>Metodo</span><span>Importo</span><span>Azioni</span>
          </div>
          {loading ? <p className="p-8 text-sm text-[#675f57]">Caricamento pagamenti...</p> : payments.length === 0 ? <p className="p-10 text-center text-sm text-[#675f57]">Nessun pagamento da mostrare.</p> : payments.map((payment) => {
            const payer = payment.session?.client ?? payment.voucher?.purchaser ?? null;
            return (
              <article className="grid grid-cols-[1fr_0.9fr_1.4fr_1fr_1fr_0.9fr_230px] items-center gap-3 border-t border-[#eee8df] px-5 py-4 text-sm" key={payment.id}>
                <span className="min-w-0 truncate font-medium">{payer ? `${payer.first_name} ${payer.last_name}` : "-"}</span>
                <span>{dateOnly.format(new Date(payment.paid_at))}</span>
                <span className="min-w-0 truncate">
                  {payment.session ? <Link className="font-medium text-[#9b5d43] hover:underline" href={`/sessions/${payment.session.id}`}>{payment.session.service_name}</Link> : payment.voucher ? <Link className="font-medium text-[#9b5d43] hover:underline" href={`/vouchers/${payment.voucher.id}`}>Buono {payment.voucher.code}</Link> : "-"}
                </span>
                <span>{categoryLabels[payment.category] ?? payment.category}</span>
                <span>{payment.payment_method_name}</span>
                <span>{euro.format(payment.amount_cents / 100)}</span>
                <span className="flex justify-end gap-2">
                  {payment.applied_voucher_id ? null : <button className="border border-[#cfc5b8] px-2 py-1 text-xs font-semibold hover:bg-[#eee8df]" onClick={() => openEdit(payment)} type="button">Modifica</button>}
                  <button className="border border-[#cfc5b8] px-2 py-1 text-xs font-semibold hover:bg-[#eee8df]" onClick={() => setHistoryPayment(payment)} type="button">Storico</button>
                  <button className="border border-[#a53e31] px-2 py-1 text-xs font-semibold text-[#a53e31] hover:bg-[#fff1ef] disabled:opacity-50" disabled={busy} onClick={() => remove(payment)} type="button">Elimina</button>
                </span>
              </article>
            );
          })}
        </section>

        <div className="mt-5 flex items-center justify-between text-sm">
          <span>{total} pagamenti</span>
          <div className="flex items-center gap-2">
            <button className="h-10 border border-[#cfc5b8] px-3 disabled:opacity-40" disabled={page === 1} onClick={() => setPage(page - 1)} type="button">Precedente</button>
            <span>Pagina {page} di {totalPages}</span>
            <button className="h-10 border border-[#cfc5b8] px-3 disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage(page + 1)} type="button">Successiva</button>
          </div>
        </div>
      </section>

      {dialog ? (
        <div aria-modal="true" className="fixed inset-0 z-10 grid place-items-center bg-[#27231f]/45 p-4" role="dialog">
          <form className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto bg-[#fdfbf8] p-6 shadow-xl" onSubmit={dialog === "new" ? submitNew : submitEdit}>
            <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">{dialog === "new" ? "Nuovo pagamento" : "Modifica pagamento"}</h2><button aria-label="Chiudi" className="size-9 border border-[#cfc5b8]" onClick={() => { setDialog(null); setEditing(null); }} type="button">x</button></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {dialog === "edit" && editing?.voucher ? (
                <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">Buono di riferimento
                  <input className="h-11 border border-[#cfc5b8] bg-[#eee8df] px-3" disabled value={`Buono ${editing.voucher.code}`} />
                </label>
              ) : (
                <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">Sessione di riferimento
                  <select className="h-11 border border-[#cfc5b8] bg-white px-3 disabled:bg-[#eee8df]" disabled={dialog === "edit"} onChange={(e) => setForm({ ...form, sessionId: e.target.value })} required value={form.sessionId}>
                    <option value="">Seleziona</option>
                    {sessions.map((session) => <option key={session.id} value={session.id}>{dateOnly.format(new Date(session.scheduled_at))} - {session.service_name}{session.client ? ` - ${session.client.first_name} ${session.client.last_name}` : ""}</option>)}
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-2 text-sm font-medium">Metodo
                <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setForm({ ...form, methodId: e.target.value })} required value={form.methodId}>
                  <option value="">Seleziona</option>
                  {dialog === "new" && eligibleVouchers.length > 0 ? <option value={VOUCHER_METHOD}>Buono regalo</option> : null}
                  {methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
                </select>
              </label>
              {dialog === "new" && form.methodId === VOUCHER_METHOD ? (
                <label className="flex flex-col gap-2 text-sm font-medium">Buono
                  <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setVoucherId(e.target.value)} required value={voucherId}>
                    <option value="">Seleziona</option>
                    {eligibleVouchers.map((voucher) => <option key={voucher.id} value={voucher.id}>{voucher.code} - {voucher.voucher_type === "value" ? euro.format((voucher.value_cents ?? 0) / 100) : `Sessione ${voucher.service_name ?? ""} (${euro.format((voucher.purchase_price_cents ?? 0) / 100)})`}</option>)}
                  </select>
                </label>
              ) : dialog === "edit" && editing?.voucher ? (
                <label className="flex flex-col gap-2 text-sm font-medium">Causale
                  <input className="h-11 border border-[#cfc5b8] bg-[#eee8df] px-3" disabled value="Pagamento completo" />
                </label>
              ) : (
                <>
                  <label className="flex flex-col gap-2 text-sm font-medium">Importo (EUR)<input className="h-11 border border-[#cfc5b8] bg-white px-3" min="1" onChange={(e) => setForm({ ...form, amountEuros: e.target.value })} required type="number" value={form.amountEuros} /></label>
                  <label className="flex flex-col gap-2 text-sm font-medium">Data<input className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setForm({ ...form, paidAt: e.target.value })} required type="datetime-local" value={form.paidAt} /></label>
                  <label className="flex flex-col gap-2 text-sm font-medium">Causale
                    <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setForm({ ...form, category: e.target.value })} required value={form.category}>
                      <option value="deposit">Caparra</option>
                      <option value="balance">Saldo</option>
                      <option value="full_payment">Pagamento completo</option>
                    </select>
                  </label>
                </>
              )}

            </div>
            <label className="mt-4 flex flex-col gap-2 text-sm font-medium">Note<textarea className="min-h-20 border border-[#cfc5b8] bg-white p-3" onChange={(e) => setForm({ ...form, notes: e.target.value })} value={form.notes} /></label>
            {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button className="h-11 px-4 text-sm font-semibold" onClick={() => { setDialog(null); setEditing(null); }} type="button">Annulla</button>
              <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? "Salvataggio..." : "Salva pagamento"}</button>
            </div>
          </form>
        </div>
      ) : null}

      {historyPayment ? (
        <div aria-modal="true" className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10" role="dialog">
          <div className="w-full max-w-lg bg-[#f5f1eb] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Storico pagamento</h2>
              <button aria-label="Chiudi" className="size-9 border border-[#cfc5b8]" onClick={() => setHistoryPayment(null)} type="button">x</button>
            </div>
            <AuditLogPanel recordId={historyPayment.id} table="payments" />
          </div>
        </div>
      ) : null}
    </main>
  );
}
