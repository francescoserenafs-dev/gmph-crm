"use client";

import { useEffect, useMemo, useState } from "react";

type ClientOption = { id: string; first_name: string; last_name: string; email: string };

export function ClientCombobox({
  clients,
  onChange,
  value,
  label = "Cliente",
  placeholder = "Cerca per nome, cognome o email",
  emptyLabel,
  required = true,
}: {
  clients: ClientOption[];
  onChange: (clientId: string) => void;
  value: string;
  label?: string;
  placeholder?: string;
  emptyLabel?: string;
  required?: boolean;
}) {
  const selected = clients.find((client) => client.id === value) ?? null;
  const [query, setQuery] = useState(selected ? `${selected.last_name} ${selected.first_name}` : "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const current = clients.find((client) => client.id === value) ?? null;
    setQuery(current ? `${current.last_name} ${current.first_name}` : "");
  }, [value, clients]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clients.slice(0, 30);
    return clients
      .filter((client) => `${client.last_name} ${client.first_name} ${client.email}`.toLowerCase().includes(needle))
      .slice(0, 30);
  }, [query, clients]);

  return (
    <label className="relative flex flex-col gap-2 text-sm font-medium">
      {label}
      <input
        className="h-11 border border-[#cfc5b8] bg-white px-3"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        required={required && !value}
        value={query}
      />
      {open ? (
        <ul className="absolute left-0 top-full z-20 mt-1 max-h-60 w-full overflow-y-auto border border-[#cfc5b8] bg-white shadow-lg">
          {emptyLabel ? (
            <li>
              <button
                className="block w-full px-3 py-2 text-left text-sm text-[#675f57] hover:bg-[#eee8df]"
                onClick={() => { onChange(""); setQuery(""); setOpen(false); }}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                {emptyLabel}
              </button>
            </li>
          ) : null}
          {filtered.map((client) => (
            <li key={client.id}>
              <button
                className="block w-full px-3 py-2 text-left text-sm hover:bg-[#eee8df]"
                onClick={() => {
                  onChange(client.id);
                  setQuery(`${client.last_name} ${client.first_name}`);
                  setOpen(false);
                }}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                {client.last_name} {client.first_name} - {client.email}
              </button>
            </li>
          ))}
          {filtered.length === 0 && !emptyLabel ? (
            <li className="px-3 py-2 text-sm text-[#958b80]">Nessun cliente trovato.</li>
          ) : null}
        </ul>
      ) : null}
    </label>
  );
}
