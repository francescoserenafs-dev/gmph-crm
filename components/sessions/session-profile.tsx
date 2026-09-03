"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AuditLogPanel } from "@/components/shared/audit-log-panel";
import { ActionMenu } from "@/components/shared/action-menu";
import { DuplicateIcon } from "@/components/shared/icons";
import { Modal } from "@/components/shared/modal";

type Payment = {
  id: string;
  amount_cents: number;
  paid_at: string | null;
  paid_date: string | null;
  category: string;
  payment_method_name: string;
  applied_voucher_id: string | null;
  reference: string | null;
  notes: string | null;
};

type StageEvent = { id: string; stage_name: string; changed_at: string; notes: string | null };

type Extra = { id: string; service_type_id: string; service_name: string; price_cents: number; notes: string | null; created_at: string };

type Session = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  service_name: string;
  service_detail: string | null;
  notes: string | null;
  agreed_price_cents: number;
  is_settled: boolean;
  current_stage: { id: string; name: string; code: string } | null;
  client: { id: string; first_name: string; last_name: string } | null;
  payments: Payment[];
  stage_history: StageEvent[];
  extras: Extra[];
  image_consent_granted_at: string | null;
  image_consent_revoked_at: string | null;
};

type Stage = { id: string; name: string; code: string };
type Method = { id: string; name: string };
type AddonService = { id: string; name: string };
type EligibleVoucher = { id: string; code: string; voucher_type: "service" | "value"; service_name: string | null; value_cents: number | null; purchase_price_cents: number | null };

const dateTime = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" });
const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

const categoryLabels: Record<string, string> = {
  deposit: "Caparra",
  balance: "Saldo",
  full_payment: "Pagamento completo",
  voucher_purchase: "Pagamento completo",
  voucher_redemption: "Utilizzo buono regalo",
};

function toLocalInput(iso: string) {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function SessionProfile({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openExtrasDialogOnMount = searchParams.get("extras") === "1";
  const [session, setSession] = useState<Session | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [addonServices, setAddonServices] = useState<AddonService[]>([]);
  const [eligibleVouchers, setEligibleVouchers] = useState<EligibleVoucher[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"stage" | "payment" | "delete" | "voucher" | "edit" | "extra" | null>(openExtrasDialogOnMount ? "extra" : null);
  const [busy, setBusy] = useState(false);

  const [stageForm, setStageForm] = useState({ stageId: "", changedAt: "", notes: "" });
  const [paymentForm, setPaymentForm] = useState({ amountEuros: "", paidAt: "", paidDate: "", methodId: "", category: "balance", notes: "" });
  const [editForm, setEditForm] = useState({ scheduledAt: "", durationMinutes: "", priceEuros: "", location: "", serviceDetail: "", notes: "" });
  const [extraForm, setExtraForm] = useState({ serviceTypeId: "", priceEuros: "", notes: "" });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [sessionRes, stagesRes, methodsRes] = await Promise.all([
          fetch(`/api/sessions/${sessionId}`),
          fetch("/api/sessions/options"),
          fetch("/api/payments/options"),
        ]);
        const sessionBody = await sessionRes.json();
        const stagesBody = await stagesRes.json();
        const methodsBody = await methodsRes.json();
        if (!active) return;
        if (!sessionRes.ok) throw new Error(sessionBody.error);
        setSession(sessionBody.session as Session);
        if (stagesRes.ok) { setStages(stagesBody.stages); setAddonServices(stagesBody.addonServices ?? []); }
        if (methodsRes.ok) setMethods(methodsBody.methods);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Caricamento non riuscito.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [sessionId, refreshKey]);

  // Auto-open extras dialog if query param is set
  useEffect(() => {
    if (openExtrasDialogOnMount && session && addonServices.length > 0 && dialog === "extra") {
      setExtraForm({ serviceTypeId: addonServices[0]?.id ?? "", priceEuros: "", notes: "" });
    }
  }, [openExtrasDialogOnMount, session, addonServices, dialog]);

  const paid = session?.payments.reduce((sum, payment) => sum + payment.amount_cents, 0) ?? 0;
  const extrasTotal = session?.extras.reduce((sum, extra) => sum + extra.price_cents, 0) ?? 0;
  const due = (session?.agreed_price_cents ?? 0) + extrasTotal;
  const balance = due - paid;
  const isCancelled = session?.current_stage?.code === "cancelled";
  const hasPayments = (session?.payments.length ?? 0) > 0;
  const imageConsentActive = session?.image_consent_granted_at != null && session.image_consent_revoked_at == null;

  function openExtraDialog() {
    setExtraForm({ serviceTypeId: addonServices[0]?.id ?? "", priceEuros: "", notes: "" });
    setError(null);
    setDialog("extra");
  }

  async function submitExtra(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/extras`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(extraForm) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setDialog(null); setRefreshKey((key) => key + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Aggiunta extra non riuscita."); } finally { setBusy(false); }
  }

  async function deleteExtra(extraId: string) {
    if (!confirm("Rimuovere questo extra dalla sessione?")) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/extras/${extraId}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setRefreshKey((key) => key + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Rimozione non riuscita."); } finally { setBusy(false); }
  }

  async function toggleImageConsent(granted: boolean) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateImageConsent", granted }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setSession(body.session as Session);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Aggiornamento del consenso non riuscito."); } finally { setBusy(false); }
  }

  function openStageDialog() {
    setStageForm({ stageId: session?.current_stage?.id ?? "", changedAt: toLocalInput(new Date().toISOString()), notes: "" });
    setError(null);
    setDialog("stage");
  }

  function openPaymentDialog() {
    setPaymentForm({ amountEuros: "", paidAt: "", paidDate: new Date().toISOString().slice(0, 10), methodId: methods[0]?.id ?? "", category: "balance", notes: "" });
    setError(null);
    setDialog("payment");
  }

  function openEditDialog() {
    if (!session) return;
    setEditForm({
      scheduledAt: toLocalInput(session.scheduled_at),
      durationMinutes: String(session.duration_minutes),
      priceEuros: String(session.agreed_price_cents / 100),
      location: session.location ?? "",
      serviceDetail: session.service_detail ?? "",
      notes: session.notes ?? "",
    });
    setError(null);
    setDialog("edit");
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setDialog(null);
      setRefreshKey((key) => key + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Aggiornamento non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  async function openVoucherDialog() {
    setError(null);
    setSelectedVoucher("");
    setDialog("voucher");
    try {
      const response = await fetch(`/api/sessions/${sessionId}/eligible-vouchers`);
      const body = await response.json();
      if (response.ok) setEligibleVouchers(body.vouchers as EligibleVoucher[]);
    } catch {
      setEligibleVouchers([]);
    }
  }

  async function submitVoucher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const voucher = eligibleVouchers.find((item) => item.id === selectedVoucher);
    const totalDueCents = (session?.agreed_price_cents ?? 0) + (session?.extras ?? []).reduce((sum, extra) => sum + extra.price_cents, 0);
    const voucherAmountCents = voucher?.voucher_type === "value" ? voucher.value_cents ?? 0 : voucher?.purchase_price_cents ?? 0;
    const confirmOverage = voucherAmountCents > totalDueCents
      ? window.confirm(`Si sta applicando un buono regalo del valore ${euro.format(voucherAmountCents / 100)} a fronte di una sessione da ${euro.format(totalDueCents / 100)}. Vuoi proseguire comunque?`)
      : false;
    if (voucherAmountCents > totalDueCents && !confirmOverage) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/redeem`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voucherId: selectedVoucher, confirmOverage }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setDialog(null);
      setRefreshKey((key) => key + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Applicazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function submitStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateStage", ...stageForm }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setDialog(null);
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
    setError(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(paymentForm) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setDialog(null);
      setRefreshKey((key) => key + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Registrazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePayment(paymentId: string, isVoucher: boolean) {
    if (!window.confirm(isVoucher ? "Eliminare il pagamento? Il buono verra riattivato." : "Eliminare il pagamento?")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/payments/${paymentId}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setRefreshKey((key) => key + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Eliminazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSession() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      router.push("/sessions");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Eliminazione non riuscita.");
      setBusy(false);
    }
  }

  if (loading) return <main className="p-8 text-sm text-[#675f57]">Caricamento sessione...</main>;
  if (!session) return <main className="p-8"><p className="text-sm text-[#a53e31]">{error ?? "Sessione non trovata."}</p><Link className="mt-4 inline-block text-sm font-semibold text-[#9b5d43]" href="/sessions">Torna alle sessioni</Link></main>;

  const orderedPayments = [...session.payments].sort((a, b) => {
    const dateA = a.paid_at ? new Date(a.paid_at).getTime() : new Date(a.paid_date + "T00:00:00").getTime();
    const dateB = b.paid_at ? new Date(b.paid_at).getTime() : new Date(b.paid_date + "T00:00:00").getTime();
    return dateB - dateA;
  });
  const orderedStages = [...session.stage_history].sort((a, b) => b.changed_at.localeCompare(a.changed_at));

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-4xl">
        <Link className="text-sm font-semibold text-[#9b5d43] hover:underline" href="/sessions">Tutte le sessioni</Link>
        <header className="mt-6 flex flex-col gap-4 border-b border-[#d8d0c5] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#9b5d43]">Scheda sessione</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{session.service_name}{session.service_detail ? ` - ${session.service_detail}` : ""}</h1>
            <p className="mt-2 text-sm text-[#675f57]">{session.client ? <Link className="font-medium text-[#9b5d43] hover:underline" href={`/clients/${session.client.id}`}>{session.client.first_name} {session.client.last_name}</Link> : "Cliente non disponibile"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isCancelled ? <button className="h-11 bg-[#9b5d43] px-4 text-sm font-semibold text-white" onClick={openPaymentDialog} type="button">Aggiungi pagamento</button> : null}
            <button className="hidden h-11 border border-[#cfc5b8] px-4 text-sm font-semibold hover:bg-[#eee8df] sm:inline-flex sm:items-center" onClick={openEditDialog} type="button">Modifica</button>
            <button className="hidden h-11 border border-[#cfc5b8] px-4 text-sm font-semibold hover:bg-[#eee8df] sm:inline-flex sm:items-center" onClick={openStageDialog} type="button">Aggiorna avanzamento</button>
            {!isCancelled ? <button className="hidden h-11 border border-[#9b5d43] px-4 text-sm font-semibold text-[#9b5d43] hover:bg-[#f1e3db] sm:inline-flex sm:items-center" onClick={openVoucherDialog} type="button">Applica buono</button> : null}
            <button
              aria-label="Duplica sessione"
              className="hidden size-11 place-items-center border border-[#cfc5b8] hover:bg-[#eee8df] sm:grid"
              onClick={() => router.push(`/sessions?duplicate=${session.id}`)}
              title="Duplica sessione"
              type="button"
            >
              <DuplicateIcon />
            </button>
            <button className="hidden h-11 border border-[#a53e31] px-4 text-sm font-semibold text-[#a53e31] hover:bg-[#fff1ef] sm:inline-flex sm:items-center" onClick={() => { setError(null); setDialog("delete"); }} type="button">Elimina</button>
            <div className="sm:hidden">
              <ActionMenu
                items={[
                  { label: "Modifica", onClick: openEditDialog },
                  { label: "Aggiorna avanzamento", onClick: openStageDialog },
                  ...(!isCancelled ? [{ label: "Applica buono", onClick: openVoucherDialog }] : []),
                  ...(!isCancelled ? [{ label: "Aggiungi extra", onClick: openExtraDialog }] : []),
                  { label: "Duplica sessione", onClick: () => router.push(`/sessions?duplicate=${session.id}`) },
                  { label: "Elimina", onClick: () => { setError(null); setDialog("delete"); }, destructive: true },
                ]}
              />
            </div>
          </div>
        </header>

        {error && !dialog ? <p className="mt-5 text-sm text-[#a53e31]">{error}</p> : null}

        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Data e ora">{dateTime.format(new Date(session.scheduled_at))}</Card>
          <Card label="Durata">{session.duration_minutes} min</Card>
          <Card label="Prezzo concordato">{euro.format(session.agreed_price_cents / 100)}</Card>
          <Card label="Saldo residuo">{euro.format(balance / 100)}</Card>
          <Card label="Avanzamento">{session.current_stage?.name ?? "-"}</Card>
          <Card label="Luogo">{session.location ?? "-"}</Card>
          <Card label="Incassato">{euro.format(paid / 100)}</Card>
          <Card label="Stato pagamento">{due === 0 ? "Saldata" : paid === 0 ? "Da saldare" : paid < due ? "Parzialmente pagata" : "Saldata"}</Card>
        </div>

        {session.notes ? <p className="mt-6 border-l-2 border-[#d8d0c5] bg-white px-4 py-3 text-sm text-[#514a43]">{session.notes}</p> : null}

        <section className="mt-6 flex items-center justify-between border border-[#d8d0c5] bg-white px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">Consenso utilizzo immagini</p>
            <p className="mt-1 text-sm font-medium">{imageConsentActive ? "Concesso" : "Non concesso"}</p>
          </div>
          <button className="h-10 border border-[#9b5d43] px-4 text-sm font-semibold text-[#9b5d43] hover:bg-[#f1e3db] disabled:opacity-60" disabled={busy} onClick={() => toggleImageConsent(!imageConsentActive)} type="button">
            {imageConsentActive ? "Revoca consenso" : "Concedi consenso"}
          </button>
        </section>

        <section className="mt-9">
          <h2 className="text-lg font-semibold">Avanzamento</h2>
          <div className="mt-4 bg-white p-6 border border-[#d8d0c5]">
            <StageTimeline allStages={stages} currentStageId={session.current_stage?.id} stageHistory={session.stage_history} />
          </div>
        </section>

        <section className="mt-9">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Extra</h2>
            {!isCancelled ? <button className="text-sm font-semibold text-[#9b5d43] hover:underline" onClick={openExtraDialog} type="button">Aggiungi extra</button> : null}
          </div>
          <div className="mt-4 overflow-hidden border border-[#d8d0c5] bg-white">
            {session.extras.length === 0 ? <p className="p-6 text-sm text-[#675f57]">Nessun extra collegato a questa sessione.</p> : session.extras.map((extra) => (
              <article className="flex items-center justify-between gap-4 border-b border-[#eee8df] px-5 py-4 last:border-b-0" key={extra.id}>
                <div>
                  <p className="text-sm font-semibold">{extra.service_name} - {euro.format(extra.price_cents / 100)}</p>
                  {extra.notes ? <p className="mt-1 text-xs text-[#675f57]">{extra.notes}</p> : null}
                </div>
                <button className="text-sm font-semibold text-[#a53e31] hover:underline disabled:opacity-50" disabled={busy} onClick={() => deleteExtra(extra.id)} type="button">Elimina</button>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-9">
          <h2 className="text-lg font-semibold">Pagamenti</h2>
          <div className="mt-4 overflow-hidden border border-[#d8d0c5] bg-white">
            {orderedPayments.length === 0 ? <p className="p-6 text-sm text-[#675f57]">Nessun pagamento registrato.</p> : orderedPayments.map((payment) => (
              <article className="flex items-center justify-between gap-4 border-b border-[#eee8df] px-5 py-4 last:border-b-0" key={payment.id}>
                <div>
                  <p className="text-sm font-semibold">{euro.format(payment.amount_cents / 100)} - {categoryLabels[payment.category] ?? payment.category}</p>
                  <p className="mt-1 text-xs text-[#675f57]">{payment.paid_date ? dateOnly.format(new Date(payment.paid_date + "T00:00:00")) : dateOnly.format(new Date(payment.paid_at!))} - {payment.payment_method_name}</p>
                </div>
                <button className="text-sm font-semibold text-[#a53e31] hover:underline disabled:opacity-50" disabled={busy} onClick={() => deletePayment(payment.id, Boolean(payment.applied_voucher_id))} type="button">Elimina</button>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-9">
          <h2 className="text-lg font-semibold">Timeline avanzamenti</h2>
          <div className="mt-4 space-y-3">
            {orderedStages.map((event) => (
              <div className="border-l-2 border-[#9b5d43] bg-white px-4 py-3" key={event.id}>
                <p className="text-sm font-semibold">{event.stage_name}</p>
                <p className="mt-1 text-xs text-[#675f57]">{dateTime.format(new Date(event.changed_at))}</p>
                {event.notes ? <p className="mt-1 text-sm text-[#514a43]">{event.notes}</p> : null}
              </div>
            ))}
          </div>
        </section>

        <AuditLogPanel recordId={session.id} table="sessions" />
      </section>

      {dialog === "edit" ? (
        <Modal onClose={() => setDialog(null)} title="Modifica sessione">
          <form onSubmit={submitEdit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">Data e ora
                <input className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setEditForm({ ...editForm, scheduledAt: e.target.value })} required type="datetime-local" value={editForm.scheduledAt} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Durata (minuti)
                <input className="h-11 border border-[#cfc5b8] bg-white px-3" min="1" onChange={(e) => setEditForm({ ...editForm, durationMinutes: e.target.value })} required type="number" value={editForm.durationMinutes} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Prezzo concordato (EUR)
                <input className="h-11 border border-[#cfc5b8] bg-white px-3" min="0" onChange={(e) => setEditForm({ ...editForm, priceEuros: e.target.value })} required type="number" value={editForm.priceEuros} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Luogo
                <input className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} value={editForm.location} />
              </label>
              {session.service_name === "Altro" ? (
                <label className="flex flex-col gap-2 text-sm font-medium">Specifica il servizio
                  <input className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setEditForm({ ...editForm, serviceDetail: e.target.value })} required value={editForm.serviceDetail} />
                </label>
              ) : null}
            </div>
            <label className="mt-4 flex flex-col gap-2 text-sm font-medium">Note
              <textarea className="min-h-20 border border-[#cfc5b8] bg-white p-3" onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} value={editForm.notes} />
            </label>
            {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
            <ModalActions busy={busy} onCancel={() => setDialog(null)} submitLabel="Salva modifiche" />
          </form>
        </Modal>
      ) : null}

      {dialog === "stage" ? (
        <Modal onClose={() => setDialog(null)} title="Aggiorna avanzamento">
          <form onSubmit={submitStage}>
            <label className="flex flex-col gap-2 text-sm font-medium">Avanzamento
              <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setStageForm({ ...stageForm, stageId: e.target.value })} required value={stageForm.stageId}>
                <option value="">Seleziona</option>
                {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
              </select>
            </label>
            <label className="mt-4 flex flex-col gap-2 text-sm font-medium">Data e ora
              <input className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setStageForm({ ...stageForm, changedAt: e.target.value })} required type="datetime-local" value={stageForm.changedAt} />
            </label>
            <label className="mt-4 flex flex-col gap-2 text-sm font-medium">Nota
              <textarea className="min-h-20 border border-[#cfc5b8] bg-white p-3" onChange={(e) => setStageForm({ ...stageForm, notes: e.target.value })} value={stageForm.notes} />
            </label>
            {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
            <ModalActions busy={busy} onCancel={() => setDialog(null)} submitLabel="Salva avanzamento" />
          </form>
        </Modal>
      ) : null}

      {dialog === "payment" ? (
        <Modal onClose={() => setDialog(null)} title="Aggiungi pagamento">
          <form onSubmit={submitPayment}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">Importo (EUR)
                <input className="h-11 border border-[#cfc5b8] bg-white px-3" min="1" onChange={(e) => setPaymentForm({ ...paymentForm, amountEuros: e.target.value })} required type="number" value={paymentForm.amountEuros} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Data del pagamento
                <input className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setPaymentForm({ ...paymentForm, paidDate: e.target.value })} required type="date" value={paymentForm.paidDate} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Metodo
                <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setPaymentForm({ ...paymentForm, methodId: e.target.value })} required value={paymentForm.methodId}>
                  <option value="">Seleziona</option>
                  {methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Causale
                <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setPaymentForm({ ...paymentForm, category: e.target.value })} required value={paymentForm.category}>
                  <option value="deposit">Caparra</option>
                  <option value="balance">Saldo</option>
                  <option value="full_payment">Pagamento completo</option>
                </select>
              </label>
            </div>
            <label className="mt-4 flex flex-col gap-2 text-sm font-medium">Note
              <textarea className="min-h-20 border border-[#cfc5b8] bg-white p-3" onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} value={paymentForm.notes} />
            </label>
            {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
            <ModalActions busy={busy} onCancel={() => setDialog(null)} submitLabel="Salva pagamento" />
          </form>
        </Modal>
      ) : null}

      {dialog === "voucher" ? (
        <Modal onClose={() => setDialog(null)} title="Applica buono">
          <form onSubmit={submitVoucher}>
            {eligibleVouchers.length === 0 ? (
              <p className="text-sm text-[#675f57]">Nessun buono attivo e compatibile con questa sessione.</p>
            ) : (
              <label className="flex flex-col gap-2 text-sm font-medium">Buono compatibile
                <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setSelectedVoucher(e.target.value)} required value={selectedVoucher}>
                  <option value="">Seleziona</option>
                  {eligibleVouchers.map((voucher) => <option key={voucher.id} value={voucher.id}>{voucher.code} - {voucher.voucher_type === "value" ? euro.format((voucher.value_cents ?? 0) / 100) : `Sessione ${voucher.service_name ?? ""} (${euro.format((voucher.purchase_price_cents ?? 0) / 100)})`}</option>)}
                </select>
              </label>
            )}
            <p className="mt-3 text-xs text-[#675f57]">Un buono a valore copre il suo importo; un buono a sessione copre l&apos;intero prezzo concordato. L&apos;eventuale differenza va saldata con altri pagamenti.</p>
            {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button className="h-11 px-4 text-sm font-semibold" onClick={() => setDialog(null)} type="button">Annulla</button>
              <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || eligibleVouchers.length === 0} type="submit">{busy ? "Applicazione..." : "Applica buono"}</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {dialog === "extra" ? (
        <Modal onClose={() => setDialog(null)} title="Aggiungi extra">
          <form onSubmit={submitExtra}>
            {addonServices.length === 0 ? (
              <p className="text-sm text-[#675f57]">Nessun servizio extra configurato. Aggiungine uno in Configurazione.</p>
            ) : (
              <>
                <label className="flex flex-col gap-2 text-sm font-medium">Servizio extra
                  <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setExtraForm({ ...extraForm, serviceTypeId: e.target.value })} required value={extraForm.serviceTypeId}>
                    <option value="">Seleziona</option>
                    {addonServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                  </select>
                </label>
                <label className="mt-4 flex flex-col gap-2 text-sm font-medium">Prezzo (EUR)
                  <input className="h-11 border border-[#cfc5b8] bg-white px-3" min="0" onChange={(e) => setExtraForm({ ...extraForm, priceEuros: e.target.value })} required type="number" value={extraForm.priceEuros} />
                </label>
                <label className="mt-4 flex flex-col gap-2 text-sm font-medium">Note (facoltativo)
                  <input className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setExtraForm({ ...extraForm, notes: e.target.value })} value={extraForm.notes} />
                </label>
              </>
            )}
            {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button className="h-11 px-4 text-sm font-semibold" onClick={() => setDialog(null)} type="button">Annulla</button>
              <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || addonServices.length === 0} type="submit">{busy ? "Salvataggio..." : "Aggiungi extra"}</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {dialog === "delete" ? (
        <Modal onClose={() => setDialog(null)} title={hasPayments ? "Impossibile eliminare" : "Elimina sessione?"}>
          {hasPayments ? (
            <div>
              <p className="text-sm leading-6 text-[#675f57]">La sessione ha pagamenti collegati e non puo essere eliminata. Elimina prima i pagamenti dalla lista qui sopra, oppure annulla la sessione cambiando avanzamento.</p>
              <div className="mt-6 flex justify-end"><button className="h-11 px-4 text-sm font-semibold" onClick={() => setDialog(null)} type="button">Chiudi</button></div>
            </div>
          ) : (
            <div>
              <p className="text-sm leading-6 text-[#675f57]">Questa azione elimina definitivamente la sessione e il suo storico di avanzamenti.</p>
              {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
              <div className="mt-6 flex justify-end gap-3">
                <button className="h-11 px-4 text-sm font-semibold" disabled={busy} onClick={() => setDialog(null)} type="button">Annulla</button>
                <button className="h-11 bg-[#a53e31] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={deleteSession} type="button">Elimina sessione</button>
              </div>
            </div>
          )}
        </Modal>
      ) : null}
    </main>
  );
}

function StageTimeline({ allStages, currentStageId, stageHistory }: { allStages: Stage[]; currentStageId: string | undefined; stageHistory: StageEvent[] }) {
  const stageColorMap: Record<string, string> = {
    booked: "#9b5d43",
    in_progress: "#c69214",
    completed: "#367e4a",
    cancelled: "#a53e31",
  };

  const completedStageIds = new Set(stageHistory.map((e) => e.id));

  return (
    <div>
      <div className="flex flex-wrap items-start gap-3 gap-y-6">
        {allStages.map((stage, index) => {
          const stageCode = stage.code?.toLowerCase().replace(/\s+/g, "_") ?? stage.name.toLowerCase().replace(/\s+/g, "_");
          const stageColor = stageColorMap[stageCode] || "#675f57";
          const isCompleted = completedStageIds.has(stage.id);
          const isCurrent = stage.id === currentStageId;
          const shouldFill = isCompleted || isCurrent;

          return (
            <div key={stage.id} className="flex flex-col items-center gap-2">
              <div
                className={`size-10 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  shouldFill ? "text-white" : "text-[#9b5d43]"
                }`}
                style={{
                  backgroundColor: shouldFill ? stageColor : "white",
                  borderColor: stageColor,
                }}
              >
                {index + 1}
              </div>
              <p className="text-xs font-semibold text-center w-20 leading-tight break-words line-clamp-2">
                {stage.name}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="border border-[#d8d0c5] bg-white px-4 py-3"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">{label}</p><p className="mt-1 text-sm font-medium">{children}</p></div>;
}

function ModalActions({ busy, onCancel, submitLabel }: { busy: boolean; onCancel: () => void; submitLabel: string }) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      <button className="h-11 px-4 text-sm font-semibold" onClick={onCancel} type="button">Annulla</button>
      <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? "Salvataggio..." : submitLabel}</button>
    </div>
  );
}
