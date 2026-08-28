"use client";

import { useEffect, useRef, useState } from "react";

export function MultiSelectFilter({ label, options, selected, onChange }: { label: string; options: { id: string; name: string }[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  }

  const summary = selected.length === 0 ? "Tutti" : selected.length === 1 ? (options.find((option) => option.id === selected[0])?.name ?? "1 selezionato") : `${selected.length} selezionati`;

  return (
    <div className="relative flex flex-col gap-2 text-sm font-medium" ref={containerRef}>
      {label}
      <button
        className="flex h-11 items-center justify-between border border-[#cfc5b8] bg-white px-3 text-left font-normal"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="truncate">{summary}</span>
        <span aria-hidden="true" className="ml-2 text-[#675f57]">▾</span>
      </button>
      {open ? (
        <div className="absolute top-full z-20 mt-1 max-h-64 w-full min-w-48 overflow-y-auto border border-[#d8d0c5] bg-white shadow-lg">
          {selected.length > 0 ? (
            <button className="block w-full border-b border-[#eee8df] px-3 py-2 text-left text-xs font-semibold text-[#9b5d43] hover:bg-[#f5f1eb]" onClick={() => onChange([])} type="button">
              Deseleziona tutto
            </button>
          ) : null}
          {options.map((option) => (
            <label className="flex items-center gap-2 px-3 py-2 font-normal hover:bg-[#f5f1eb]" key={option.id}>
              <input checked={selected.includes(option.id)} onChange={() => toggle(option.id)} type="checkbox" />
              {option.name}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
