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
  if (q.length < 2) return NextResponse.json({ clients: [], sessions: [], vouchers: [] });

  const term = escape(q);

  const { data: matchingClients } = await supabaseAdmin
    .from("clients")
    .select("id, first_name, last_name, email")
    .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`)
    .limit(8);

  const clientIds = (matchingClients ?? []).map((client) => client.id);
  const clientIdList = clientIds.length > 0 ? clientIds.join(",") : "00000000-0000-0000-0000-000000000000";

  const [sessionsByService, sessionsByClient, vouchersByCode, vouchersByClient] = await Promise.all([
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
  ]);

  return NextResponse.json({
    clients: matchingClients ?? [],
    sessions: dedupeById([...(sessionsByService.data ?? []), ...(sessionsByClient.data ?? [])]),
    vouchers: dedupeById([...(vouchersByCode.data ?? []), ...(vouchersByClient.data ?? [])]),
  });
}
