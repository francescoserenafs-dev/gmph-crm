import { type NextRequest, NextResponse } from "next/server";
import { normalizeFormFields } from "@/lib/booking";
import { loadActiveEventTypeBySlug, loadEventTypeAddons, resolveAvailableDays, sanitizeBookingDescription } from "@/lib/booking-server";
import { addDaysToDateKey, toLocalDateKey } from "@/lib/datetime";
import { clientIpFrom, isRateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: RouteContext<"/api/public/booking/[slug]">) {
  const { slug } = await context.params;
  if (isRateLimited(`slots:${clientIpFrom(request)}`, 60, 60_000)) {
    return NextResponse.json({ error: "Troppe richieste, riprova tra qualche istante." }, { status: 429 });
  }

  const eventType = await loadActiveEventTypeBySlug(slug);
  if (!eventType) return NextResponse.json({ error: "Prenotazioni non disponibili." }, { status: 404 });

  const rangeStart = toLocalDateKey(new Date());
  const days = await resolveAvailableDays(eventType, rangeStart, addDaysToDateKey(rangeStart, 120));
  if (typeof days === "string") return NextResponse.json({ error: "Impossibile caricare le disponibilità." }, { status: 500 });

  const addons = await loadEventTypeAddons(eventType.id, true);

  return NextResponse.json({
    eventType: {
      slug: eventType.slug,
      name: eventType.name,
      description: sanitizeBookingDescription(eventType.description),
      durationMinutes: eventType.duration_minutes,
      location: eventType.location,
      showPrice: eventType.show_price,
      weekdayPriceCents: eventType.weekday_price_cents,
      weekendPriceCents: eventType.weekend_price_cents,
      askImageConsent: eventType.ask_image_consent,
      formFields: normalizeFormFields(eventType.form_fields),
      addonsDigitalMode: eventType.addons_digital_mode,
      addonsPrintMode: eventType.addons_print_mode,
      depositCents: eventType.deposit_cents,
      addons: addons.map((addon) => ({ id: addon.id, category: addon.category, name: addon.name, tooltip: addon.tooltip, priceCents: addon.price_cents, maxQuantity: addon.max_quantity })),
    },
    days,
  });
}
