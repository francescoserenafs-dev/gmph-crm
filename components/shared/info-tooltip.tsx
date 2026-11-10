"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";

export function InfoTooltip({ text, label = "Informazioni sul KPI" }: { text: string; label?: string }) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; width: number } | null>(null);
  function show(button: HTMLButtonElement) {
    const rect = button.getBoundingClientRect();
    const dialog = button.closest("dialog")?.getBoundingClientRect();
    const boundaryLeft = Math.max(16, dialog ? dialog.left + 16 : 16);
    const boundaryRight = Math.min(window.innerWidth - 16, dialog ? dialog.right - 16 : window.innerWidth - 16);
    const width = Math.min(256, boundaryRight - boundaryLeft);
    const left = Math.max(boundaryLeft, Math.min(rect.left + rect.width / 2 - width / 2, boundaryRight - width));
    setPosition({ left: left - rect.left, width });
    setOpen(true);
  }
  return (
    <span className="group relative inline-flex shrink-0">
      <button
        aria-describedby={tooltipId}
        aria-expanded={open}
        aria-label={label}
        className="grid size-5 place-items-center rounded-full text-[#81776d] hover:text-[#9b5d43] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#9b5d43]"
        onBlur={() => setOpen(false)}
        onFocus={(event) => show(event.currentTarget)}
        onMouseEnter={(event) => show(event.currentTarget)}
        onMouseLeave={(event) => { if (document.activeElement !== event.currentTarget) setOpen(false); }}
        onClick={(event) => show(event.currentTarget)}
        onKeyDown={(event) => { if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); } }}
        type="button"
      >
        <Info className="size-3.5" strokeWidth={1.8} />
      </button>
      <span
        className={`pointer-events-none absolute top-full z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] border border-[#d8d0c5] bg-[#27231f] px-3 py-2 text-left text-xs font-normal normal-case leading-snug tracking-normal whitespace-normal text-white shadow-lg ${open ? "block" : "hidden"}`}
        id={tooltipId}
        role="tooltip"
        style={position ? { left: position.left, width: position.width } : undefined}
      >
        {text}
      </span>
    </span>
  );
}
