import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const update: Record<string, number> = {};

  if (body && "voucherValidityMonths" in body) {
    const months = Number(body.voucherValidityMonths);
    if (!Number.isInteger(months) || months < 1 || months > 120) {
      return NextResponse.json({ error: "La validita deve essere tra 1 e 120 mesi." }, { status: 400 });
    }
    update.voucher_validity_months = months;
  }

  if (body && "annualBudgetEuros" in body) {
    const budgetEuros = Number(body.annualBudgetEuros);
    if (!Number.isInteger(budgetEuros) || budgetEuros < 0) {
      return NextResponse.json({ error: "Il budget deve essere un importo valido." }, { status: 400 });
    }
    update.annual_budget_cents = budgetEuros * 100;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nessuna modifica da salvare." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("app_settings").update(update).eq("id", true);
  if (error) return NextResponse.json({ error: "Aggiornamento non riuscito." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
