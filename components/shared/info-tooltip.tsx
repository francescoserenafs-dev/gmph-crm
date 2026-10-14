"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";

export function InfoTooltip({ text, label = "Informazioni sul KPI" }: { text: string; label?: string }) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="group relative inline-flex shrink-0">
      <button
        aria-describedby={tooltipId}
        aria-expanded={open}
        aria-label={label}
        className="grid size-5 place-items-center rounded-full text-[#81776d] hover:text-[#9b5d43] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#9b5d43]"
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
        type="button"
      >
        <Info className="size-3.5" strokeWidth={1.8} />
      </button>
      <span
        className={`pointer-events-none absolute left-1/2 top-full z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 border border-[#d8d0c5] bg-[#27231f] px-3 py-2 text-left text-xs font-normal normal-case leading-snug tracking-normal whitespace-normal text-white shadow-lg group-hover:block group-focus-within:block ${open ? "block" : "hidden"}`}
        id={tooltipId}
        role="tooltip"
      >
        {text}
      </span>
    </span>
  );
}
