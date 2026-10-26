import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "1";
  let clientsQuery = supabaseAdmin.from("clients").select("id, first_name, last_name, email, is_archived");
  if (!includeArchived) clientsQuery = clientsQuery.eq("is_archived", false);
  clientsQuery = clientsQuery.order("last_name").order("first_name");

  const [clientsResult, servicesResult, stagesResult] = await Promise.all([
    clientsQuery,
    supabaseAdmin.from("service_types").select("id, name, is_addon, saturday_surcharge_cents").eq("is_active", true).order("sort_order"),
    supabaseAdmin.from("session_stages").select("id, name, code, ball_owner").eq("is_active", true).order("sort_order"),
  ]);

  const error = clientsResult.error ?? servicesResult.error ?? stagesResult.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const allServices = servicesResult.data ?? [];
  return NextResponse.json({
    clients: clientsResult.data,
    services: allServices.filter((service) => !service.is_addon),
    addonServices: allServices.filter((service) => service.is_addon),
    stages: stagesResult.data,
  });
}