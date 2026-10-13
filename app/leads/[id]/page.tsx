import { Suspense } from "react";
import { LeadProfile } from "@/components/leads/lead-profile";

export default async function LeadPage(props: PageProps<"/leads/[id]">) {
  const { id } = await props.params;
  return (
    <Suspense fallback={<main className="p-8 text-sm text-[#675f57]">Caricamento lead...</main>}>
      <LeadProfile leadId={id} />
    </Suspense>
  );
}
