"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";

type ActionMenuItem = { label: string; onClick: () => void; destructive?: boolean };

export function ActionMenu({ items }: { items: ActionMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-label="Altre azioni"
        className="grid size-11 place-items-center border border-[#cfc5b8] hover:bg-[#eee8df]"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <MoreVertical className="size-5" strokeWidth={1.8} />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-56 border border-[#d8d0c5] bg-white text-sm shadow-lg">
          {items.map((item) => (
            <button
              className={`block w-full px-4 py-3 text-left hover:bg-[#f5f1eb] ${item.destructive ? "text-[#a53e31]" : ""}`}
              key={item.label}
              onClick={() => { setOpen(false); item.onClick(); }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
