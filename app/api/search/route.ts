import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function escape(term: string) {
  return term.replace(/[,%()]/g, " ");
}

function dedupeById<T extends { id: string }>(rows: T[]) {
  return rows.filter((row, index) => rows.findIndex((other) => other.id === row.id) === index);
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ clients: [], sessions: [], vouchers: [], payments: [] });

  const term = escape(q);

  const { data: matchingClients } = await supabaseAdmin
    .from("clients")
    .select("id, first_name, last_name, email")
    .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`)
    .limit(8);

  const clientIds = (matchingClients ?? []).map((client) => client.id);
  const clientIdList = clientIds.length > 0 ? clientIds.join(",") : "00000000-0000-0000-0000-000000000000";

  const paymentFields = "id, amount_cents, paid_at, category, payment_method_name, reference, notes, session:sessions!payments_session_id_fkey(id, service_name, scheduled_at, client:clients!sessions_client_id_fkey(first_name,last_name)), voucher:gift_vouchers!payments_voucher_id_fkey(id, code, purchaser:clients!gift_vouchers_purchaser_client_id_fkey(first_name,last_name))";

  const [sessionsByService, sessionsByClient, vouchersByCode, vouchersByClient, paymentsByText, paymentsBySessionClient, paymentsByVoucherClient] = await Promise.all([
    supabaseAdmin
      .from("sessions")
      .select("id, scheduled_at, service_name, client:clients!sessions_client_id_fkey(first_name,last_name)")
      .ilike("service_name", `%${term}%`)
      .limit(8),
    supabaseAdmin
      .from("sessions")
      .select("id, scheduled_at, service_name, client:clients!sessions_client_id_fkey(first_name,last_name)")
      .in("client_id", clientIds.length > 0 ? clientIds : ["00000000-0000-0000-0000-000000000000"])
      .limit(8),
    supabaseAdmin
      .from("gift_vouchers")
      .select("id, code, service_name, purchaser:clients!gift_vouchers_purchaser_client_id_fkey(first_name,last_name), recipient:clients!gift_vouchers_recipient_client_id_fkey(first_name,last_name)")
      .ilike("code", `%${term}%`)
      .limit(8),
    supabaseAdmin
      .from("gift_vouchers")
      .select("id, code, service_name, purchaser:clients!gift_vouchers_purchaser_client_id_fkey(first_name,last_name), recipient:clients!gift_vouchers_recipient_client_id_fkey(first_name,last_name)")
      .or(`purchaser_client_id.in.(${clientIdList}),recipient_client_id.in.(${clientIdList})`)
      .limit(8),
    supabaseAdmin
      .from("payments")
      .select(paymentFields)
      .or(`reference.ilike.%${term}%,notes.ilike.%${term}%`)
      .limit(8),
    clientIds.length > 0
      ? supabaseAdmin
          .from("payments")
          .select(`${paymentFields}, session_client:sessions!inner(client_id)`)
          .in("session_client.client_id", clientIds)
          .limit(8)
      : Promise.resolve({ data: [] as unknown[] }),
    clientIds.length > 0
      ? supabaseAdmin
          .from("payments")
          .select(`${paymentFields}, voucher_purchaser:gift_vouchers!payments_voucher_id_fkey!inner(purchaser_client_id)`)
          .in("voucher_purchaser.purchaser_client_id", clientIds)
          .limit(8)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  return NextResponse.json({
    clients: matchingClients ?? [],
    sessions: dedupeById([...(sessionsByService.data ?? []), ...(sessionsByClient.data ?? [])]),
    vouchers: dedupeById([...(vouchersByCode.data ?? []), ...(vouchersByClient.data ?? [])]),
    payments: dedupeById([
      ...(paymentsByText.data ?? []),
      ...((paymentsBySessionClient.data ?? []) as unknown[]),
      ...((paymentsByVoucherClient.data ?? []) as unknown[]),
    ] as { id: string }[]),
  });
}
