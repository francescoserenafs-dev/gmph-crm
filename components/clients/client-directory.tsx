"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ExportButton } from "@/components/shared/export-button";
import { ImportIcon } from "@/components/shared/icons";

type Client = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  birth_date: string | null;
  is_archived: boolean;
  updated_at: string;
  ltv_cents: number;
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
  imageConsentGranted: boolean;
};

const emptyForm: ClientForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  birthDate: "",
  address: "",
  notes: "",
  privacyConsentGranted: false,
  imageConsentGranted: false,
};

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function ClientDirectory() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [sort, setSort] = useState<"alphabetical" | "recent" | "next_session" | "ltv">(
    (searchParams.get("sort") as "alphabetical" | "recent" | "next_session" | "ltv") || "alphabetical",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(searchParams.get("new") === "1");
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const parameters = new URLSearchParams();
    if (sort !== "alphabetical") parameters.set("sort", sort);
    if (search.trim()) parameters.set("search", search.trim());
    router.replace(`/clients${parameters.toString() ? `?${parameters.toString()}` : ""}`, { scroll: false });
  }, [search, sort, router]);

  useEffect(() => {
    const controller = new AbortController();
    const parameters = new URLSearchParams({ sort });

    if (search.trim()) {
      parameters.set("search", search.trim());
    }

    async function loadClients() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(`/api/clients?${parameters}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          clients?: Client[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(body.error ?? "Non e stato possibile caricare i clienti.");
        }

        setClients(body.clients ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Non e stato possibile caricare i clienti.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadClients();
    return () => controller.abort();
  }, [reloadKey, search, sort]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [clients]);

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(clients.map((client) => client.id)) : new Set());
  }

  function toggleSelectOne(id: string, checked: boolean) {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (checked) {
        nextIds.add(id);
      } else {
        nextIds.delete(id);
      }
      return nextIds;
    });
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0 || isDeleting) {
      return;
    }

    if (!window.confirm(`Eliminare ${selectedIds.size} cliente/i selezionato/i?`)) {
      return;
    }

    setIsDeleting(true);

    try {
      const results = await Promise.all(
        Array.from(selectedIds).map(async (id) => {
          const response = await fetch(`/api/clients/${id}`, { method: "DELETE" });
          return { id, ok: response.ok };
        }),
      );

      if (results.some((result) => !result.ok)) {
        setLoadError(
          "Alcuni clienti non sono stati eliminati perche hanno record collegati.",
        );
      }

      setReloadKey((currentKey) => currentKey + 1);
    } finally {
      setIsDeleting(false);
    }
  }

  function updateForm<Key extends keyof ClientForm>(field: Key, value: ClientForm[Key]) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function closeModal() {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
    setForm(emptyForm);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Non e stato possibile salvare il cliente.");
      }

      setIsModalOpen(false);
      setForm(emptyForm);
      setReloadKey((currentKey) => currentKey + 1);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Non e stato possibile salvare il cliente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-[#d8d0c5] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl">
              Clienti
            </h1>
            <p className="mt-2 text-sm text-[#675f57]">
              Anagrafiche, contatti e consensi in un unico archivio.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedIds.size > 0 ? (
              <button
                aria-label="Elimina selezionati"
                className="grid size-11 place-items-center border border-[#a53e31] text-[#a53e31] transition-colors hover:bg-[#f6e4e1] disabled:cursor-wait disabled:opacity-60"
                disabled={isDeleting}
                onClick={handleDeleteSelected}
                title="Elimina selezionati"
                type="button"
              >
                <TrashIcon />
              </button>
            ) : null}
            <ExportButton
              fetchRows={async () => {
                const response = await fetch(`/api/clients?sort=${sort}${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""}`);
                const body = await response.json();
                return ((body.clients ?? []) as Client[]).map((client) => ({
                  Nome: client.first_name,
                  Cognome: client.last_name,
                  Email: client.email,
                  Telefono: client.phone ?? "",
                  "Data di nascita": client.birth_date ?? "",
                  LTV: (client.ltv_cents / 100).toFixed(2),
                }));
              }}
              filename="clienti"
            />
            <Link
              aria-label="Importa"
              className="grid size-11 place-items-center border border-[#9b5d43] text-[#9b5d43] transition-colors hover:bg-[#f1e3db]"
              href="/clients/import"
              title="Importa"
            >
              <ImportIcon />
            </Link>
            <button
              aria-label="Nuovo cliente"
              className="grid size-11 place-items-center bg-[#9b5d43] text-white transition-colors hover:bg-[#7f4934] focus:outline-2 focus:outline-offset-2 focus:outline-[#9b5d43]"
              onClick={() => setIsModalOpen(true)}
              title="Nuovo cliente"
              type="button"
            >
              <PlusIcon />
            </button>
          </div>
        </header>

        <div className="mt-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <label className="flex max-w-xl flex-1 flex-col gap-2 text-sm font-medium">
            Cerca clienti
            <input
              className="h-11 border border-[#cfc5b8] bg-white px-3 text-base outline-none placeholder:text-[#958b80] focus:border-[#9b5d43] focus:ring-2 focus:ring-[#ead8ce]"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome, cognome o email"
              type="search"
              value={search}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Ordina per
            <select
              className="h-11 border border-[#cfc5b8] bg-white px-3 text-sm outline-none focus:border-[#9b5d43] focus:ring-2 focus:ring-[#ead8ce]"
              onChange={(event) =>
                setSort(
                  event.target.value as "alphabetical" | "recent" | "next_session" | "ltv",
                )
              }
              value={sort}
            >
              <option value="alphabetical">Cognome e nome</option>
              <option value="recent">Aggiornati di recente</option>
              <option value="next_session">Prossima sessione</option>
              <option value="ltv">LTV (dal piu alto)</option>
            </select>
          </label>
        </div>

        <section aria-live="polite" className="mt-7 overflow-hidden border border-[#d8d0c5] bg-white">
          <div className="grid grid-cols-[28px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_230px] items-center gap-4 border-b border-[#d8d0c5] bg-[#eee8df] px-5 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#675f57]">
            <input
              aria-label="Seleziona tutti i clienti"
              checked={clients.length > 0 && selectedIds.size === clients.length}
              className="size-4 accent-[#9b5d43]"
              disabled={clients.length === 0}
              onChange={(event) => toggleSelectAll(event.target.checked)}
              type="checkbox"
            />
            <span>Cliente</span>
            <span>Email</span>
            <span className="hidden sm:block">Cellulare</span>
            <span>LTV</span>
            <span>Azioni</span>
          </div>

          {isLoading ? (
            <p className="px-5 py-10 text-sm text-[#675f57]">Caricamento clienti...</p>
          ) : null}

          {loadError ? (
            <div className="px-5 py-10">
              <p className="text-sm text-[#a53e31]">{loadError}</p>
              <button
                className="mt-3 text-sm font-semibold text-[#9b5d43] underline underline-offset-4"
                onClick={() => setReloadKey((currentKey) => currentKey + 1)}
                type="button"
              >
                Riprova
              </button>
            </div>
          ) : null}

          {!isLoading && !loadError && clients.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <p className="text-base font-medium">Nessun cliente da mostrare.</p>
              <p className="mt-2 text-sm text-[#675f57]">
                Crea la prima anagrafica per iniziare.
              </p>
            </div>
          ) : null}

          {!isLoading && !loadError
            ? clients.map((client) => (
                <article
                  className="group grid grid-cols-[28px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_230px] items-center gap-4 border-b border-[#eee8df] px-5 py-4 last:border-b-0"
                  key={client.id}
                >
                  <input
                    aria-label={`Seleziona ${client.first_name} ${client.last_name}`}
                    checked={selectedIds.has(client.id)}
                    className="size-4 shrink-0 accent-[#9b5d43]"
                    onChange={(event) => toggleSelectOne(client.id, event.target.checked)}
                    type="checkbox"
                  />
                  <Link className="contents" href={`/clients/${client.id}`}>
                    <div className="min-w-0">
                      <p className="truncate font-semibold group-hover:underline">
                        {client.last_name} {client.first_name}
                      </p>
                      <p className="mt-1 text-xs text-[#675f57]">
                        Aggiornato {dateFormatter.format(new Date(client.updated_at))}
                      </p>
                    </div>
                    <p className="truncate text-sm text-[#514a43]">{client.email}</p>
                    <p className="hidden truncate text-sm text-[#514a43] sm:block">
                      {client.phone ?? "-"}
                    </p>
                    <p className="truncate text-sm font-semibold text-[#514a43]">
                      {euro.format((client.ltv_cents ?? 0) / 100)}
                    </p>
                  </Link>
                  <div className="flex gap-2">
                    <Link className="border border-[#cfc5b8] px-3 py-1 text-xs font-semibold hover:bg-[#eee8df]" href={`/sessions?newSession=${client.id}`}>Crea Sessione</Link>
                    <Link className="border border-[#cfc5b8] px-3 py-1 text-xs font-semibold hover:bg-[#eee8df]" href={`/clients/${client.id}?pay=1`}>Registra Pagamento</Link>
                  </div>
                </article>
              ))
            : null}
        </section>
      </section>

      {isModalOpen ? (
        <div
          aria-labelledby="new-client-title"
          aria-modal="true"
          className="fixed inset-0 z-10 grid place-items-center bg-[#27231f]/45 p-4"
          onMouseDown={closeModal}
          role="dialog"
        >
          <section
            className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto bg-[#fdfbf8] p-6 shadow-xl sm:p-8"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#9b5d43]">
                  Anagrafica
                </p>
                <h2 className="mt-1 text-2xl font-semibold" id="new-client-title">
                  Nuovo cliente
                </h2>
              </div>
              <button
                aria-label="Chiudi"
                className="grid size-9 place-items-center border border-[#cfc5b8] text-lg hover:bg-[#eee8df]"
                onClick={closeModal}
                type="button"
              >
                x
              </button>
            </div>

            <form className="mt-7" onSubmit={handleSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Nome"
                  onChange={(value) => updateForm("firstName", value)}
                  required
                  value={form.firstName}
                />
                <Field
                  label="Cognome"
                  onChange={(value) => updateForm("lastName", value)}
                  required
                  value={form.lastName}
                />
                <Field
                  inputMode="email"
                  label="Email"
                  onChange={(value) => updateForm("email", value)}
                  required
                  type="email"
                  value={form.email}
                />
                <Field
                  inputMode="tel"
                  label="Cellulare"
                  onChange={(value) => updateForm("phone", value)}
                  type="tel"
                  value={form.phone}
                />
                <Field
                  label="Data di nascita"
                  onChange={(value) => updateForm("birthDate", value)}
                  type="date"
                  value={form.birthDate}
                />
                <Field
                  label="Indirizzo"
                  onChange={(value) => updateForm("address", value)}
                  value={form.address}
                />
              </div>
              <label className="mt-5 flex flex-col gap-2 text-sm font-medium">
                Note
                <textarea
                  className="min-h-28 border border-[#cfc5b8] bg-white p-3 text-base outline-none focus:border-[#9b5d43] focus:ring-2 focus:ring-[#ead8ce]"
                  onChange={(event) => updateForm("notes", event.target.value)}
                  value={form.notes}
                />
              </label>

              <fieldset className="mt-6 border-t border-[#d8d0c5] pt-5">
                <legend className="text-sm font-semibold">Consensi</legend>
                <div className="mt-3 grid gap-3">
                  <label className="flex items-start gap-3 text-sm leading-5 text-[#514a43]">
                    <input
                      checked={form.privacyConsentGranted}
                      className="mt-0.5 size-4 accent-[#9b5d43]"
                      onChange={(event) =>
                        updateForm("privacyConsentGranted", event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span>Consenso al trattamento dei dati personali ricevuto</span>
                  </label>
                  <label className="flex items-start gap-3 text-sm leading-5 text-[#514a43]">
                    <input
                      checked={form.imageConsentGranted}
                      className="mt-0.5 size-4 accent-[#9b5d43]"
                      onChange={(event) =>
                        updateForm("imageConsentGranted", event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span>Consenso all&apos;utilizzo delle immagini ricevuto</span>
                  </label>
                </div>
              </fieldset>

              {formError ? <p className="mt-5 text-sm text-[#a53e31]">{formError}</p> : null}

              <div className="mt-7 flex justify-end gap-3">
                <button
                  className="h-11 px-4 text-sm font-semibold hover:bg-[#eee8df]"
                  onClick={closeModal}
                  type="button"
                >
                  Annulla
                </button>
                <button
                  className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:cursor-wait disabled:bg-[#ba998b]"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Salvataggio..." : "Salva cliente"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}

type FieldProps = {
  inputMode?: "email" | "tel";
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "date" | "email" | "tel" | "text";
  value: string;
};

function Field({
  inputMode,
  label,
  onChange,
  required = false,
  type = "text",
  value,
}: FieldProps) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      <input
        className="h-11 border border-[#cfc5b8] bg-white px-3 text-base outline-none focus:border-[#9b5d43] focus:ring-2 focus:ring-[#ead8ce]"
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}