import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_BOOKING_FORM_FIELDS, type BookingFormFieldKey, priceForDate } from "@/lib/booking";
import { loadActiveEventTypeBySlug, resolveAvailableDays } from "@/lib/booking-server";
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

  const formFields = eventType.form_fields ?? DEFAULT_BOOKING_FORM_FIELDS;
  const values: Record<BookingFormFieldKey, unknown> = { firstName, lastName, email, phone, birthDate, participantsCount, notes: body.notes };
  const missing = Object.entries(formFields).find(([key, config]) => config.enabled && config.required && (values[key as BookingFormFieldKey] === null || values[key as BookingFormFieldKey] === undefined || values[key as BookingFormFieldKey] === ""));
  if (missing) return NextResponse.json({ error: "Compila tutti i campi obbligatori." }, { status: 400 });
  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Inserisci un indirizzo email valido." }, { status: 400 });
  if (formFields.birthDate.enabled && birthDate && !isValidDate(birthDate)) return NextResponse.json({ error: "Inserisci una data di nascita valida." }, { status: 400 });
  if (formFields.participantsCount.enabled && participantsCount !== null && (!Number.isInteger(participantsCount) || participantsCount <= 0)) return NextResponse.json({ error: "Il numero di partecipanti deve essere un intero positivo." }, { status: 400 });
  if (!privacyConsent) return NextResponse.json({ error: "È necessario accettare l'informativa sulla privacy." }, { status: 400 });

  const savedPhone = formFields.phone.enabled && phone ? phone : null;
  const savedBirthDate = formFields.birthDate.enabled && birthDate ? birthDate : null;
  const notes = formFields.notes.enabled && typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 2000) : null;

  const startsAt = new Date(slotStart);
  if (Number.isNaN(startsAt.valueOf())) return NextResponse.json({ error: "Orario selezionato non valido." }, { status: 400 });

  const dateKey = toLocalDateKey(startsAt);
  const days = await resolveAvailableDays(eventType, dateKey, dateKey);
  if (typeof days === "string") return NextResponse.json({ error: "Impossibile verificare la disponibilità." }, { status: 500 });

  const stillFree = days.some((day) => day.slots.some((slot) => slot.startsAt === startsAt.toISOString()));
  if (!stillFree) return NextResponse.json({ error: "Questo orario non è più disponibile. Scegline un altro." }, { status: 409 });

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
      participants_count: formFields.participantsCount.enabled ? participantsCount : null,
      agreed_price_cents: priceForDate(eventType, dateKey),
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
