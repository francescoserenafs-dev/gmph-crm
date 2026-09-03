import { NextRequest, NextResponse } from "next/server";
import { addSubscriberToGroup, findMailerLiteSubscriber, removeSubscriberFromGroup, upsertMailerLiteSubscriber } from "@/lib/mailerlite";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Client = { id: string; first_name: string; last_name: string; email: string; phone: string | null; updated_at: string; privacy_consent_granted_at: string | null; privacy_consent_revoked_at: string | null; mailerlite_subscriber_id: string | null; mailerlite_sync_status: string };
type SyncItem = Client & { action: "create" | "update" | "retry"; group: "marketing" | "transactional" };

async function loadSyncData() {
  const [{ data: settings, error: settingsError }, { data: clients, error: clientsError }] = await Promise.all([
    supabaseAdmin.from("app_settings").select("mailerlite_transactional_group_id, mailerlite_marketing_group_id, mailerlite_last_sync_at").eq("id", true).maybeSingle(),
    supabaseAdmin.from("clients").select("id, first_name, last_name, email, phone, updated_at, privacy_consent_granted_at, privacy_consent_revoked_at, mailerlite_subscriber_id, mailerlite_sync_status").order("last_name").order("first_name"),
  ]);
  if (settingsError || clientsError) throw new Error((settingsError ?? clientsError)?.message ?? "Dati di sincronizzazione non disponibili.");
  if (!settings?.mailerlite_transactional_group_id || !settings.mailerlite_marketing_group_id) throw new Error("Configura prima i due gruppi MailerLite.");
  const lastSync = settings.mailerlite_last_sync_at ? new Date(settings.mailerlite_last_sync_at) : null;
  const selected = (clients ?? []).filter((client) => !lastSync || new Date(client.updated_at) > lastSync || client.mailerlite_sync_status === "error") as Client[];
  return { settings, clients: selected };
}

async function prepareItems() {
  const { settings, clients } = await loadSyncData();
  const items: SyncItem[] = [];
  for (const client of clients) {
    const existing = client.mailerlite_subscriber_id ? { id: client.mailerlite_subscriber_id } : await findMailerLiteSubscriber(client.email);
    items.push({ ...client, mailerlite_subscriber_id: existing?.id ?? null, action: existing ? client.mailerlite_sync_status === "error" ? "retry" : "update" : "create", group: client.privacy_consent_granted_at && !client.privacy_consent_revoked_at ? "marketing" : "transactional" });
  }
  return { settings, items };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { execute?: boolean } | null;
  try {
    const { settings, items } = await prepareItems();
    if (!body?.execute) return NextResponse.json({ items, total: items.length });
    const syncedAt = new Date().toISOString();
    let synced = 0;
    const errors: { id: string; name: string; error: string }[] = [];
    for (const item of items) {
      try {
        const subscriber = await upsertMailerLiteSubscriber({ id: item.mailerlite_subscriber_id, email: item.email, name: item.first_name, lastName: item.last_name, phone: item.phone });
        const targetGroup = item.group === "marketing" ? settings.mailerlite_marketing_group_id : settings.mailerlite_transactional_group_id;
        const otherGroup = item.group === "marketing" ? settings.mailerlite_transactional_group_id : settings.mailerlite_marketing_group_id;
        await addSubscriberToGroup(subscriber.id, targetGroup);
        await removeSubscriberFromGroup(subscriber.id, otherGroup);
        await supabaseAdmin.from("clients").update({ mailerlite_subscriber_id: subscriber.id, mailerlite_sync_status: "synced", mailerlite_synced_at: syncedAt, mailerlite_last_error: null }).eq("id", item.id);
        synced += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sincronizzazione non riuscita.";
        errors.push({ id: item.id, name: `${item.first_name} ${item.last_name}`, error: message });
        await supabaseAdmin.from("clients").update({ mailerlite_sync_status: "error", mailerlite_last_error: message }).eq("id", item.id);
      }
    }
    await supabaseAdmin.from("app_settings").update({ mailerlite_last_sync_at: syncedAt }).eq("id", true);
    return NextResponse.json({ synced, errors, total: items.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sincronizzazione MailerLite non riuscita." }, { status: 502 });
  }
}