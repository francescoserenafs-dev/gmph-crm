import { NextRequest, NextResponse } from "next/server";
import { batchUpsertMailerLiteSubscribers } from "@/lib/mailerlite";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Client = { id: string; first_name: string; last_name: string; email: string; phone: string | null; mailerlite_subscriber_id: string | null };

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { sessionIds?: unknown; groupId?: unknown } | null;
  const sessionIds = Array.isArray(body?.sessionIds) ? body!.sessionIds.filter((id): id is string => typeof id === "string") : [];
  const groupId = typeof body?.groupId === "string" ? body.groupId.trim() : "";

  if (sessionIds.length === 0) return NextResponse.json({ error: "Seleziona almeno una sessione." }, { status: 400 });
  if (!groupId) return NextResponse.json({ error: "Seleziona un gruppo MailerLite." }, { status: 400 });

  try {
    const { data: sessions, error: sessionsError } = await supabaseAdmin.from("sessions").select("client_id").in("id", sessionIds);
    if (sessionsError) throw new Error(sessionsError.message);

    const clientIds = Array.from(new Set((sessions ?? []).map((session) => session.client_id).filter((id): id is string => Boolean(id))));
    if (clientIds.length === 0) return NextResponse.json({ error: "Le sessioni selezionate non hanno clienti associati." }, { status: 400 });

    const { data: clientsData, error: clientsError } = await supabaseAdmin
      .from("clients")
      .select("id, first_name, last_name, email, phone, mailerlite_subscriber_id")
      .in("id", clientIds);
    if (clientsError) throw new Error(clientsError.message);

    const clients = (clientsData ?? []).filter((client) => Boolean(client.email)) as Client[];
    if (clients.length === 0) return NextResponse.json({ error: "I clienti selezionati non hanno un indirizzo email." }, { status: 400 });

    const syncedAt = new Date().toISOString();
    let added = 0;
    const errors: { id: string; name: string; error: string }[] = [];

    for (let start = 0; start < clients.length; start += 50) {
      const batch = clients.slice(start, start + 50);
      const results = await batchUpsertMailerLiteSubscribers(batch.map((client) => ({
        id: client.mailerlite_subscriber_id,
        email: client.email,
        name: client.first_name,
        lastName: client.last_name,
        phone: client.phone,
        groupId,
      })));
      for (let index = 0; index < batch.length; index += 1) {
        const client = batch[index];
        const result = results[index] ?? { ok: false, id: null, error: "Risposta batch incompleta." };
        if (result.ok && result.id) {
          await supabaseAdmin.from("clients").update({ mailerlite_subscriber_id: result.id, mailerlite_sync_status: "synced", mailerlite_synced_at: syncedAt, mailerlite_last_error: null }).eq("id", client.id);
          added += 1;
        } else {
          errors.push({ id: client.id, name: `${client.first_name} ${client.last_name}`, error: result.error });
          await supabaseAdmin.from("clients").update({ mailerlite_sync_status: "error", mailerlite_last_error: result.error }).eq("id", client.id);
        }
      }
    }

    return NextResponse.json({ added, total: clients.length, errors });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Aggiunta al gruppo MailerLite non riuscita." }, { status: 502 });
  }
}
