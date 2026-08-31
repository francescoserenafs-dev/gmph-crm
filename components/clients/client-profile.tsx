"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AuditLogPanel } from "@/components/shared/audit-log-panel";
import { ActionMenu } from "@/components/shared/action-menu";
import { ArchiveIcon, TrashIcon } from "@/components/shared/icons";

type OverviewSession = { id: string; scheduled_at: string; service_name: string; agreed_price_cents: number; current_stage: { name: string; code: string } | null; payments: { amount_cents: number }[] };
type OverviewPayment = { id: string; amount_cents: number; paid_at: string; category: string; payment_method_name: string; session: { id: string; service_name: string } | null; voucher: { id: string; code: string } | null };
type OverviewVoucher = { id: string; code: string; voucher_type: "service" | "value"; service_name: string | null; value_cents: number | null; purchase_price_cents: number; status: string; expires_at: string; recipient: { id: string; first_name: string; last_name: string } | null };
type Method = { id: string; name: string };

type Client = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  birth_date: string | null;
  address: string | null;
  notes: string | null;
  is_archived: boolean;
  privacy_consent_granted_at: string | null;
  privacy_consent_revoked_at: string | null;
  created_at: string;
};

type ClientForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  address: string;
  notes: string;
  privacyConsentGranted: boolean;
};

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const clientDateFormatter = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" });
const sessionDateTime = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" });
const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const voucherStatusLabels: Record<string, string> = { active: "Attivo", redeemed: "Riscattato", expired: "Scaduto", cancelled: "Annullato" };
const paymentCategoryLabels: Record<string, string> = {
  deposit: "Caparra",
  balance: "Saldo",
  full_payment: "Pagamento completo",
  voucher_purchase: "Pagamento completo",
  voucher_redemption: "Utilizzo buono regalo",
};

function isConsentActive(grantedAt: string | null, revokedAt: string | null) {
  return grantedAt !== null && revokedAt === null;
}

function toForm(client: Client): ClientForm {
  return {
    firstName: client.first_name,
    lastName: client.last_name,
    email: client.email,
    phone: client.phone ?? "",
    birthDate: client.birth_date ?? "",
    address: client.address ?? "",
    notes: client.notes ?? "",
    privacyConsentGranted: isConsentActive(
      client.privacy_consent_granted_at,
      client.privacy_consent_revoked_at,
    ),
  };
}

export function ClientProfile({ clientId }: { clientId: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [sessions, setSessions] = useState<OverviewSession[]>([]);
  const [payments, setPayments] = useState<OverviewPayment[]>([]);
  const [vouchers, setVouchers] = useState<OverviewVoucher[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(searchParams.get("pay") === "1");
  const [paymentForm, setPaymentForm] = useState({ sessionId: "", amountEuros: "", paidAt: new Date().toISOString().slice(0, 10), methodId: "", category: "balance", notes: "" });
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [overviewKey, setOverviewKey] = useState(0);
  const [nowTs] = useState(() => Date.now());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLinked, setDeleteLinked] = useState<{ sessions: number; vouchers: number } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadClient() {
      try {
        const response = await fetch(`/api/clients/${clientId}`, { signal: controller.signal });
        const body = (await response.json()) as { client?: Client; error?: string };

        if (!response.ok || !body.client) {
          throw new Error(body.error ?? "Cliente non trovato.");
        }

        setClient(body.client);
        setForm(toForm(body.client));
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError(loadError instanceof Error ? loadError.message : "Cliente non trovato.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadClient();
    return () => controller.abort();
  }, [clientId]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [overviewRes, methodsRes] = await Promise.all([fetch(`/api/clients/${clientId}/overview`), fetch("/api/payments/options")]);
      const overviewBody = await overviewRes.json();
      const methodsBody = await methodsRes.json();
      if (!active) return;
      if (overviewRes.ok) { setSessions(overviewBody.sessions ?? []); setPayments(overviewBody.payments ?? []); setVouchers(overviewBody.vouchers ?? []); }
      if (methodsRes.ok) setMethods(methodsBody.methods ?? []);
    })().catch(() => {});
    return () => { active = false; };
  }, [clientId, overviewKey]);

  function openPaymentDialog() {
    setPaymentForm({ sessionId: "", amountEuros: "", paidAt: new Date().toISOString().slice(0, 10), methodId: methods[0]?.id ?? "", category: "balance", notes: "" });
    setPaymentError(null);
    setPaymentDialogOpen(true);
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setPaymentError(null);
    try {
      const response = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(paymentForm) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setPaymentDialogOpen(false);
      setOverviewKey((key) => key + 1);
    } catch (submitError) {
      setPaymentError(submitError instanceof Error ? submitError.message : "Registrazione non riuscita.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateForm<Key extends keyof ClientForm>(field: Key, value: ClientForm[Key]) {
    setForm((currentForm) => (currentForm ? { ...currentForm, [field]: value } : currentForm));
  }

  async function updateClient(body: unknown) {
    const response = await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const responseBody = (await response.json()) as { client?: Client; error?: string };

    if (!response.ok || !responseBody.client) {
      throw new Error(responseBody.error ?? "Non e stato possibile aggiornare il cliente.");
    }

    setClient(responseBody.client);
    setForm(toForm(responseBody.client));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;

    setIsSaving(true);
    setError(null);
    try {
      await updateClient(form);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Non e stato possibile aggiornare il cliente.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchive() {
    setIsSaving(true);
    setError(null);
    try {
      await updateClient({ action: "archive" });
      setIsArchiveDialogOpen(false);
    } catch (archiveError) {
      setError(
        archiveError instanceof Error ? archiveError.message : "Non e stato possibile archiviare il cliente.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRestore() {
    setIsSaving(true);
    setError(null);
    try {
      await updateClient({ action: "restore" });
    } catch (restoreError) {
      setError(
        restoreError instanceof Error ? restoreError.message : "Non e stato possibile ripristinare il cliente.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function openDeleteDialog() {
    setError(null);
    setDeleteLinked(null);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
      const body = await response.json();
      if (response.status === 409) {
        setDeleteLinked(body.linked ?? { sessions: 0, vouchers: 0 });
        return;
      }
      if (!response.ok) throw new Error(body.error);
      router.push("/clients");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Eliminazione non riuscita.");
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <main className="p-8 text-sm text-[#675f57]">Caricamento cliente...</main>;
  }

  if (!client || !form) {
    return (
      <main className="p-8">
        <p className="text-sm text-[#a53e31]">{error ?? "Cliente non trovato."}</p>
        <Link className="mt-4 inline-block text-sm font-semibold text-[#9b5d43]" href="/clients">
          Torna ai clienti
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-4xl">
        <Link className="text-sm font-semibold text-[#9b5d43] hover:underline" href="/clients">
          Tutti i clienti
        </Link>
        <header className="mt-6 flex flex-col gap-4 border-b border-[#d8d0c5] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#9b5d43]">
              Scheda cliente
            </p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
              {client.first_name} {client.last_name}
            </h1>
            <p className="mt-2 text-sm text-[#675f57]">
              Cliente dal {dateFormatter.format(new Date(client.created_at))}
            </p>
          </div>
          {client.is_archived ? (
            <div className="flex flex-wrap gap-2">
              <button
                className="h-11 border border-[#9b5d43] px-5 text-sm font-semibold text-[#9b5d43] disabled:opacity-60"
                disabled={isSaving}
                onClick={handleRestore}
                type="button"
              >
                Ripristina cliente
              </button>
              <button
                aria-label="Elimina cliente"
                className="grid size-11 place-items-center border border-[#a53e31] text-[#a53e31] hover:bg-[#fff1ef]"
                onClick={openDeleteDialog}
                title="Elimina cliente"
                type="button"
              >
                <TrashIcon />
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className="grid h-11 place-items-center bg-[#9b5d43] px-5 text-sm font-semibold text-white"
                href={`/sessions?newSession=${client.id}`}
              >
                Nuova sessione
              </Link>
              <button
                className="hidden h-11 border border-[#9b5d43] px-5 text-sm font-semibold text-[#9b5d43] hover:bg-[#f1e3db] sm:inline-flex sm:items-center"
                onClick={openPaymentDialog}
                type="button"
              >
                Registra pagamento
              </button>
              <Link
                className="hidden h-11 place-items-center border border-[#9b5d43] px-5 text-sm font-semibold text-[#9b5d43] sm:grid"
                href={`/vouchers?purchaser=${client.id}`}
              >
                Buoni regalo
              </Link>
              <button
                aria-label="Archivia cliente"
                className="hidden size-11 place-items-center border border-[#a53e31] text-[#a53e31] hover:bg-[#fff1ef] sm:grid"
                onClick={() => setIsArchiveDialogOpen(true)}
                title="Archivia cliente"
                type="button"
              >
                <ArchiveIcon />
              </button>
              <button
                aria-label="Elimina cliente"
                className="hidden size-11 place-items-center border border-[#a53e31] text-[#a53e31] hover:bg-[#fff1ef] sm:grid"
                onClick={openDeleteDialog}
                title="Elimina cliente"
                type="button"
              >
                <TrashIcon />
              </button>
              <div className="sm:hidden">
                <ActionMenu
                  items={[
                    { label: "Registra pagamento", onClick: openPaymentDialog },
                    { label: "Buoni regalo", onClick: () => router.push(`/vouchers?purchaser=${client.id}`) },
                    { label: "Archivia cliente", onClick: () => setIsArchiveDialogOpen(true) },
                    { label: "Elimina cliente", onClick: openDeleteDialog, destructive: true },
                  ]}
                />
              </div>
            </div>
          )}
        </header>

        {client.is_archived ? (
          <p className="mt-6 border-l-2 border-[#9b5d43] bg-[#f1e3db] px-4 py-3 text-sm text-[#514a43]">
            Questo cliente e archiviato e non verra proposto nelle nuove attivita.
          </p>
        ) : null}

        <form className="mt-8 bg-white p-5 sm:p-8" onSubmit={handleSubmit}>
          <h2 className="text-lg font-semibold">Dati anagrafici</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label="Nome" onChange={(value) => updateForm("firstName", value)} required value={form.firstName} />
            <Field label="Cognome" onChange={(value) => updateForm("lastName", value)} required value={form.lastName} />
            <Field inputMode="email" label="Email" onChange={(value) => updateForm("email", value)} required type="email" value={form.email} />
            <Field inputMode="tel" label="Cellulare" onChange={(value) => updateForm("phone", value)} type="tel" value={form.phone} />
            <Field label="Data di nascita" onChange={(value) => updateForm("birthDate", value)} type="date" value={form.birthDate} />
            <Field label="Indirizzo" onChange={(value) => updateForm("address", value)} value={form.address} />
          </div>

          <label className="mt-5 flex flex-col gap-2 text-sm font-medium">
            Note
            <textarea
              className="min-h-28 border border-[#cfc5b8] bg-white p-3 text-base outline-none focus:border-[#9b5d43] focus:ring-2 focus:ring-[#ead8ce]"
              onChange={(event) => updateForm("notes", event.target.value)}
              value={form.notes}
            />
          </label>

          <fieldset className="mt-7 border-t border-[#d8d0c5] pt-5">
            <legend className="text-lg font-semibold">Consensi</legend>
            <div className="mt-4 grid gap-4">
              <ConsentField checked={form.privacyConsentGranted} label="Trattamento dei dati personali" onChange={(value) => updateForm("privacyConsentGranted", value)} />
            </div>
          </fieldset>

          {error ? <p className="mt-5 text-sm text-[#a53e31]">{error}</p> : null}
          <div className="mt-8 flex justify-end">
            <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={isSaving} type="submit">
              {isSaving ? "Salvataggio..." : "Salva modifiche"}
            </button>
          </div>
        </form>

        <section className="mt-9">
          <h2 className="text-lg font-semibold">Sessioni</h2>
          <div className="mt-4 overflow-hidden border border-[#d8d0c5] bg-white">
            {sessions.length === 0 ? <p className="p-6 text-sm text-[#675f57]">Nessuna sessione collegata.</p> : sessions.map((session) => {
              const paid = session.payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
              const status = paid === 0 ? "Da saldare" : paid < session.agreed_price_cents ? "Parzialmente pagata" : "Saldata";
              const isFuture = new Date(session.scheduled_at).getTime() >= nowTs;
              return (
                <Link className="flex items-center justify-between gap-4 border-b border-[#eee8df] px-5 py-4 last:border-b-0 hover:bg-[#fbf7f2]" href={`/sessions/${session.id}`} key={session.id}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{sessionDateTime.format(new Date(session.scheduled_at))} - {session.service_name}</p>
                    <p className="mt-1 text-xs text-[#675f57]">{isFuture ? "In programma" : "Passata"} - {session.current_stage?.name ?? "-"} - {status}</p>
                  </div>
                  <span className="text-sm font-medium">{euro.format(session.agreed_price_cents / 100)}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-9">
          <h2 className="text-lg font-semibold">Pagamenti</h2>
          <div className="mt-4 overflow-hidden border border-[#d8d0c5] bg-white">
            {payments.length === 0 ? <p className="p-6 text-sm text-[#675f57]">Nessun pagamento collegato.</p> : payments.map((payment) => (
              <article className="flex items-center justify-between gap-4 border-b border-[#eee8df] px-5 py-4 last:border-b-0" key={payment.id}>
                <div>
                  <p className="text-sm font-semibold">{euro.format(payment.amount_cents / 100)} - {paymentCategoryLabels[payment.category] ?? payment.category}</p>
                  <p className="mt-1 text-xs text-[#675f57]">{clientDateFormatter.format(new Date(payment.paid_at))} - {payment.payment_method_name} - {payment.session ? payment.session.service_name : payment.voucher ? `Buono ${payment.voucher.code}` : "-"}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-9">
          <h2 className="text-lg font-semibold">Buoni regalo acquistati</h2>
          <div className="mt-4 overflow-hidden border border-[#d8d0c5] bg-white">
            {vouchers.length === 0 ? <p className="p-6 text-sm text-[#675f57]">Nessun buono acquistato.</p> : vouchers.map((voucher) => (
              <Link className="flex items-center justify-between gap-4 border-b border-[#eee8df] px-5 py-4 last:border-b-0 hover:bg-[#f5f1eb]" href={`/vouchers/${voucher.id}`} key={voucher.id}>
                <div>
                  <p className="text-sm font-semibold">{voucher.code} - {voucher.voucher_type === "value" ? euro.format((voucher.value_cents ?? 0) / 100) : `Sessione ${voucher.service_name ?? ""}`}</p>
                  <p className="mt-1 text-xs text-[#675f57]">
                    Beneficiario: {voucher.recipient ? `${voucher.recipient.first_name} ${voucher.recipient.last_name}` : "-"} - Scadenza: {clientDateFormatter.format(new Date(voucher.expires_at))} - {voucherStatusLabels[voucher.status] ?? voucher.status}
                  </p>
                </div>
                <span className="text-sm font-medium">{euro.format(voucher.purchase_price_cents / 100)}</span>
              </Link>
            ))}
          </div>
        </section>

        <AuditLogPanel recordId={client.id} table="clients" />
      </section>

      {paymentDialogOpen ? (
        <div aria-modal="true" className="fixed inset-0 z-40 flex items-end justify-center bg-[#27231f]/45 sm:items-center sm:p-4" role="dialog">
          <form className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-[#fdfbf8] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl sm:max-h-[calc(100vh-2rem)] sm:rounded-none sm:pb-6" onSubmit={submitPayment}>
            <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">Registra pagamento</h2><button aria-label="Chiudi" className="size-9 border border-[#cfc5b8]" onClick={() => setPaymentDialogOpen(false)} type="button">x</button></div>
            <label className="mt-6 flex flex-col gap-2 text-sm font-medium">Sessione di riferimento
              <select className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setPaymentForm({ ...paymentForm, sessionId: e.target.value })} required value={paymentForm.sessionId}>
                <option value="">Seleziona</option>
                {sessions.map((session) => <option key={session.id} value={session.id}>{sessionDateTime.format(new Date(session.scheduled_at))} - {session.service_name}</option>)}
              </select>
            </label>
            {sessions.length === 0 ? <p className="mt-2 text-xs text-[#a53e31]">Questo cliente non ha ancora sessioni: creane una prima di registrare un pagamento.</p> : null}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">Importo (EUR)<input className="h-11 border border-[#cfc5b8] bg-white px-3" min="1" onChange={(e) => setPaymentForm({ ...paymentForm, amountEuros: e.target.value })} required type="number" value={paymentForm.amountEuros} /></label>
              <label className="flex flex-col gap-2 text-sm font-medium">Data<input className="h-11 border border-[#cfc5b8] bg-white px-3" onChange={(e) => setPaymentForm({ ...paymentForm, paidAt: e.target.value })} required type="date" value={paymentForm.paidAt} /></label>
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
            <label className="mt-4 flex flex-col gap-2 text-sm font-medium">Note<textarea className="min-h-20 border border-[#cfc5b8] bg-white p-3" onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} value={paymentForm.notes} /></label>
            {paymentError ? <p className="mt-4 text-sm text-[#a53e31]">{paymentError}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button className="h-11 px-4 text-sm font-semibold" onClick={() => setPaymentDialogOpen(false)} type="button">Annulla</button>
              <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={isSaving || sessions.length === 0} type="submit">{isSaving ? "Salvataggio..." : "Salva pagamento"}</button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteDialogOpen ? (
        <div aria-modal="true" className="fixed inset-0 z-40 flex items-end justify-center bg-[#27231f]/45 sm:items-center sm:p-4" role="dialog">
          <section className="w-full max-w-md rounded-t-2xl bg-[#fdfbf8] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-none sm:pb-6">
            <h2 className="text-xl font-semibold">Elimina cliente?</h2>
            {deleteLinked ? (
              <div className="mt-3 text-sm leading-6 text-[#675f57]">
                <p>Il cliente ha record collegati che vanno eliminati prima:</p>
                <ul className="mt-3 space-y-2">
                  {deleteLinked.sessions > 0 ? <li><Link className="font-semibold text-[#9b5d43] hover:underline" href={`/sessions?clientId=${client.id}`}>{deleteLinked.sessions} sessioni collegate</Link></li> : null}
                  {deleteLinked.vouchers > 0 ? <li><Link className="font-semibold text-[#9b5d43] hover:underline" href={`/vouchers?purchaser=${client.id}`}>{deleteLinked.vouchers} buoni acquistati</Link></li> : null}
                </ul>
                <p className="mt-3">Elimina prima questi record, poi riprova.</p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[#675f57]">Questa azione elimina definitivamente il cliente. Procedere solo se non ha sessioni o buoni collegati.</p>
            )}
            {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
            <div className="mt-7 flex justify-end gap-3">
              <button className="h-11 px-4 text-sm font-semibold" disabled={isSaving} onClick={() => { setDeleteDialogOpen(false); setDeleteLinked(null); }} type="button">Chiudi</button>
              {deleteLinked ? null : <button className="h-11 bg-[#a53e31] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={isSaving} onClick={handleDelete} type="button">Elimina cliente</button>}
            </div>
          </section>
        </div>
      ) : null}

      {isArchiveDialogOpen ? (
        <div aria-labelledby="archive-client-title" aria-modal="true" className="fixed inset-0 z-40 flex items-end justify-center bg-[#27231f]/45 sm:items-center sm:p-4" role="dialog">
          <section className="w-full max-w-md rounded-t-2xl bg-[#fdfbf8] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-none sm:pb-6">
            <h2 className="text-xl font-semibold" id="archive-client-title">Archivia cliente?</h2>
            <p className="mt-3 text-sm leading-6 text-[#675f57]">
              Il cliente restera nello storico e potra essere ripristinato, ma non comparira nelle nuove attivita.
            </p>
            <div className="mt-7 flex justify-end gap-3">
              <button className="h-11 px-4 text-sm font-semibold" disabled={isSaving} onClick={() => setIsArchiveDialogOpen(false)} type="button">Annulla</button>
              <button className="h-11 bg-[#a53e31] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={isSaving} onClick={handleArchive} type="button">Archivia</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function ConsentField({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-3 text-sm text-[#514a43]"><input checked={checked} className="size-4 accent-[#9b5d43]" onChange={(event) => onChange(event.target.checked)} type="checkbox" /><span>Consenso per {label.toLowerCase()}</span></label>;
}

function Field({ inputMode, label, onChange, required = false, type = "text", value }: { inputMode?: "email" | "tel"; label: string; onChange: (value: string) => void; required?: boolean; type?: "date" | "email" | "tel" | "text"; value: string }) {
  return <label className="flex flex-col gap-2 text-sm font-medium">{label}<input className="h-11 border border-[#cfc5b8] bg-white px-3 text-base outline-none focus:border-[#9b5d43] focus:ring-2 focus:ring-[#ead8ce]" inputMode={inputMode} onChange={(event) => onChange(event.target.value)} required={required} type={type} value={value} /></label>;
}