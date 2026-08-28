import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const allowedTables = new Set(["clients", "sessions", "gift_vouchers", "payments"]);

export async function GET(request: NextRequest) {
  const table = request.nextUrl.searchParams.get("table") ?? "";
  const recordId = request.nextUrl.searchParams.get("id") ?? "";

  if (!allowedTables.has(table) || !recordId) {
    return NextResponse.json({ error: "Parametri non validi." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("audit_log")
    .select("id, action, changed_fields, old_data, new_data, created_at")
    .eq("table_name", table)
    .eq("record_id", recordId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ entries: data ?? [] });
}
