import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ImportError = { row: number; error: string };

type RawSessionRow = {
  clientEmail?: unknown;
  clientFirstName?: unknown;
  clientLastName?: unknown;
  clientPhone?: unknown;
  scheduledDate?: unknown;
  serviceType?: unknown;
  priceEuros?: unknown;
  childName?: unknown;
  ageMonths?: unknown;
  notes?: unknown;
  externalId?: unknown;
};

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseDate(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parsePrice(value: string): number | null {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { sessions?: unknown[] } | null;
  if (!body || !Array.isArray(body.sessions)) {
    return NextResponse.json({ error: "Dati di importazione non validi." }, { status: 400 });
  }

  if (body.sessions.length === 0) return NextResponse.json({ error: "Nessuna riga da importare." }, { status: 400 });
  if (body.sessions.length > 1000) return NextResponse.json({ error: "Massimo 1000 righe per importazione." }, { status: 400 });

  const [{ data: serviceTypes, error: serviceTypesError }, { data: stages, error: stagesError }] = await Promise.all([
    supabaseAdmin.from("service_types").select("id, name").eq("is_active", true),
    supabaseAdmin.from("session_stages").select("id, code").in("code", ["booked", "completed"]),
  ]);

  if (serviceTypesError || stagesError) {
    return NextResponse.json({ error: "Non e stato possibile preparare l'importazione." }, { status: 500 });
  }

  const altroType = serviceTypes.find((type) => type.name.toLowerCase() === "altro");
  const bookedStage = stages.find((stage) => stage.code === "booked");
  const completedStage = stages.find((stage) => stage.code === "completed");

  if (!altroType || !bookedStage || !completedStage) {
    return NextResponse.json({ error: "Configurazione mancante: servizio Altro o avanzamenti non trovati." }, { status: 500 });
  }

  const clientIdByEmail = new Map<string, string>();
  const slotCountByDay = new Map<string, number>();
  const now = new Date();

  let imported = 0;
  const errors: ImportError[] = [];

  const rows = body.sessions as RawSessionRow[];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 1;

    try {
      const email = readText(row.clientEmail).toLowerCase();
      const firstName = readText(row.clientFirstName);
      const lastName = readText(row.clientLastName);
      const phone = readText(row.clientPhone) || null;
      const scheduledDateRaw = readText(row.scheduledDate);
      const serviceTypeRaw = readText(row.serviceType);
      const priceRaw = readText(row.priceEuros);
      const childName = readText(row.childName);
      const ageMonths = readText(row.ageMonths);
      const externalId = readText(row.externalId);
      const freeNotes = readText(row.notes);

      if (!email || !firstName || !lastName || !scheduledDateRaw || !serviceTypeRaw || !priceRaw) {
        errors.push({ row: rowNumber, error: "Cliente, data, servizio e prezzo sono obbligatori." });
        continue;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ row: rowNumber, error: "Email cliente non valida." });
        continue;
      }

      const scheduledDate = parseDate(scheduledDateRaw);
      if (!scheduledDate) {
        errors.push({ row: rowNumber, error: "Data sessione non valida." });
        continue;
      }

      const priceCents = parsePrice(priceRaw);
      if (priceCents === null) {
        errors.push({ row: rowNumber, error: "Prezzo non valido." });
        continue;
      }

      let clientId = clientIdByEmail.get(email);
      if (!clientId) {
        const { data: existingClient } = await supabaseAdmin.from("clients").select("id").eq("email", email).maybeSingle();
        if (existingClient) {
          clientId = existingClient.id as string;
        } else {
          const { data: newClient, error: createClientError } = await supabaseAdmin
            .from("clients")
            .insert({ first_name: firstName, last_name: lastName, email, phone })
            .select("id")
            .single();
          if (createClientError || !newClient) {
            errors.push({ row: rowNumber, error: "Non e stato possibile creare il cliente." });
            continue;
          }
          clientId = newClient.id as string;
        }
        clientIdByEmail.set(email, clientId);
      }

      const matchedType = serviceTypes.find((type) => type.name.toLowerCase() === serviceTypeRaw.toLowerCase());
      const serviceTypeId = matchedType ? matchedType.id : altroType.id;
      const serviceName = matchedType ? matchedType.name : "Altro";
      const serviceDetail = matchedType ? null : serviceTypeRaw;

      const slot = slotCountByDay.get(scheduledDate) ?? 0;
      slotCountByDay.set(scheduledDate, slot + 1);
      const startHour = 9 + slot;
      const scheduledAt = new Date(`${scheduledDate}T${String(startHour % 24).padStart(2, "0")}:00:00`);

      const noteParts = [
        childName ? `Bambino: ${childName}` : "",
        ageMonths ? `Eta: ${ageMonths} mesi` : "",
        externalId ? `Rif. import: ${externalId}` : "",
        freeNotes,
      ].filter(Boolean);
      const notes = noteParts.length > 0 ? noteParts.join(" - ") : null;

      const stageId = scheduledAt < now ? completedStage.id : bookedStage.id;

      const { error: insertError } = await supabaseAdmin.from("sessions").insert({
        client_id: clientId,
        service_type_id: serviceTypeId,
        service_name: serviceName,
        service_detail: serviceDetail,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: 60,
        agreed_price_cents: priceCents,
        current_stage_id: stageId,
        notes,
      });

      if (insertError) {
        errors.push({
          row: rowNumber,
          error: insertError.message.includes("overlaps") ? "La sessione si sovrappone a un'altra sessione." : "Inserimento non riuscito.",
        });
        continue;
      }

      imported += 1;
    } catch {
      errors.push({ row: rowNumber, error: "Riga non valida." });
    }
  }

  return NextResponse.json({ imported, errors });
}
