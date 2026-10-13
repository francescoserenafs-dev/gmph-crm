import { Suspense } from "react";
import { LeadDirectory } from "@/components/leads/lead-directory";

export default function LeadsPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-[#675f57]">Caricamento lead...</main>}>
      <LeadDirectory />
    </Suspense>
  );
}
