import { Suspense } from "react";
import { PaymentDirectory } from "@/components/payments/payment-directory";

export default function PaymentsPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-[#675f57]">Caricamento pagamenti...</main>}>
      <PaymentDirectory />
    </Suspense>
  );
}
