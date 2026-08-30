"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Codice non valido.");
      router.replace(searchParams.get("next") ?? "/home");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Accesso non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f1eb] px-4 text-[#27231f]">
      <form className="w-full max-w-sm border border-[#d8d0c5] bg-white p-8" onSubmit={handleSubmit}>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-[#9b5d43]">Giulia Malosso Photography</p>
        <h1 className="mt-2 text-2xl font-semibold">Accedi</h1>
        <p className="mt-2 text-sm text-[#675f57]">Inserisci il codice di accesso per continuare.</p>
        <label className="mt-6 flex flex-col gap-2 text-sm font-medium">Codice di accesso
          <input
            autoFocus
            className="h-11 border border-[#cfc5b8] bg-white px-3 tracking-widest"
            onChange={(event) => setCode(event.target.value)}
            required
            type="password"
            value={code}
          />
        </label>
        {error ? <p className="mt-4 text-sm text-[#a53e31]">{error}</p> : null}
        <button className="mt-6 h-11 w-full bg-[#9b5d43] text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">
          {busy ? "Verifica..." : "Entra"}
        </button>
      </form>
    </main>
  );
}
