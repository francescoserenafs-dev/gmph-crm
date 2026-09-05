import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const [services, methods, stages, settings] = await Promise.all([
    supabaseAdmin.from("service_types").select("id, name, is_active, is_addon, sort_order").order("sort_order"),
    supabaseAdmin.from("payment_methods").select("id, name, is_active, is_system, sort_order").order("sort_order"),
    supabaseAdmin.from("session_stages").select("id, name, is_active, sort_order").order("sort_order"),
    supabaseAdmin.from("app_settings").select("voucher_validity_months, annual_budget_cents, mailerlite_transactional_group_id, mailerlite_marketing_group_id, mailerlite_last_sync_at, calendly_last_sync_at").eq("id", true).maybeSingle(),
  ]);

  const error = services.error ?? methods.error ?? stages.error ?? settings.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    services: services.data,
    methods: methods.data,
    stages: stages.data,
    voucherValidityMonths: settings.data?.voucher_validity_months ?? 12,
    annualBudgetCents: settings.data?.annual_budget_cents ?? 0,
    mailerliteTransactionalGroupId: settings.data?.mailerlite_transactional_group_id ?? "",
    mailerliteMarketingGroupId: settings.data?.mailerlite_marketing_group_id ?? "",
    mailerliteLastSyncAt: settings.data?.mailerlite_last_sync_at ?? null,
    calendlyLastSyncAt: settings.data?.calendly_last_sync_at ?? null,
  });
}
