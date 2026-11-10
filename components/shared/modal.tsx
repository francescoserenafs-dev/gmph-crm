"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => { dialog?.close(); document.body.style.overflow = overflow; previousFocus?.focus(); };
  }, []);
  return (
    <dialog aria-labelledby={titleId} aria-modal="true" className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto rounded-md border-0 bg-[#fdfbf8] p-0 text-[#27231f] shadow-xl backdrop:bg-[#27231f]/45" ref={dialogRef} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onKeyDown={(event) => { if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); if (!busy) onClose(); } }} onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
      <section
        className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6"
      >
        <div className="flex items-center justify-between gap-4"><h2 className="min-w-0 break-words text-xl font-semibold" id={titleId}>{title}</h2><button aria-label="Chiudi" className="grid size-11 shrink-0 place-items-center border border-[#cfc5b8] focus-visible:outline-2 focus-visible:outline-[#9b5d43] disabled:opacity-50" disabled={busy} onClick={onClose} title="Chiudi" type="button"><X className="size-5" /></button></div>
        <div className="mt-6">{children}</div>
      </section>
    </dialog>
  );
}
