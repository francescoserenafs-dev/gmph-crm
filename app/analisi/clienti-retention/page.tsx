import { Suspense } from "react";
import { ClientRetentionAnalysis } from "@/components/clients/client-retention-analysis";

export default function ClientRetentionAnalysisPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-[#675f57]">Caricamento analisi...</main>}>
      <ClientRetentionAnalysis />
    </Suspense>
  );
}