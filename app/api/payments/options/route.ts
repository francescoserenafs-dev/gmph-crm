import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const paymentCategories = [
  { value: "deposit", label: "Caparra" },
  { value: "balance", label: "Saldo" },
  { value: "full_payment", label: "Pagamento completo" },
  { value: "voucher_purchase", label: "Pagamento completo" },
  { value: "voucher_redemption", label: "Utilizzo buono regalo" },
] as const;

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("payment_methods")
    .select("id, name, code")
    .eq("is_active", true)
    .neq("code", "gift_voucher")
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    methods: data,
    categories: paymentCategories.filter((category) => category.value === "deposit" || category.value === "balance" || category.value === "full_payment"),
  });
}
