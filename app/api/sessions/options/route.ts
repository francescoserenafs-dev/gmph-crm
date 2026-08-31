import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const [clientsResult, servicesResult, stagesResult] = await Promise.all([
    supabaseAdmin.from("clients").select("id, first_name, last_name, email").eq("is_archived", false).order("last_name").order("first_name"),
    supabaseAdmin.from("service_types").select("id, name, is_addon").eq("is_active", true).order("sort_order"),
    supabaseAdmin.from("session_stages").select("id, name, code").eq("is_active", true).order("sort_order"),
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