import { Suspense } from "react";
import { LeadAnalysis } from "@/components/leads/lead-analysis";

export default function LeadAnalysisPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-[#675f57]">Caricamento analisi...</main>}>
      <LeadAnalysis />
    </Suspense>
  );
}
