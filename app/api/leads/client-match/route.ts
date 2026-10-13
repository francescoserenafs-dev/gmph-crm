import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Match esatto case-insensitive: i caratteri jolly di ILIKE vengono neutralizzati.
function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Inserisci un indirizzo email valido." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("id, first_name, last_name, email, is_archived")
    .ilike("email", escapeLikePattern(email))
    .limit(5);

  if (error) return NextResponse.json({ error: "Ricerca cliente non riuscita." }, { status: 500 });

  const client = (data ?? []).find((row) => row.email.trim().toLowerCase() === email) ?? null;
  if (!client) return NextResponse.json({ client: null });

  const { count } = await supabaseAdmin.from("sessions").select("id", { count: "exact", head: true }).eq("client_id", client.id);

  return NextResponse.json({ client: { ...client, session_count: count ?? 0 } });
}
