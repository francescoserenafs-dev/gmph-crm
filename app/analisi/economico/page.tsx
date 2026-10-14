import { Suspense } from "react";
import { EconomicAnalysis } from "@/components/economic/economic-analysis";

export default function EconomicAnalysisPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-[#675f57]">Caricamento analisi...</main>}>
      <EconomicAnalysis />
    </Suspense>
  );
}
