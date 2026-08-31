"use client";

import type { ReactNode } from "react";

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div aria-modal="true" className="fixed inset-0 z-40 flex items-end justify-center bg-[#27231f]/45 sm:items-center sm:p-4" onMouseDown={onClose} role="dialog">
      <section
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-[#fdfbf8] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl sm:max-h-[calc(100vh-2rem)] sm:rounded-none sm:pb-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">{title}</h2><button aria-label="Chiudi" className="size-9 border border-[#cfc5b8]" onClick={onClose} type="button">x</button></div>
        <div className="mt-6">{children}</div>
      </section>
    </div>
  );
}
