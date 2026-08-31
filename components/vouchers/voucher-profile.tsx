"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ClientCombobox } from "@/components/shared/client-combobox";
import { AuditLogPanel } from "@/components/shared/audit-log-panel";

type Payment = { id: string; amount_cents: number; paid_at: string; payment_method_name: string; notes: string | null };
type Voucher = {
  id: string;
  code: string;
  voucher_type: "service" | "value";
  service_type_id: string | null;
  service_name: string | null;
  value_cents: number | null;
  purchase_price_cents: number;
  status: string;
  purchased_at: string;
  expires_at: string;
  notes: string | null;
  purchaser: { id: string; first_name: string; last_name: string } | null;
  recipient: { id: string; first_name: string; last_name: string } | null;
  payments: Payment[];
};
type Client = { id: string; first_name: string; last_name: string; email: string };
type Service = { id: string; name: string };
type Method = { id: string; name: string };

const dateOnly = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" });
const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const statusLabels: Record<string, string> = { active: "Attivo", redeemed: "Riscattato", expired: "Scaduto", cancelled: "Annullato" };

function toDateInput(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

export function VoucherProfile({ voucherId }: { voucherId: string }) {
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [editForm, setEditForm] = useState({
    code: "",
    recipientClientId: "",
    expiresAt: "",
    notes: "",
    voucherType: "value" as "service" | "value",
    serviceTypeId: "",
    valueEuros: "",
    purchaseEuros: "",
    purchasedAt: "",
  });
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amountEuros: "", paidAt: new Date().toISOString().slice(0, 10), methodId: "" });
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [voucherRes, optionsRes] = await Promise.all([
          fetch(`/api/vouchers/${voucherId}`),
          fetch("/api/vouchers/options"),
        ]);
        const voucherBody = await voucherRes.json();
        const optionsBody = await optionsRes.json();
        if (!active) return;
        if (!voucherRes.ok) throw new Error(voucherBody.error);
        setVoucher(voucherBody.voucher as Voucher);
        setEditForm({
          code: voucherBody.voucher.code,
          recipientClientId: voucherBody.voucher.recipient?.id ?? "",
          expiresAt: toDateInput(voucherBody.voucher.expires_at),
          notes: voucherBody.voucher.notes ?? "",
          voucherType: voucherBody.voucher.voucher_type,
          serviceTypeId: voucherBody.voucher.service_type_id ?? "",
          valueEuros: voucherBody.voucher.value_cents ? String(voucherBody.voucher.value_cents / 100) : "",
          purchaseEuros: String(voucherBody.voucher.purchase_price_cents / 100),
          purchasedAt: toDateInput(voucherBody.voucher.purchased_at),
        });
        if (optionsRes.ok) { setClients(optionsBody.clients); setServices(optionsBody.services); setMethods(optionsBody.methods); }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Caricamento non riuscito.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [voucherId, refreshKey]);

  const paid = voucher?.payments.reduce((sum, payment) => sum + payment.amount_cents, 0) ?? 0;
  const balance = (voucher?.purchase_price_cents ?? 0) - paid;

  function openPaymentDialog() {
    setPaymentForm({ amountEuros: balance > 0 ? String(balance / 100) : "", paidAt: new Date().toISOString().slice(0, 10), methodId: methods[0]?.id ?? "" });
    setPaymentError(null);
    setPaymentDialogOpen(true);
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/vouchers/${voucherId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editForm.code,
          recipientClientId: editForm.recipientClientId,
          expiresAt: editForm.expiresAt,
          notes: editForm.notes,
          voucherType: editForm.voucherType,
          serviceTypeId: editForm.serviceTypeId,
          valueEuros: editForm.valueEuros,
          purchaseEuros: editForm.purchaseEuros,
          purchasedAt: editForm.purchasedAt,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setRefreshKey((key) => key + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Aggiornamento non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setPaymentError(null);
    try {
      const response = await fetch(`/api/vouchers/${voucherId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentForm),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setPaymentDialogOpen(false);
      setRefreshKey((key) => key + 1);
    } catch (reason) {
      setPaymentError(reason instanceof Error ? reason.message : "Registrazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="p-8 text-sm text-[#675f57]">Caricamento buono...</main>;
  if (!voucher) return <main className="p-8"><p className="text-sm text-[#a53e31]">{error ?? "Buono non trovato."}</p><Link className="mt-4 inline-block text-sm font-semibold text-[#9b5d43]" href="/vouchers">Torna ai buoni</Link></main>;

  const orderedPayments = [...voucher.payments].sort((a, b) => b.paid_at.localeCompare(a.paid_at));

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-4xl">
        <Link className="text-sm font-semibold text-[#9b5d43] hover:underline" href="/vouchers">Tutti i buoni</Link>
        <header className="mt-6 flex flex-col gap-4 border-b border-[#d8d0c5] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#9b5d43]">Scheda buono</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{voucher.code}</h1>
            <p className="mt-2 text-sm text-[#675f57]">
              {voucher.purchaser ? `Acquistato da ${voucher.purchaser.first_name} ${voucher.purchaser.last_name}` : "Acquirente non disponibile"}
              {voucher.recipient ? ` - Beneficiario ${voucher.recipient.first_name} ${voucher.recipient.last_name}` : ""}
            </p>
          </div>
          {balance > 0 ? (
            <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white" onClick={openPaymentDialog} type="button">Registra pagamento</button>
          ) : null}
        </header>

        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Tipo">{voucher.voucher_type === "value" ? euro.format((voucher.value_cents ?? 0) / 100) : `Sessione ${voucher.service_name ?? ""}`}</Card>
          <Card label="Prezzo di acquisto">{euro.format(voucher.purchase_price_cents / 100)}</Card>
          <Card label="Incassato">{euro.format(paid / 100)}</Card>
          <Card label="Saldo residuo">{euro.format(balance / 100)}</Card>
          <Card label="Acquistato il">{dateOnly.format(new Date(voucher.purchased_at))}</Card>
          <Card label="Scadenza">{dateOnly.format(new Date(voucher.expires_at))}</Card>
          <Card label="Stato">{statusLabels[voucher.status] ?? voucher.status}</Card>
        </div>

        <form className="mt-8 bg-white p-5 sm:p-8" onSubmit={submitEdit}>
          <h2 className="text-lg font-semibold">Modifica buono</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium">Codice
              <input className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} required value={editForm.code} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">Tipo
              <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setEditForm({ ...editForm, voucherType: e.target.value as "service" | "value", serviceTypeId: "", valueEuros: "", purchaseEuros: "" })} value={editForm.voucherType}>
                <option value="value">A valore</option>
                <option value="service">A sessione</option>
              </select>
            </label>
            {editForm.voucherType === "value" ? (
              <label className="flex flex-col gap-2 text-sm font-medium">Valore (EUR)
                <input className="h-11 border border-[#cfc5b8] bg-white px-3" min="1" onChange={(e) => setEditForm({ ...editForm, valueEuros: e.target.value })} required type="number" value={editForm.valueEuros} />
              </label>
            ) : (
              <>
                <label className="flex flex-col gap-2 text-sm font-medium">Servizio
                  <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setEditForm({ ...editForm, serviceTypeId: e.target.value })} required value={editForm.serviceTypeId}>
                    <option value="">Seleziona</option>
                    {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">Prezzo di acquisto (EUR)
                  <input className="h-11 border border-[#cfc5b8] bg-white px-3" min="1" onChange={(e) => setEditForm({ ...editForm, purchaseEuros: e.target.value })} required type="number" value={editForm.purchaseEuros} />
                </label>
              </>
            )}
            <label className="flex flex-col gap-2 text-sm font-medium">Data acquisto
              <input className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setEditForm({ ...editForm, purchasedAt: e.target.value })} required type="date" value={editForm.purchasedAt} />
            </label>
            <ClientCombobox clients={clients} emptyLabel="Da assegnare" label="Beneficiario" onChange={(clientId) => setEditForm({ ...editForm, recipientClientId: clientId })} required={false} value={editForm.recipientClientId} />
            <label className="flex flex-col gap-2 text-sm font-medium">Scadenza
              <input className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })} required type="date" value={editForm.expiresAt} />
            </label>
          </div>
          <label className="mt-5 flex flex-col gap-2 text-sm font-medium">Note
            <textarea className="min-h-24 border border-[#cfc5b8] bg-white p-3" onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} value={editForm.notes} />
          </label>
          {error ? <p className="mt-5 text-sm text-[#a53e31]">{error}</p> : null}
          <div className="mt-7 flex justify-end">
            <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? "Salvataggio..." : "Salva modifiche"}</button>
          </div>
        </form>

        <section className="mt-9">
          <h2 className="text-lg font-semibold">Pagamenti</h2>
          <div className="mt-4 overflow-hidden border border-[#d8d0c5] bg-white">
            {orderedPayments.length === 0 ? <p className="p-6 text-sm text-[#675f57]">Nessun pagamento registrato.</p> : orderedPayments.map((payment) => (
              <article className="flex items-center justify-between gap-4 border-b border-[#eee8df] px-5 py-4 last:border-b-0" key={payment.id}>
                <div>
                  <p className="text-sm font-semibold">{euro.format(payment.amount_cents / 100)}</p>
                  <p className="mt-1 text-xs text-[#675f57]">{dateOnly.format(new Date(payment.paid_at))} - {payment.payment_method_name}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <AuditLogPanel recordId={voucher.id} table="gift_vouchers" />
      </section>

      {paymentDialogOpen ? (
        <div aria-modal="true" className="fixed inset-0 z-40 flex items-end justify-center bg-[#27231f]/45 sm:items-center sm:p-4" role="dialog">
          <form className="w-full max-w-md rounded-t-2xl bg-[#fdfbf8] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-none sm:pb-6" onSubmit={submitPayment}>
            <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">Registra pagamento</h2><button aria-label="Chiudi" className="size-9 border border-[#cfc5b8]" onClick={() => setPaymentDialogOpen(false)} type="button">x</button></div>
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
              <button className="h-11 px-4 text-sm font-semibold" onClick={() => setPaymentDialogOpen(false)} type="button">Annulla</button>
              <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? "Salvataggio..." : "Salva pagamento"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="border border-[#d8d0c5] bg-white px-4 py-3"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">{label}</p><p className="mt-1 text-sm font-medium">{children}</p></div>;
}
