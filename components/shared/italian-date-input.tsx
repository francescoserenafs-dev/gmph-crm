"use client";

import { useState } from "react";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ITALIAN_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function toItalianDate(value: string): string {
  if (!ISO_DATE_PATTERN.test(value)) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function toIsoDate(value: string): string | null {
  const match = ITALIAN_DATE_PATTERN.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T12:00:00`);
  return date.getFullYear() === Number(year) && date.getMonth() + 1 === Number(month) && date.getDate() === Number(day) ? iso : null;
}

export function ItalianDateInput({ className, onChange, required = false, value }: { className?: string; onChange: (value: string) => void; required?: boolean; value: string }) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      className={className}
      inputMode="numeric"
      maxLength={10}
      onBlur={() => setDraft(null)}
      onChange={(event) => {
        const next = event.target.value.replace(/[^\d/]/g, "");
        setDraft(next);
        const iso = toIsoDate(next);
        if (iso) onChange(iso);
        if (!next) onChange("");
      }}
      placeholder="DD/MM/YYYY"
      required={required}
      type="text"
      value={draft ?? toItalianDate(value)}
    />
  );
}