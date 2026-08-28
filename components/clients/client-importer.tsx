"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useState } from "react";
import * as XLSX from "xlsx";

const crmFields = [
  { key: "ignore", label: "Ignora colonna" },
  { key: "firstName", label: "Nome *" },
  { key: "lastName", label: "Cognome *" },
  { key: "email", label: "Email *" },
  { key: "phone", label: "Cellulare" },
  { key: "birthDate", label: "Data di nascita" },
  { key: "address", label: "Indirizzo" },
  { key: "notes", label: "Note" },
  { key: "privacyConsentGranted", label: "Consenso privacy" },
  { key: "imageConsentGranted", label: "Consenso immagini" },
] as const;

type FieldKey = (typeof crmFields)[number]["key"];
type ImportError = { row: number; error: string };
type ClientRow = { row: number; data: Record<string, string | boolean> };
type DuplicateGroup = { email: string; candidates: ClientRow[] };

function detectDelimiter(text: string): string {
  if (text.includes("\t")) return "\t";
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  return (firstLine.split(";").length > firstLine.split(",").length) ? ";" : ",";
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field); field = "";
    } else if (char === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

function parseConsentValue(value: string): boolean {
  return /^(si|s|yes|y|true|1|x)$/i.test(value.trim());
}

function describeCandidate(data: Record<string, string | boolean>): string {
  const parts = [
    [data.firstName, data.lastName].filter(Boolean).join(" "),
    typeof data.phone === "string" ? data.phone : "",
    typeof data.birthDate === "string" ? data.birthDate : "",
  ].filter((part) => part && part.length > 0);
  return parts.length > 0 ? parts.join(" · ") : "(nessun dato aggiuntivo)";
}

function normalizeDate(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return trimmed;
}

function autoMap(header: string): FieldKey {
  const value = header.toLowerCase();
  if (/nome|first/.test(value) && !/cognome|last|utente/.test(value)) return "firstName";
  if (/cognome|last/.test(value)) return "lastName";
  if (/mail|email|e-mail/.test(value)) return "email";
  if (/cell|tel|phone|mobile/.test(value)) return "phone";
  if (/nascita|birth|compleanno/.test(value)) return "birthDate";
  if (/indiriz|address|via/.test(value)) return "address";
  if (/note|nota|comment/.test(value)) return "notes";
  if (/privacy/.test(value)) return "privacyConsentGranted";
  if (/immagin|image|foto|ritratt/.test(value)) return "imageConsentGranted";
  return "ignore";
}

export function ClientImporter() {
  const router = useRouter();
  const [rows, setRows] = useState<string[][]>([]);
  const [headerRow, setHeaderRow] = useState(true);
  const [mapping, setMapping] = useState<FieldKey[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: ImportError[] } | null>(null);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [duplicateSelections, setDuplicateSelections] = useState<Record<string, number | "skip">>({});

  function applyRows(parsed: string[][]) {
    if (parsed.length === 0) { setError("Nessun dato rilevato."); return; }
    const columns = Math.max(...parsed.map((row) => row.length));
    const normalized = parsed.map((row) => Array.from({ length: columns }, (_, i) => row[i] ?? ""));
    setRows(normalized);
    const headers = normalized[0] ?? [];
    setMapping(Array.from({ length: columns }, (_, i) => autoMap(headers[i] ?? "")));
    setResult(null);
    setError(null);
  }

  function handlePaste() {
    const delimiter = detectDelimiter(pasteText);
    applyRows(parseDelimited(pasteText, delimiter));
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      if (/\.csv$/i.test(file.name)) {
        const text = await file.text();
        applyRows(parseDelimited(text, detectDelimiter(text)));
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, dateNF: "yyyy-mm-dd" });
        applyRows(json.map((row) => row.map((cell) => (cell == null ? "" : String(cell)))));
      }
    } catch {
      setError("Non e stato possibile leggere il file.");
    }
  }

  async function handleImport() {
    setBusy(true); setError(null);
    const dataRows = headerRow ? rows.slice(1) : rows;
    const sourceRowOffset = headerRow ? 2 : 1;
    const builtRows: ClientRow[] = dataRows.map((row, rowIndex) => {
      const client: Record<string, string | boolean> = {};
      mapping.forEach((field, index) => {
        if (field === "ignore") return;
        const value = (row[index] ?? "").trim();
        if (!value) return;
        if (field === "privacyConsentGranted" || field === "imageConsentGranted") {
          client[field] = parseConsentValue(value);
        } else {
          client[field] = field === "birthDate" ? normalizeDate(value) : value;
        }
      });
      return { row: rowIndex + sourceRowOffset, data: client };
    });

    const rowsByEmail = new Map<string, ClientRow[]>();
    for (const item of builtRows) {
      const email = typeof item.data.email === "string" ? item.data.email.toLowerCase() : "";
      if (!email) continue;
      const bucket = rowsByEmail.get(email) ?? [];
      bucket.push(item);
      rowsByEmail.set(email, bucket);
    }

    const newDuplicateGroups: DuplicateGroup[] = [];
    const readyRows: ClientRow[] = [];
    for (const item of builtRows) {
      const email = typeof item.data.email === "string" ? item.data.email.toLowerCase() : "";
      const bucket = email ? rowsByEmail.get(email) : undefined;
      if (bucket && bucket.length > 1) {
        if (!newDuplicateGroups.some((group) => group.email === email)) {
          newDuplicateGroups.push({ email, candidates: bucket });
        }
      } else {
        readyRows.push(item);
      }
    }

    try {
      let imported = 0;
      let errors: ImportError[] = [];

      if (readyRows.length > 0) {
        const response = await fetch("/api/clients/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clients: readyRows.map((item) => item.data) }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        imported = body.imported;
        errors = (body.errors as ImportError[]).map((item) => ({
          row: readyRows[item.row - 1]?.row ?? item.row,
          error: item.error,
        }));
      }

      setResult({ imported, errors });
      setDuplicateGroups(newDuplicateGroups);
      setDuplicateSelections(
        Object.fromEntries(newDuplicateGroups.map((group) => [group.email, 0])),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Importazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResolveDuplicates() {
    setBusy(true); setError(null);

    const selectedRows = duplicateGroups
      .map((group) => {
        const selection = duplicateSelections[group.email];
        if (selection === "skip" || selection === undefined) return null;
        return group.candidates[selection];
      })
      .filter((item): item is ClientRow => item !== null);

    try {
      let imported = 0;
      let errors: ImportError[] = [];

      if (selectedRows.length > 0) {
        const response = await fetch("/api/clients/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clients: selectedRows.map((item) => item.data) }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        imported = body.imported;
        errors = (body.errors as ImportError[]).map((item) => ({
          row: selectedRows[item.row - 1]?.row ?? item.row,
          error: item.error,
        }));
      }

      setResult((current) => ({
        imported: (current?.imported ?? 0) + imported,
        errors: [...(current?.errors ?? []), ...errors],
      }));
      setDuplicateGroups([]);
      setDuplicateSelections({});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Importazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  const hasData = rows.length > 0;
  const headers = rows[0] ?? [];
  const previewRows = (headerRow ? rows.slice(1) : rows).slice(0, 5);
  const dataCount = headerRow ? Math.max(rows.length - 1, 0) : rows.length;
  const mappedFields = new Set(mapping.filter((field) => field !== "ignore"));
  const canImport = mappedFields.has("firstName") && mappedFields.has("lastName") && mappedFields.has("email") && dataCount > 0;

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-6 text-[#27231f] sm:px-8 lg:px-12">
      <section className="mx-auto max-w-5xl">
        <Link className="text-sm font-semibold text-[#9b5d43] hover:underline" href="/clients">Tutti i clienti</Link>
        <header className="mt-6 border-b border-[#d8d0c5] pb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#9b5d43]">Clienti</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Importa clienti</h1>
          <p className="mt-2 text-sm text-[#675f57]">Da file CSV, Excel oppure incollando dati copiati da Excel.</p>
        </header>

        {duplicateGroups.length > 0 ? (
          <section className="mt-8 border border-[#d8d0c5] bg-white p-6">
            <h2 className="text-lg font-semibold">Email duplicate da risolvere</h2>
            <p className="mt-2 text-sm text-[#675f57]">
              {duplicateGroups.length} indirizzi email compaiono su piu righe. Scegli quale riga importare per ciascuna email, oppure scarta tutte le righe.
            </p>
            {result ? (
              <p className="mt-2 text-sm">Gia importati: <span className="font-semibold">{result.imported}</span>. Righe scartate finora: <span className="font-semibold">{result.errors.length}</span>.</p>
            ) : null}

            <div className="mt-5 grid gap-4">
              {duplicateGroups.map((group) => (
                <div className="border border-[#d8d0c5] p-4" key={group.email}>
                  <p className="font-semibold">{group.email}</p>
                  <p className="mt-1 text-xs text-[#675f57]">{group.candidates.length} righe con questa email</p>
                  <div className="mt-3 grid gap-2">
                    {group.candidates.map((candidate, index) => (
                      <label className="flex items-start gap-2 border border-[#eee8df] p-2 text-sm" key={candidate.row}>
                        <input
                          checked={duplicateSelections[group.email] === index}
                          className="mt-0.5"
                          name={`dup-${group.email}`}
                          onChange={() => setDuplicateSelections((current) => ({ ...current, [group.email]: index }))}
                          type="radio"
                        />
                        <span>Riga {candidate.row}: {describeCandidate(candidate.data)}</span>
                      </label>
                    ))}
                    <label className="flex items-center gap-2 text-sm text-[#a53e31]">
                      <input
                        checked={duplicateSelections[group.email] === "skip"}
                        name={`dup-${group.email}`}
                        onChange={() => setDuplicateSelections((current) => ({ ...current, [group.email]: "skip" }))}
                        type="radio"
                      />
                      Non importare nessuna delle righe
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={handleResolveDuplicates} type="button">
                {busy ? "Importazione..." : "Conferma selezione"}
              </button>
            </div>
          </section>
        ) : result ? (
          <section className="mt-8 border border-[#d8d0c5] bg-white p-6">
            <h2 className="text-lg font-semibold">Importazione completata</h2>
            <p className="mt-2 text-sm">Clienti importati: <span className="font-semibold">{result.imported}</span>. Righe scartate: <span className="font-semibold">{result.errors.length}</span>.</p>
            {result.errors.length > 0 ? (
              <div className="mt-4 max-h-60 overflow-y-auto border border-[#eee8df]">
                {result.errors.map((item) => <p className="border-b border-[#eee8df] px-3 py-2 text-sm text-[#a53e31] last:border-b-0" key={item.row}>Riga {item.row}: {item.error}</p>)}
              </div>
            ) : null}
            <div className="mt-6 flex gap-3">
              <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white" onClick={() => router.push("/clients")} type="button">Vai ai clienti</button>
              <button className="h-11 border border-[#cfc5b8] px-5 text-sm font-semibold" onClick={() => { setResult(null); setRows([]); setPasteText(""); }} type="button">Nuova importazione</button>
            </div>
          </section>
        ) : (
          <>
            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="border border-[#d8d0c5] bg-white p-5">
                <h2 className="text-lg font-semibold">Da file</h2>
                <p className="mt-2 text-sm text-[#675f57]">Formati supportati: .csv, .xlsx, .xls</p>
                <input accept=".csv,.xlsx,.xls" className="mt-4 block w-full text-sm" onChange={handleFile} type="file" />
              </div>
              <div className="border border-[#d8d0c5] bg-white p-5">
                <h2 className="text-lg font-semibold">Da clipboard</h2>
                <p className="mt-2 text-sm text-[#675f57]">Incolla le celle copiate da Excel.</p>
                <textarea className="mt-4 min-h-28 w-full border border-[#cfc5b8] p-3 text-sm" onChange={(e) => setPasteText(e.target.value)} placeholder="Incolla qui..." value={pasteText} />
                <button className="mt-3 h-10 bg-[#27231f] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={!pasteText.trim()} onClick={handlePaste} type="button">Analizza dati</button>
              </div>
            </section>

            {error ? <p className="mt-5 text-sm text-[#a53e31]">{error}</p> : null}

            {hasData ? (
              <section className="mt-8 border border-[#d8d0c5] bg-white p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Associa le colonne</h2>
                  <label className="flex items-center gap-2 text-sm"><input checked={headerRow} onChange={(e) => setHeaderRow(e.target.checked)} type="checkbox" /> La prima riga contiene le intestazioni</label>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {mapping.map((field, index) => (
                    <label className="flex flex-col gap-2 text-sm font-medium" key={index}>
                      <span className="truncate text-[#675f57]">Colonna {index + 1}{headerRow && headers[index] ? `: ${headers[index]}` : ""}</span>
                      <select className="h-10 border border-[#cfc5b8] bg-white px-2" onChange={(e) => setMapping((current) => current.map((value, i) => (i === index ? (e.target.value as FieldKey) : value)))} value={field}>
                        {crmFields.map((option) => <option disabled={option.key !== "ignore" && option.key !== field && mappedFields.has(option.key)} key={option.key} value={option.key}>{option.label}</option>)}
                      </select>
                    </label>
                  ))}
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="bg-[#eee8df]">
                        {mapping.map((field, index) => <th className="border border-[#e0d8cd] px-3 py-2 text-xs font-semibold uppercase text-[#675f57]" key={index}>{field === "ignore" ? "—" : crmFields.find((f) => f.key === field)?.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {mapping.map((field, index) => <td className={`border border-[#eee8df] px-3 py-2 ${field === "ignore" ? "text-[#958b80]" : ""}`} key={index}>{row[index]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="mt-4 text-sm text-[#675f57]">{dataCount} righe pronte. Nome, Cognome ed Email sono obbligatori.</p>
                {!canImport ? <p className="mt-1 text-sm text-[#a53e31]">Associa almeno Nome, Cognome ed Email per procedere.</p> : null}
                <div className="mt-5">
                  <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={!canImport || busy} onClick={handleImport} type="button">{busy ? "Importazione..." : `Importa ${dataCount} clienti`}</button>
                </div>
              </section>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
