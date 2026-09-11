import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingWidget } from "@/components/booking/booking-widget";
import { loadActiveEventTypeBySlug } from "@/lib/booking-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/prenota/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const eventType = await loadActiveEventTypeBySlug(slug);
  return {
    title: eventType ? `${eventType.name} · Giulia Malosso Photography` : "Prenotazione non disponibile",
    description: eventType?.description ?? undefined,
    robots: { index: false, follow: false },
  };
}

export default async function BookingPublicPage(props: PageProps<"/prenota/[slug]">) {
  const { slug } = await props.params;
  const eventType = await loadActiveEventTypeBySlug(slug);
  if (!eventType) notFound();

  return <BookingWidget slug={slug} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null} />;
}
