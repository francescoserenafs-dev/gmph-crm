import { supabaseAdmin } from "@/lib/supabase/admin";

// Vouchers never get a background job to move status between "active" and "expired" as
// expires_at crosses now(), so both directions are reconciled lazily on every read.
export async function expireOverdueVouchers() {
  const nowIso = new Date().toISOString();

  await Promise.all([
    supabaseAdmin.from("gift_vouchers").update({ status: "expired" }).eq("status", "active").lte("expires_at", nowIso),
    supabaseAdmin.from("gift_vouchers").update({ status: "active" }).eq("status", "expired").is("redeemed_session_id", null).gt("expires_at", nowIso),
  ]);
}
