"use client";

import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const iconButton = "flex size-9 items-center justify-center border-r border-[#d8d0c5] hover:bg-[#f5f1eb]";

export function RichTextEditor({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [initialValue] = useState(value);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value && !editor.contains(document.activeElement)) editor.innerHTML = value;
  }, [value]);

  function command(name: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(name, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  return (
    <div className="mt-1 border border-[#cfc5b8] bg-white">
      <div className="flex flex-wrap items-center border-b border-[#d8d0c5] bg-[#fdfbf8]">
        <button aria-label="Grassetto" className={iconButton} onMouseDown={(event) => event.preventDefault()} onClick={() => command("bold")} title="Grassetto" type="button"><Bold className="size-4" /></button>
        <button aria-label="Corsivo" className={iconButton} onMouseDown={(event) => event.preventDefault()} onClick={() => command("italic")} title="Corsivo" type="button"><Italic className="size-4" /></button>
        <button aria-label="Elenco puntato" className={iconButton} onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertUnorderedList")} title="Elenco puntato" type="button"><List className="size-4" /></button>
        <button aria-label="Elenco numerato" className={iconButton} onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertOrderedList")} title="Elenco numerato" type="button"><ListOrdered className="size-4" /></button>
        <select aria-label="Font" className="h-9 border-r border-[#d8d0c5] bg-white px-2 text-xs" defaultValue="" onChange={(event) => { command("fontName", event.target.value); event.target.value = ""; }}>
          <option disabled value="">Font</option>
          <option value="Georgia">Georgia</option>
          <option value="Arial">Arial</option>
          <option value="Verdana">Verdana</option>
          <option value="Courier New">Courier New</option>
        </select>
        <select aria-label="Dimensione testo" className="h-9 border-r border-[#d8d0c5] bg-white px-2 text-xs" defaultValue="" onChange={(event) => { command("fontSize", event.target.value); event.target.value = ""; }}>
          <option disabled value="">Dimensione</option>
          <option value="2">Piccolo</option>
          <option value="3">Normale</option>
          <option value="4">Grande</option>
          <option value="5">Molto grande</option>
        </select>
        <label className="flex h-9 items-center gap-2 px-2 text-xs">Colore
          <input aria-label="Colore testo" className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0" onChange={(event) => command("foreColor", event.target.value)} type="color" />
        </label>
      </div>
      <div
        className="min-h-32 px-3 py-2 text-sm leading-relaxed outline-none [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
        contentEditable
        dangerouslySetInnerHTML={{ __html: initialValue }}
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        ref={editorRef}
        role="textbox"
        suppressContentEditableWarning
      />
    </div>
  );
}