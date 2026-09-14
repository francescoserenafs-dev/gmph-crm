"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type ClientResult = { id: string; first_name: string; last_name: string; email: string };
type SessionResult = { id: string; scheduled_at: string; service_name: string; client: { first_name: string; last_name: string } | null };
type VoucherResult = { id: string; code: string; service_name: string | null; purchaser: { first_name: string; last_name: string } | null; recipient: { first_name: string; last_name: string } | null };
type PaymentResult = {
  id: string;
  amount_cents: number;
  paid_at: string;
  reference: string | null;
  notes: string | null;
  session: { id: string; service_name: string; client: { first_name: string; last_name: string } | null } | null;
  voucher: { id: string; code: string; purchaser: { first_name: string; last_name: string } | null } | null;
};

const dateOnly = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" });
const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function GlobalSearch() {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ clients: ClientResult[]; sessions: SessionResult[]; vouchers: VoucherResult[]; payments: PaymentResult[] }>({ clients: [], sessions: [], vouchers: [], payments: [] });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (term.trim().length < 2) return;
    let active = true;
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term.trim())}`)
        .then((response) => response.json())
        .then((body) => { if (active) setResults(body); })
        .catch(() => { if (active) setResults({ clients: [], sessions: [], vouchers: [], payments: [] }); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timeout); };
  }, [term]);

  const hasResults = results.clients.length > 0 || results.sessions.length > 0 || results.vouchers.length > 0 || results.payments.length > 0;

  return (
    <div className="relative w-full max-w-xl" ref={containerRef}>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-[#9b5d43]" />
        <input
          className="h-12 w-full border-2 border-[#9b5d43] bg-white pl-10 pr-3 text-sm font-medium placeholder:font-normal placeholder:text-[#675f57] focus:outline-2 focus:outline-offset-2 focus:outline-[#9b5d43]"
          onChange={(event) => {
            const nextTerm = event.target.value;
            setTerm(nextTerm);
            setOpen(true);
            if (nextTerm.trim().length < 2) {
              setLoading(false);
              setResults({ clients: [], sessions: [], vouchers: [], payments: [] });
            } else {
              setLoading(true);
            }
          }}
          onFocus={() => setOpen(true)}
          placeholder="Cerca cliente, sessione, buono..."
          type="search"
          value={term}
        />
      </div>
      {open && term.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-96 overflow-y-auto border border-[#d8d0c5] bg-white text-sm shadow-lg">
          {loading ? <p className="p-4 text-[#675f57]">Ricerca...</p> : !hasResults ? <p className="p-4 text-[#675f57]">Nessun risultato.</p> : (
            <>
              {results.clients.length > 0 ? (
                <div>
                  <p className="bg-[#eee8df] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">Clienti</p>
                  {results.clients.map((client) => (
                    <Link className="block px-3 py-2 hover:bg-[#f5f1eb]" href={`/clients/${client.id}`} key={client.id} onClick={() => setOpen(false)}>
                      <span className="font-medium">{client.first_name} {client.last_name}</span>
                      <span className="block text-xs text-[#675f57]">{client.email}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
              {results.sessions.length > 0 ? (
                <div>
                  <p className="bg-[#eee8df] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">Sessioni</p>
                  {results.sessions.map((session) => (
                    <Link className="block px-3 py-2 hover:bg-[#f5f1eb]" href={`/sessions/${session.id}`} key={session.id} onClick={() => setOpen(false)}>
                      <span className="font-medium">{session.service_name} - {session.client ? `${session.client.first_name} ${session.client.last_name}` : "-"}</span>
                      <span className="block text-xs text-[#675f57]">{dateOnly.format(new Date(session.scheduled_at))}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
              {results.vouchers.length > 0 ? (
                <div>
                  <p className="bg-[#eee8df] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">Buoni</p>
                  {results.vouchers.map((voucher) => (
                    <Link className="block px-3 py-2 hover:bg-[#f5f1eb]" href={`/vouchers/${voucher.id}`} key={voucher.id} onClick={() => setOpen(false)}>
                      <span className="font-medium">{voucher.code}</span>
                      <span className="block text-xs text-[#675f57]">
                        {voucher.purchaser ? `${voucher.purchaser.first_name} ${voucher.purchaser.last_name}` : "-"}
                        {voucher.recipient ? ` -> ${voucher.recipient.first_name} ${voucher.recipient.last_name}` : ""}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}
              {results.payments.length > 0 ? (
                <div>
                  <p className="bg-[#eee8df] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#675f57]">Pagamenti</p>
                  {results.payments.map((payment) => {
                    const href = payment.session ? `/sessions/${payment.session.id}` : payment.voucher ? `/vouchers/${payment.voucher.id}` : "/payments";
                    const context = payment.session
                      ? `${payment.session.service_name}${payment.session.client ? ` - ${payment.session.client.first_name} ${payment.session.client.last_name}` : ""}`
                      : payment.voucher
                        ? `Buono ${payment.voucher.code}${payment.voucher.purchaser ? ` - ${payment.voucher.purchaser.first_name} ${payment.voucher.purchaser.last_name}` : ""}`
                        : "-";
                    return (
                      <Link className="block px-3 py-2 hover:bg-[#f5f1eb]" href={href} key={payment.id} onClick={() => setOpen(false)}>
                        <span className="font-medium">{euro.format(payment.amount_cents / 100)} - {context}</span>
                        <span className="block text-xs text-[#675f57]">{dateOnly.format(new Date(payment.paid_at))}{payment.reference ? ` - ${payment.reference}` : ""}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}
