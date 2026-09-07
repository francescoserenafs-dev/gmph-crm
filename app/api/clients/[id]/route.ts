import { type NextRequest, NextResponse } from "next/server";
import { parseClientInput } from "@/lib/clients";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const clientFields =
  "id, first_name, last_name, email, phone, birth_date, address, notes, is_archived, privacy_consent_granted_at, privacy_consent_revoked_at, created_at, updated_at";

async function getClient(id: string) {
  return supabaseAdmin.from("clients").select(clientFields).eq("id", id).maybeSingle();
}

export async function GET(_request: NextRequest, context: RouteContext<"/api/clients/[id]">) {
  const { id } = await context.params;
  const { data, error } = await getClient(id);

  if (error) {
    return NextResponse.json({ error: "Non e stato possibile caricare il cliente." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Cliente non trovato." }, { status: 404 });
  }

  return NextResponse.json({ client: data });
}

export async function PATCH(request: NextRequest, context: RouteContext<"/api/clients/[id]">) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  if (body && typeof body === "object" && "action" in body) {
    const action = (body as { action?: unknown }).action;

    if (action === "updatePrivacyConsent") {
      const granted = (body as { granted?: unknown }).granted === true;

      const { data: current, error: currentError } = await getClient(id);
      if (currentError) return NextResponse.json({ error: "Non e stato possibile aggiornare il cliente." }, { status: 500 });
      if (!current) return NextResponse.json({ error: "Cliente non trovato." }, { status: 404 });

      const isActive = current.privacy_consent_granted_at !== null && current.privacy_consent_revoked_at === null;
      const now = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from("clients")
        .update({
          privacy_consent_granted_at: granted ? (isActive ? current.privacy_consent_granted_at : now) : current.privacy_consent_granted_at,
          privacy_consent_revoked_at: granted ? null : isActive ? now : current.privacy_consent_revoked_at,
        })
        .eq("id", id)
        .select(clientFields)
        .maybeSingle();

      if (error) return NextResponse.json({ error: "Non e stato possibile aggiornare il cliente." }, { status: 500 });
      if (!data) return NextResponse.json({ error: "Cliente non trovato." }, { status: 404 });

      return NextResponse.json({ client: data });
    }

    if (action !== "archive" && action !== "restore") {
      return NextResponse.json({ error: "Azione non valida." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("clients")
      .update({ is_archived: action === "archive" })
      .eq("id", id)
      .select(clientFields)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Non e stato possibile aggiornare il cliente." }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Cliente non trovato." }, { status: 404 });
    }

    return NextResponse.json({ client: data });
  }

  const result = parseClientInput(body);
  if (!result.data) {
    return NextResponse.json(
      { error: result.error ?? "I dati del cliente non sono validi." },
      { status: 400 },
    );
  }

  const { data: currentClient, error: currentClientError } = await getClient(id);
  if (currentClientError) {
    return NextResponse.json({ error: "Non e stato possibile aggiornare il cliente." }, { status: 500 });
  }

  if (!currentClient) {
    return NextResponse.json({ error: "Cliente non trovato." }, { status: 404 });
  }

  const clientInput = result.data;
  const now = new Date().toISOString();
  const privacyConsentIsActive =
    currentClient.privacy_consent_granted_at !== null &&
    currentClient.privacy_consent_revoked_at === null;

  const { data, error } = await supabaseAdmin
    .from("clients")
    .update({
      first_name: clientInput.firstName,
      last_name: clientInput.lastName,
      email: clientInput.email,
      phone: clientInput.phone,
      birth_date: clientInput.birthDate,
      address: clientInput.address,
      notes: clientInput.notes,
      privacy_consent_granted_at: clientInput.privacyConsentGranted
        ? privacyConsentIsActive
          ? currentClient.privacy_consent_granted_at
          : now
        : currentClient.privacy_consent_granted_at,
      privacy_consent_revoked_at: clientInput.privacyConsentGranted
        ? null
        : privacyConsentIsActive
          ? now
          : currentClient.privacy_consent_revoked_at,
    })
    .eq("id", id)
    .select(clientFields)
    .maybeSingle();

  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    const message =
      status === 409
        ? "Esiste gia un cliente con questa email."
        : "Non e stato possibile aggiornare il cliente.";
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ client: data });
}

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/clients/[id]">) {
  const { id } = await context.params;

  const [sessions, vouchers] = await Promise.all([
    supabaseAdmin.from("sessions").select("id", { count: "exact", head: true }).eq("client_id", id),
    supabaseAdmin.from("gift_vouchers").select("id", { count: "exact", head: true }).eq("purchaser_client_id", id),
  ]);

  const sessionCount = sessions.count ?? 0;
  const voucherCount = vouchers.count ?? 0;

  if (sessionCount > 0 || voucherCount > 0) {
    return NextResponse.json(
      { error: "Il cliente ha record collegati.", linked: { sessions: sessionCount, vouchers: voucherCount } },
      { status: 409 },
    );
  }

  const { error } = await supabaseAdmin.from("clients").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Eliminazione non riuscita." }, { status: 500 });

  return NextResponse.json({ ok: true });
}