import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const [clientsResult, servicesResult, methodsResult] = await Promise.all([
    supabaseAdmin.from("clients").select("id, first_name, last_name, email").eq("is_archived", false).order("last_name").order("first_name"),
    supabaseAdmin.from("service_types").select("id, name").eq("is_active", true).eq("is_addon", false).order("sort_order"),
    supabaseAdmin.from("payment_methods").select("id, name, code").eq("is_active", true).neq("code", "gift_voucher").order("sort_order"),
  ]);

  const error = clientsResult.error ?? servicesResult.error ?? methodsResult.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ clients: clientsResult.data, services: servicesResult.data, methods: methodsResult.data });
}
