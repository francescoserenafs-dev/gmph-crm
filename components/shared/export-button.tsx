"use client";

import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

export function ExportButton({ filename, fetchRows }: { filename: string; fetchRows: () => Promise<Record<string, unknown>[]> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleExport(format: "csv" | "xlsx") {
    setOpen(false);
    setBusy(true);
    try {
      const rows = await fetchRows();
      const sheet = XLSX.utils.json_to_sheet(rows);
      if (format === "csv") {
        const csv = XLSX.utils.sheet_to_csv(sheet);
        const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${filename}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, sheet, "Dati");
        XLSX.writeFile(book, `${filename}.xlsx`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-label="Esporta"
        className="grid size-11 place-items-center border border-[#9b5d43] text-[#9b5d43] transition-colors hover:bg-[#f1e3db] disabled:opacity-60"
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
        title="Esporta"
        type="button"
      >
        <DownloadIcon />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-40 border border-[#d8d0c5] bg-white text-sm shadow-lg">
          <button className="block w-full px-4 py-2 text-left hover:bg-[#f5f1eb]" onClick={() => handleExport("csv")} type="button">Esporta CSV</button>
          <button className="block w-full px-4 py-2 text-left hover:bg-[#f5f1eb]" onClick={() => handleExport("xlsx")} type="button">Esporta Excel</button>
        </div>
      ) : null}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
