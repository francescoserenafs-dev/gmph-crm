import { NextRequest, NextResponse } from "next/server";
import { parseClientInput } from "@/lib/clients";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ImportError = { row: number; error: string };

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { clients?: unknown[] } | null;
  if (!body || !Array.isArray(body.clients)) {
    return NextResponse.json({ error: "Dati di importazione non validi." }, { status: 400 });
  }

  if (body.clients.length === 0) return NextResponse.json({ error: "Nessuna riga da importare." }, { status: 400 });
  if (body.clients.length > 1000) return NextResponse.json({ error: "Massimo 1000 righe per importazione." }, { status: 400 });

  let imported = 0;
  const errors: ImportError[] = [];

  for (let index = 0; index < body.clients.length; index += 1) {
    const result = parseClientInput(body.clients[index]);
    if (!result.data) {
      errors.push({ row: index + 1, error: result.error ?? "Dati non validi." });
      continue;
    }

    const { error } = await supabaseAdmin.from("clients").insert({
      first_name: result.data.firstName,
      last_name: result.data.lastName,
      email: result.data.email,
      phone: result.data.phone,
      birth_date: result.data.birthDate,
      address: result.data.address,
      notes: result.data.notes,
      privacy_consent_granted_at: result.data.privacyConsentGranted ? new Date().toISOString() : null,
      image_consent_granted_at: result.data.imageConsentGranted ? new Date().toISOString() : null,
    });

    if (error) {
      errors.push({ row: index + 1, error: error.code === "23505" ? "Email gia presente." : "Inserimento non riuscito." });
      continue;
    }

    imported += 1;
  }

  return NextResponse.json({ imported, errors });
}
