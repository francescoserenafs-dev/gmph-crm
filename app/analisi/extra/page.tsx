import { Suspense } from "react";
import { ExtraAnalysis } from "@/components/extras/extra-analysis";

export default function ExtraAnalysisPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-[#675f57]">Caricamento analisi...</main>}>
      <ExtraAnalysis />
    </Suspense>
  );
}
