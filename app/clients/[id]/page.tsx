import { Suspense } from "react";
import { ClientProfile } from "@/components/clients/client-profile";

export default async function ClientPage(props: PageProps<"/clients/[id]">) {
  const { id } = await props.params;
  return (
    <Suspense fallback={<main className="p-8 text-sm text-[#675f57]">Caricamento cliente...</main>}>
      <ClientProfile clientId={id} />
    </Suspense>
  );
}