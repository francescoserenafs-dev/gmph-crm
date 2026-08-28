import { Suspense } from "react";
import { SessionDirectory } from "@/components/sessions/session-directory";

export default function SessionsPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-[#675f57]">Caricamento sessioni...</main>}>
      <SessionDirectory />
    </Suspense>
  );
}