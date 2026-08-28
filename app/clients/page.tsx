import { Suspense } from "react";
import { ClientDirectory } from "@/components/clients/client-directory";

export default function ClientsPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-[#675f57]">Caricamento clienti...</main>}>
      <ClientDirectory />
    </Suspense>
  );
}