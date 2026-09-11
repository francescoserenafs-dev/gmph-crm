import Link from "next/link";

export default function BookingNotFound() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#fdfbf8] px-6 text-center text-[#27231f]">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.34em] text-[#9b5d43]">Giulia Malosso Photography</p>
      <h1 className="mt-6 font-serif text-3xl">Prenotazioni non disponibili</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-[#675f57]">
        Questo link non è più attivo oppure le prenotazioni per questo servizio sono momentaneamente chiuse. Scrivi
        direttamente a Giulia per fissare un appuntamento.
      </p>
      {siteUrl ? (
        <Link className="mt-8 border border-[#9b5d43] px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#9b5d43] transition-colors hover:bg-[#f1e3db]" href={siteUrl}>
          Torna al sito
        </Link>
      ) : null}
    </main>
  );
}
