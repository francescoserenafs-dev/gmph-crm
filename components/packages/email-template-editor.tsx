"use client";

import { useEffect, useState } from "react";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { EMAIL_TEMPLATE_VARIABLES } from "@/lib/email-variables";

export function EmailTemplateEditor({ templateCode, title }: { templateCode: string; title: string }) {
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "error" | "ok"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/email-templates/${templateCode}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (!active) return;
        setSubject(body.template.subject);
        setBodyHtml(body.template.body_html);
      } catch (reason) {
        if (active) setStatus({ type: "error", message: reason instanceof Error ? reason.message : "Caricamento modello non riuscito." });
      }
    })();
    return () => { active = false; };
  }, [templateCode]);

  async function save() {
    setBusy(true); setStatus(null);
    try {
      const response = await fetch(`/api/email-templates/${templateCode}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, bodyHtml }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setStatus({ type: "ok", message: "Modello salvato." });
    } catch (reason) { setStatus({ type: "error", message: reason instanceof Error ? reason.message : "Salvataggio non riuscito." }); } finally { setBusy(false); }
  }

  return (
    <section className="mt-10 border-t border-[#d8d0c5] pt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-[#675f57]">Il testo viene completato con i dati della sessione. Prima di ogni invio vedi l&apos;anteprima e puoi ritoccarla.</p>
      {bodyHtml === null ? (
        status ? <p className="mt-4 text-sm text-[#a53e31]">{status.message}</p> : <p className="mt-4 text-sm text-[#675f57]">Caricamento...</p>
      ) : (
        <div className="mt-4 border border-[#d8d0c5] bg-white p-5">
          <label className="flex flex-col gap-2 text-sm font-medium">Oggetto
            <input className="h-11 border border-[#cfc5b8] bg-white px-3" maxLength={200} onChange={(e) => setSubject(e.target.value)} value={subject} />
          </label>
          <div className="mt-4 text-sm font-medium">Testo
            <RichTextEditor onChange={setBodyHtml} value={bodyHtml} />
          </div>
          <div className="mt-4 bg-[#fdfbf8] p-4 text-xs text-[#675f57]">
            <p className="font-semibold uppercase tracking-[0.08em]">Variabili disponibili</p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {EMAIL_TEMPLATE_VARIABLES.map((variable) => <li key={variable.key}><code className="text-[#9b5d43]">{`{{${variable.key}}}`}</code> - {variable.label}</li>)}
            </ul>
          </div>
          {status ? <p className={`mt-4 text-sm ${status.type === "error" ? "text-[#a53e31]" : "text-[#367e4a]"}`}>{status.message}</p> : null}
          <div className="mt-4 flex justify-end">
            <button className="h-11 bg-[#9b5d43] px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || !subject.trim()} onClick={save} type="button">{busy ? "Salvataggio..." : "Salva modello"}</button>
          </div>
        </div>
      )}
    </section>
  );
}
