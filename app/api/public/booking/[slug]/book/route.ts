import { type NextRequest, NextResponse } from "next/server";
import { BOOKING_FORM_FIELD_KEYS, type BookingFormFieldKey, normalizeFormFields, priceForDate } from "@/lib/booking";
import { loadActiveEventTypeBySlug, loadEventTypeAddons, resolveAvailableDays } from "@/lib/booking-server";
import { toLocalDateKey } from "@/lib/datetime";
import { upsertIcloudEvent } from "@/lib/icloud-calendar";
import { clientIpFrom, isRateLimited } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyTurnstileToken } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(`${value}T12:00:00`);
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
}

export async function POST(request: NextRequest, context: RouteContext<"/api/public/booking/[slug]/book">) {
  const { slug } = await context.params;
  const ip = clientIpFrom(request);
  if (isRateLimited(`book:${ip}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: "Troppe richieste di prenotazione. Riprova più tardi." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dati non validi." }, { status: 400 });

  const captchaOk = await verifyTurnstileToken(typeof body.captchaToken === "string" ? body.captchaToken : null, ip);
  if (!captchaOk) return NextResponse.json({ error: "Verifica anti-spam non superata. Ricarica la pagina e riprova." }, { status: 400 });

  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const birthDate = typeof body.birthDate === "string" ? body.birthDate : "";
  const participantsCount = body.participantsCount === "" || body.participantsCount === undefined ? null : Number(body.participantsCount);
  const slotStart = typeof body.slotStart === "string" ? body.slotStart : "";
  const privacyConsent = body.privacyConsent === true;
  const imageConsent = body.imageConsent === true;

  const eventType = await loadActiveEventTypeBySlug(slug);
  if (!eventType) return NextResponse.json({ error: "Prenotazioni non disponibili." }, { status: 404 });

  const fieldItems = normalizeFormFields(eventType.form_fields);
  const predefinedConfig = Object.fromEntries(
    BOOKING_FORM_FIELD_KEYS.map((key) => {
      const item = fieldItems.find((field) => !field.custom && field.key === key);
      return [key, { enabled: item?.enabled ?? false, required: item?.required ?? false }];
    }),
  ) as Record<BookingFormFieldKey, { enabled: boolean; required: boolean }>;

  const values: Record<BookingFormFieldKey, unknown> = { firstName, lastName, email, phone, birthDate, participantsCount, notes: body.notes };
  const missing = Object.entries(predefinedConfig).find(([key, config]) => config.enabled && config.required && (values[key as BookingFormFieldKey] === null || values[key as BookingFormFieldKey] === undefined || values[key as BookingFormFieldKey] === ""));
  if (missing) return NextResponse.json({ error: "Compila tutti i campi obbligatori." }, { status: 400 });

  const customValues = body.customFields && typeof body.customFields === "object" ? (body.customFields as Record<string, unknown>) : {};
  const customLines: string[] = [];
  for (const item of fieldItems) {
    if (!item.custom || !item.enabled) continue;
    const raw = customValues[item.key];
    const answer = typeof raw === "string" ? raw.trim() : "";
    if (item.required && !answer) return NextResponse.json({ error: "Compila tutti i campi obbligatori." }, { status: 400 });
    if (answer) customLines.push(`${item.label}: ${answer.slice(0, 1000)}`);
  }

  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Inserisci un indirizzo email valido." }, { status: 400 });
  if (predefinedConfig.birthDate.enabled && birthDate && !isValidDate(birthDate)) return NextResponse.json({ error: "Inserisci una data di nascita valida." }, { status: 400 });
  if (predefinedConfig.participantsCount.enabled && participantsCount !== null && (!Number.isInteger(participantsCount) || participantsCount <= 0)) return NextResponse.json({ error: "Il numero di partecipanti deve essere un intero positivo." }, { status: 400 });
  if (!privacyConsent) return NextResponse.json({ error: "È necessario accettare l'informativa sulla privacy." }, { status: 400 });

  const savedPhone = predefinedConfig.phone.enabled && phone ? phone : null;
  const savedBirthDate = predefinedConfig.birthDate.enabled && birthDate ? birthDate : null;
  const notesInput = predefinedConfig.notes.enabled && typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : "";
  const notesParts = [notesInput, ...customLines].filter((part) => part.length > 0);
  const notes = notesParts.length > 0 ? notesParts.join("\n\n").slice(0, 2000) : null;

  const startsAt = new Date(slotStart);
  if (Number.isNaN(startsAt.valueOf())) return NextResponse.json({ error: "Orario selezionato non valido." }, { status: 400 });

  const dateKey = toLocalDateKey(startsAt);
  const days = await resolveAvailableDays(eventType, dateKey, dateKey);
  if (typeof days === "string") return NextResponse.json({ error: "Impossibile verificare la disponibilità." }, { status: 500 });

  const stillFree = days.some((day) => day.slots.some((slot) => slot.startsAt === startsAt.toISOString()));
  if (!stillFree) return NextResponse.json({ error: "Questo orario non è più disponibile. Scegline un altro." }, { status: 409 });

  const addonCatalog = await loadEventTypeAddons(eventType.id, true);
  const addonById = new Map(addonCatalog.map((addon) => [addon.id, addon]));
  const selectedAddons: { addon: (typeof addonCatalog)[number]; quantity: number }[] = [];
  for (const raw of Array.isArray(body.addons) ? body.addons : []) {
    const item = raw as Record<string, unknown>;
    const addon = typeof item.id === "string" ? addonById.get(item.id) : undefined;
    if (!addon) return NextResponse.json({ error: "Un'opzione selezionata non è più disponibile. Ricarica la pagina." }, { status: 400 });
    if (selectedAddons.some((entry) => entry.addon.id === addon.id)) return NextResponse.json({ error: "Hai selezionato la stessa opzione più volte." }, { status: 400 });
    const quantity = Number(item.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) return NextResponse.json({ error: "Quantità non valida." }, { status: 400 });
    if (addon.max_quantity !== null && quantity > addon.max_quantity) return NextResponse.json({ error: "Quantità superiore al massimo consentito." }, { status: 400 });
    selectedAddons.push({ addon, quantity });
  }
  const digitalCount = selectedAddons.filter((entry) => entry.addon.category === "digital").length;
  const printCount = selectedAddons.filter((entry) => entry.addon.category === "print").length;
  if (eventType.addons_digital_mode === "single" && digitalCount > 1) return NextResponse.json({ error: "Puoi scegliere una sola opzione tra le foto digitali." }, { status: 400 });
  if (eventType.addons_print_mode === "single" && printCount > 1) return NextResponse.json({ error: "Puoi scegliere una sola opzione tra le stampe." }, { status: 400 });

  const sessionPriceCents = priceForDate(eventType, dateKey);
  const addonsTotalCents = selectedAddons.reduce((sum, entry) => sum + entry.addon.price_cents * entry.quantity, 0);
  const depositCents = Math.min(eventType.deposit_cents, sessionPriceCents + addonsTotalCents);

  const [{ data: service }, { data: stage }] = await Promise.all([
    supabaseAdmin.from("service_types").select("id, name").eq("id", eventType.service_type_id).maybeSingle(),
    supabaseAdmin.from("session_stages").select("id").eq("code", "booked").maybeSingle(),
  ]);
  if (!service || !stage) return NextResponse.json({ error: "Configurazione non completa. Contatta lo studio." }, { status: 500 });

  const now = new Date().toISOString();
  const { data: existingClient } = await supabaseAdmin.from("clients").select("id, first_name, last_name, phone, birth_date, privacy_consent_granted_at, privacy_consent_revoked_at").ilike("email", email).maybeSingle();

  let clientId: string;
  if (existingClient) {
    const patch: Record<string, unknown> = {};
    if (existingClient.first_name !== firstName) patch.first_name = firstName;
    if (existingClient.last_name !== lastName) patch.last_name = lastName;
    if (savedPhone && existingClient.phone !== savedPhone) patch.phone = savedPhone;
    if (savedBirthDate && existingClient.birth_date !== savedBirthDate) patch.birth_date = savedBirthDate;
    if (!existingClient.privacy_consent_granted_at || existingClient.privacy_consent_revoked_at) {
      patch.privacy_consent_granted_at = now;
      patch.privacy_consent_revoked_at = null;
    }
    if (Object.keys(patch).length > 0) await supabaseAdmin.from("clients").update(patch).eq("id", existingClient.id);
    clientId = existingClient.id;
  } else {
    const { data: created, error } = await supabaseAdmin
      .from("clients")
      .insert({ first_name: firstName, last_name: lastName, email, phone: savedPhone, birth_date: savedBirthDate, privacy_consent_granted_at: now })
      .select("id")
      .single();
    if (error || !created) return NextResponse.json({ error: "Non è stato possibile registrare i tuoi dati." }, { status: 500 });
    clientId = created.id;
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("sessions")
    .insert({
      client_id: clientId,
      service_type_id: service.id,
      service_name: service.name,
      service_detail: service.name === "Altro" ? eventType.name : null,
      scheduled_at: startsAt.toISOString(),
      duration_minutes: eventType.duration_minutes,
      location: eventType.location,
      notes,
      participants_count: predefinedConfig.participantsCount.enabled ? participantsCount : null,
      agreed_price_cents: sessionPriceCents,
      deposit_cents: depositCents,
      current_stage_id: stage.id,
      image_consent_granted_at: eventType.ask_image_consent && imageConsent ? now : null,
      booking_event_type_id: eventType.id,
      booked_online_at: now,
    })
    .select("id, scheduled_at")
    .single();

  if (sessionError || !session) {
    const overlapping = sessionError?.message.includes("overlaps");
    return NextResponse.json(
      { error: overlapping ? "Questo orario è appena stato occupato. Scegline un altro." : "Prenotazione non riuscita. Riprova." },
      { status: overlapping ? 409 : 500 },
    );
  }

  if (selectedAddons.length > 0) {
    await supabaseAdmin.from("session_extras").insert(
      selectedAddons.map((entry) => ({
        session_id: session.id,
        service_type_id: null,
        service_name: entry.addon.name,
        price_cents: entry.addon.price_cents,
        quantity: entry.quantity,
        booking_addon_id: entry.addon.id,
      })),
    );
  }

  const icloudEventUrl = await upsertIcloudEvent(
    {
      id: session.id,
      scheduledAt: session.scheduled_at,
      durationMinutes: eventType.duration_minutes,
      location: eventType.location,
      notes,
      serviceName: service.name,
      clientName: `${firstName} ${lastName}`,
    },
    null,
  );
  if (icloudEventUrl) await supabaseAdmin.from("sessions").update({ icloud_event_url: icloudEventUrl }).eq("id", session.id);

  return NextResponse.json({ startsAt: session.scheduled_at, durationMinutes: eventType.duration_minutes, location: eventType.location }, { status: 201 });
}
