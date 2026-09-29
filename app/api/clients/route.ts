import { type NextRequest, NextResponse } from "next/server";
import {
  type ClientListSort,
  type ClientListStatus,
  parseClientInput,
} from "@/lib/clients";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const clientFields =
  "id, first_name, last_name, email, phone, birth_date, is_archived, updated_at";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
  const status = (request.nextUrl.searchParams.get("status") ??
    "active") as ClientListStatus;
  const sort = (request.nextUrl.searchParams.get("sort") ??
    "alphabetical") as ClientListSort;

  if (!(["active", "archived"] as const).includes(status)) {
    return NextResponse.json({ error: "Filtro non valido." }, { status: 400 });
  }

  if (!( ["alphabetical", "recent", "next_session", "ltv"] as const).includes(sort)) {
    return NextResponse.json({ error: "Ordinamento non valido." }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("clients")
    .select(clientFields)
    .eq("is_archived", status === "archived");

  if (search) {
    const escapedSearch = search.replace(/[,%()]/g, " ");
    query = query.or(
      `first_name.ilike.%${escapedSearch}%,last_name.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%`,
    );
  }

  if (sort === "alphabetical") {
    query = query.order("last_name", { ascending: true }).order("first_name", {
      ascending: true,
    });
  } else if (sort === "recent") {
    query = query.order("updated_at", { ascending: false });
  } else {
    query = query.order("last_name", { ascending: true }).order("first_name", {
      ascending: true,
    });
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sortedClients = data;

  if (sort === "next_session" && data.length > 0) {
    const { data: upcomingSessions, error: upcomingSessionsError } = await supabaseAdmin
      .from("sessions")
      .select("client_id, scheduled_at")
      .in(
        "client_id",
        data.map((client) => client.id),
      )
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true });

    if (upcomingSessionsError) {
      return NextResponse.json({ error: upcomingSessionsError.message }, { status: 500 });
    }

    const nextSessionByClient = new Map<string, string>();
    for (const session of upcomingSessions) {
      if (!nextSessionByClient.has(session.client_id)) {
        nextSessionByClient.set(session.client_id, session.scheduled_at);
      }
    }

    sortedClients = [...data].sort((firstClient, secondClient) => {
      const firstSession = nextSessionByClient.get(firstClient.id);
      const secondSession = nextSessionByClient.get(secondClient.id);

      if (!firstSession) return 1;
      if (!secondSession) return -1;
      return firstSession.localeCompare(secondSession);
    });
  }

  if (sortedClients.length === 0) {
    return NextResponse.json({ clients: sortedClients });
  }

  const clientIds = sortedClients.map((client) => client.id);
  const [{ data: clientSessions, error: sessionsError }, { data: clientVouchers, error: vouchersError }] =
    await Promise.all([
      supabaseAdmin
        .from("sessions")
        .select("client_id, agreed_price_cents, current_stage:session_stages!sessions_current_stage_id_fkey(code), payments(amount_cents), extras:session_extras(price_cents,quantity)")
        .in("client_id", clientIds),
      supabaseAdmin
        .from("gift_vouchers")
        .select("purchaser_client_id, purchase_price_cents")
        .in("purchaser_client_id", clientIds),
    ]);

  if (sessionsError || vouchersError) {
    return NextResponse.json(
      { error: (sessionsError ?? vouchersError)?.message ?? "Non e stato possibile calcolare l'LTV." },
      { status: 500 },
    );
  }

  const ltvByClient = new Map<string, number>();
  const balanceByClient = new Map<string, number>();
  for (const session of clientSessions) {
    const extrasTotal = (session.extras ?? []).reduce((sum: number, extra: { price_cents: number; quantity: number }) => sum + extra.price_cents * extra.quantity, 0);
    ltvByClient.set(session.client_id, (ltvByClient.get(session.client_id) ?? 0) + session.agreed_price_cents + extrasTotal);
    const stage = session.current_stage as { code?: string } | null;
    if (stage?.code !== "cancelled") {
      const paid = (session.payments ?? []).reduce((sum: number, payment: { amount_cents: number }) => sum + payment.amount_cents, 0);
      const balance = session.agreed_price_cents + extrasTotal - paid;
      if (balance > 0) balanceByClient.set(session.client_id, (balanceByClient.get(session.client_id) ?? 0) + balance);
    }
  }
  for (const voucher of clientVouchers) {
    ltvByClient.set(
      voucher.purchaser_client_id,
      (ltvByClient.get(voucher.purchaser_client_id) ?? 0) + voucher.purchase_price_cents,
    );
  }

  const clients = sortedClients.map((client) => ({
    ...client,
    ltv_cents: ltvByClient.get(client.id) ?? 0,
    balance_cents: balanceByClient.get(client.id) ?? 0,
  }));

  if (sort === "ltv") {
    clients.sort(
      (firstClient, secondClient) =>
        secondClient.ltv_cents - firstClient.ltv_cents ||
        firstClient.last_name.localeCompare(secondClient.last_name) ||
        firstClient.first_name.localeCompare(secondClient.first_name),
    );
  }

  return NextResponse.json({ clients });
}


export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = parseClientInput(body);

  if (!result.data) {
    return NextResponse.json(
      { error: result.error ?? "I dati del cliente non sono validi." },
      { status: 400 },
    );
  }

  const clientInput = result.data;

  const { data, error } = await supabaseAdmin
    .from("clients")
    .insert({
      first_name: clientInput.firstName,
      last_name: clientInput.lastName,
      email: clientInput.email,
      phone: clientInput.phone,
      birth_date: clientInput.birthDate,
      address: clientInput.address,
      notes: clientInput.notes,
      privacy_consent_granted_at: clientInput.privacyConsentGranted ? new Date().toISOString() : null,
    })
    .select(clientFields)
    .single();

  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    const message =
      status === 409
        ? "Esiste gia un cliente con questa email."
        : "Non e stato possibile creare il cliente.";
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ client: data }, { status: 201 });
}