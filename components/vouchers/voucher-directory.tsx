"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ClientCombobox } from "@/components/shared/client-combobox";

type Client = { id: string; first_name: string; last_name: string; email: string };
type Service = { id: string; name: string };
type Method = { id: string; name: string };
type Voucher = {
  id: string;
  code: string;
  voucher_type: "service" | "value";
  service_name: string | null;
  value_cents: number | null;
  purchase_price_cents: number;
  status: string;
  purchased_at: string;
  expires_at: string;
  purchaser: { id: string; first_name: string; last_name: string } | null;
  recipient: { id: string; first_name: string; last_name: string } | null;
  payments: { amount_cents: number }[];
};

const dateOnly = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" });
const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const statusLabels: Record<string, string> = { active: "Attivo", redeemed: "Riscattato", expired: "Scaduto", cancelled: "Annullato" };

export function VoucherDirectory() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectPurchaser = searchParams.get("purchaser") ?? "";
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"new" | "recipient" | "payment" | null>(preselectPurchaser || searchParams.get("new") === "1" ? "new" : null);
  const [editing, setEditing] = useState<Voucher | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [form, setForm] = useState({ code: "", voucherType: "value", purchaserClientId: preselectPurchaser, recipientClientId: "", serviceTypeId: "", valueEuros: "", purchaseEuros: "", purchaseMethodId: "", purchasedAt: "", notes: "" });
  const [recipientValue, setRecipientValue] = useState("");
  const [paymentForm, setPaymentForm] = useState({ amountEuros: "", paidAt: new Date().toISOString().slice(0, 10), methodId: "" });
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const query = useMemo(() => { const params = new URLSearchParams(); if (statusFilter) params.set("status", statusFilter); return params.toString(); }, [statusFilter]);

  function updateStatusFilter(value: string) {
    setStatusFilter(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("status", value); else params.delete("status");
    router.replace(`/vouchers${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const response = await fetch("/api/vouchers/options");
      const body = await response.json();
      if (active && response.ok) { setClients(body.clients); setServices(body.services); setMethods(body.methods); }
    })().catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/vouchers?${query}`);
        const body = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(body.error);
        setVouchers(body.vouchers as Voucher[]);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Caricamento non riuscito.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [query, refreshKey]);

  function openNew() {
    setForm({ code: "", voucherType: "value", purchaserClientId: "", recipientClientId: "", serviceTypeId: "", valueEuros: "", purchaseEuros: "", purchaseMethodId: methods[0]?.id ?? "", purchasedAt: new Date().toISOString().slice(0, 10), notes: "" });
    setError(null);
    setDialog("new");
  }

  async function submitNew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const response = await fetch("/api/vouchers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setDialog(null); setRefreshKey((key) => key + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Creazione non riuscita."); } finally { setBusy(false); }
  }

  function openRecipient(voucher: Voucher) { setEditing(voucher); setRecipientValue(voucher.recipient?.id ?? ""); setError(null); setDialog("recipient"); }

  async function submitRecipient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/vouchers/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientClientId: recipientValue }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setDialog(null); setEditing(null); setRefreshKey((key) => key + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Aggiornamento non riuscito."); } finally { setBusy(false); }
  }

  function openPayment(voucher: Voucher) {
    const paid = voucher.payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
    const balance = voucher.purchase_price_cents - paid;
    setEditing(voucher);
    setPaymentForm({ amountEuros: balance > 0 ? String(balance / 100) : "", paidAt: new Date().toISOString().slice(0, 10), methodId: methods[0]?.id ?? "" });
    setPaymentError(null);
    setDialog("payment");
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; setBusy(true); setPaymentError(null);
    try {
      const response = await fetch(`/api/vouchers/${editing.id}/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(paymentForm) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setDialog(null); setEditing(null); setRefreshKey((key) => key + 1);
    } catch (reason) { setPaymentError(reason instanceof Error ? reason.message : "Registrazione non riuscita."); } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-[#d8d0c5] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold sm:text-4xl">Buoni regalo</h1>
            <p className="mt-2 text-sm text-[#675f57]">Emissione, vendita e stato dei buoni.</p>
          </div>
          <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white" onClick={openNew} type="button">Nuovo buono</button>
        </header>

        <div className="mt-7 flex items-end justify-between">
          <label className="flex flex-col gap-2 text-sm font-medium">Stato
            <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => updateStatusFilter(e.target.value)} value={statusFilter}>
              <option value="">Tutti</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>

        {error && !dialog ? <p className="mt-5 text-sm text-[#a53e31]">{error}</p> : null}

        <section className="mt-5 overflow-hidden border border-[#d8d0c5] bg-white">
          <div className="grid grid-cols-[0.8fr_0.9fr_0.9fr_0.9fr_0.8fr_0.7fr_150px] gap-3 bg-[#eee8df] px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#675f57]">
            <span>Codice</span><span>Tipo</span><span>Acquirente</span><span>Beneficiario</span><span>Scadenza</span><span>Stato</span><span>Azioni</span>
          </div>
          {loading ? <p className="p-8 text-sm text-[#675f57]">Caricamento buoni...</p> : vouchers.length === 0 ? <p className="p-10 text-center text-sm text-[#675f57]">Nessun buono da mostrare.</p> : vouchers.map((voucher) => {
            const paid = voucher.payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
            const balance = voucher.purchase_price_cents - paid;
            return (
              <article className="grid grid-cols-[0.8fr_0.9fr_0.9fr_0.9fr_0.8fr_0.7fr_150px] items-center gap-3 border-t border-[#eee8df] px-5 py-4 text-left text-sm" key={voucher.id}>
                <Link className="contents hover:underline" href={`/vouchers/${voucher.id}`}>
                  <span className="font-semibold">{voucher.code}</span>
                  <span>{voucher.voucher_type === "value" ? euro.format((voucher.value_cents ?? 0) / 100) : `Sessione ${voucher.service_name ?? ""}`}</span>
                  <span className="min-w-0 truncate">{voucher.purchaser ? `${voucher.purchaser.first_name} ${voucher.purchaser.last_name}` : "-"}</span>
                  <span className="min-w-0 truncate">{voucher.recipient ? `${voucher.recipient.first_name} ${voucher.recipient.last_name}` : "-"}</span>
                  <span>{dateOnly.format(new Date(voucher.expires_at))}</span>
                  <span>{statusLabels[voucher.status] ?? voucher.status}</span>
                </Link>
                <span className="flex justify-start gap-2">
                  {balance > 0 ? <button className="border border-[#cfc5b8] px-2 py-1 text-xs font-semibold hover:bg-[#eee8df]" onClick={() => openPayment(voucher)} type="button">Pagamento</button> : null}
                  {voucher.status === "active" ? (
                    <button
                      aria-label="Assegna beneficiario"
                      className="grid size-8 place-items-center border border-[#cfc5b8] hover:bg-[#eee8df]"
                      onClick={() => openRecipient(voucher)}
                      title="Assegna beneficiario"
                      type="button"
                    >
                      <UserPlusIcon />
                    </button>
                  ) : null}
                </span>
              </article>
            );
          })}
        </section>
      </section>

      {dialog === "new" ? (
        <div aria-modal="true" className="fixed inset-0 z-10 grid place-items-center bg-[#27231f]/45 p-4" role="dialog">
          <form className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto bg-[#fdfbf8] p-6 shadow-xl" onSubmit={submitNew}>
            <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">Nuovo buono</h2><button aria-label="Chiudi" className="size-9 border border-[#cfc5b8]" onClick={() => setDialog(null)} type="button">x</button></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">Codice<input className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setForm({ ...form, code: e.target.value })} required value={form.code} /></label>
              <label className="flex flex-col gap-2 text-sm font-medium">Tipo
                <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setForm({ ...form, voucherType: e.target.value, serviceTypeId: "", valueEuros: "", purchaseEuros: "" })} value={form.voucherType}>
                  <option value="value">A valore</option>
                  <option value="service">A sessione</option>
                </select>
              </label>
              <ClientCombobox clients={clients} onChange={(clientId) => setForm({ ...form, purchaserClientId: clientId })} value={form.purchaserClientId} />
              <ClientCombobox clients={clients} emptyLabel="Da assegnare" label="Beneficiario (facoltativo)" onChange={(clientId) => setForm({ ...form, recipientClientId: clientId })} required={false} value={form.recipientClientId} />
              {form.voucherType === "value" ? (
                <label className="flex flex-col gap-2 text-sm font-medium">Valore (EUR)<input className="h-11 border border-[#cfc5b8] bg-white px-3" min="1" onChange={(e) => setForm({ ...form, valueEuros: e.target.value })} required type="number" value={form.valueEuros} /></label>
              ) : (
                <>
                  <label className="flex flex-col gap-2 text-sm font-medium">Servizio
                    <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setForm({ ...form, serviceTypeId: e.target.value })} required value={form.serviceTypeId}>
                      <option value="">Seleziona</option>
                      {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium">Prezzo di acquisto (EUR)<input className="h-11 border border-[#cfc5b8] bg-white px-3" min="1" onChange={(e) => setForm({ ...form, purchaseEuros: e.target.value })} required type="number" value={form.purchaseEuros} /></label>
                </>
              )}
              <label className="flex flex-col gap-2 text-sm font-medium">Metodo di pagamento
                <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setForm({ ...form, purchaseMethodId: e.target.value })} required value={form.purchaseMethodId}>
                  <option value="">Seleziona</option>
                  {methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Data acquisto<input className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setForm({ ...form, purchasedAt: e.target.value })} required type="date" value={form.purchasedAt} /></label>
            </div>
            <p className="mt-3 text-xs text-[#675f57]">La scadenza sara calcolata automaticamente in base alla validita configurata. L&apos;acquisto genera un pagamento con causale &quot;Pagamento completo&quot;.</p>
            {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button className="h-11 px-4 text-sm font-semibold" onClick={() => setDialog(null)} type="button">Annulla</button>
              <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? "Salvataggio..." : "Salva buono"}</button>
            </div>
          </form>
        </div>
      ) : null}

      {dialog === "recipient" ? (
        <div aria-modal="true" className="fixed inset-0 z-10 grid place-items-center bg-[#27231f]/45 p-4" role="dialog">
          <form className="w-full max-w-md bg-[#fdfbf8] p-6 shadow-xl" onSubmit={submitRecipient}>
            <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">Beneficiario</h2><button aria-label="Chiudi" className="size-9 border border-[#cfc5b8]" onClick={() => { setDialog(null); setEditing(null); }} type="button">x</button></div>
            <div className="mt-6">
              <ClientCombobox clients={clients} emptyLabel="Nessuno" label="Cliente beneficiario" onChange={setRecipientValue} required={false} value={recipientValue} />
            </div>
            {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button className="h-11 px-4 text-sm font-semibold" onClick={() => { setDialog(null); setEditing(null); }} type="button">Annulla</button>
              <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">Salva</button>
            </div>
          </form>
        </div>
      ) : null}

      {dialog === "payment" ? (
        <div aria-modal="true" className="fixed inset-0 z-10 grid place-items-center bg-[#27231f]/45 p-4" role="dialog">
          <form className="w-full max-w-md bg-[#fdfbf8] p-6 shadow-xl" onSubmit={submitPayment}>
            <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">Registra pagamento</h2><button aria-label="Chiudi" className="size-9 border border-[#cfc5b8]" onClick={() => { setDialog(null); setEditing(null); }} type="button">x</button></div>
            <label className="mt-6 flex flex-col gap-2 text-sm font-medium">Importo (EUR)
              <input className="h-11 border border-[#cfc5b8] bg-white px-3" min="1" onChange={(e) => setPaymentForm({ ...paymentForm, amountEuros: e.target.value })} required type="number" value={paymentForm.amountEuros} />
            </label>
            <label className="mt-4 flex flex-col gap-2 text-sm font-medium">Data
              <input className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setPaymentForm({ ...paymentForm, paidAt: e.target.value })} required type="date" value={paymentForm.paidAt} />
            </label>
            <label className="mt-4 flex flex-col gap-2 text-sm font-medium">Metodo
              <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setPaymentForm({ ...paymentForm, methodId: e.target.value })} required value={paymentForm.methodId}>
                <option value="">Seleziona</option>
                {methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
              </select>
            </label>
            {paymentError ? <p className="mt-4 text-sm text-[#a53e31]">{paymentError}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button className="h-11 px-4 text-sm font-semibold" onClick={() => { setDialog(null); setEditing(null); }} type="button">Annulla</button>
              <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? "Salvataggio..." : "Salva pagamento"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function UserPlusIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 8a6 6 0 0 1 6-6h1M17 8v6M14 11h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
