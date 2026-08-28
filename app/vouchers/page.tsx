import { Suspense } from "react";
import { VoucherDirectory } from "@/components/vouchers/voucher-directory";

export default function VouchersPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-[#675f57]">Caricamento buoni...</main>}>
      <VoucherDirectory />
    </Suspense>
  );
}
