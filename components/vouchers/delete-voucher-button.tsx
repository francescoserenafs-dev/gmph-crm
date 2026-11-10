"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

type Props = {
  voucher: {
    id: string;
    code: string;
    status: string;
    redeemed_session_id: string | null;
    redemptions?: { id: string }[];
  };
  compact?: boolean;
  disabled?: boolean;
  onDeleted: () => void;
  onError: (message: string | null) => void;
};

export function DeleteVoucherButton({ voucher, compact = false, disabled = false, onDeleted, onError }: Props) {
  const [deleting, setDeleting] = useState(false);

  if (voucher.status === "redeemed" || voucher.redeemed_session_id || (voucher.redemptions?.length ?? 0) > 0) return null;

  async function deleteVoucher() {
    if (deleting || disabled) return;
    if (!window.confirm(`Eliminare definitivamente il buono "${voucher.code}"? Saranno eliminati anche tutti i pagamenti di acquisto collegati, che non compariranno piu negli incassi. Questa operazione non registra un rimborso e non puo essere annullata.`)) return;

    setDeleting(true);
    onError(null);
    try {
      const response = await fetch(`/api/vouchers/${voucher.id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Eliminazione non riuscita.");
      onDeleted();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Eliminazione non riuscita.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      aria-label={`Elimina buono ${voucher.code}`}
      aria-busy={deleting}
      className={`${compact ? "size-8 shrink-0" : "min-h-11 px-4"} inline-flex items-center justify-center gap-2 border border-[#a53e31] text-sm font-semibold text-[#a53e31] hover:bg-[#fae8e4] disabled:cursor-not-allowed disabled:opacity-60`}
      disabled={disabled || deleting}
      onClick={deleteVoucher}
      title={deleting ? "Eliminazione in corso" : "Elimina buono"}
      type="button"
    >
      <Trash2 aria-hidden="true" className="size-4 shrink-0" />
      {compact ? null : deleting ? "Eliminazione..." : "Elimina buono"}
    </button>
  );
}