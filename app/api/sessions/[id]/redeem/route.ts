import { type NextRequest, NextResponse } from "next/server";
import { calculateVoucherApplication } from "@/lib/sessions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: RouteContext<"/api/sessions/[id]/redeem">) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const voucherId = body && typeof body.voucherId === "string" ? body.voucherId : "";
  if (!voucherId) return NextResponse.json({ error: "Seleziona un buono." }, { status: 400 });

  const [{ data: session }, { data: voucher }, { data: method }] = await Promise.all([
    supabaseAdmin.from("sessions").select("id, agreed_price_cents, extras:session_extras(price_cents,quantity), payments(amount_cents)").eq("id", id).maybeSingle(),
    supabaseAdmin.from("gift_vouchers").select("id, voucher_type, value_cents, purchase_price_cents").eq("id", voucherId).maybeSingle(),
    supabaseAdmin.from("payment_methods").select("id").eq("code", "gift_voucher").maybeSingle(),
  ]);

  if (!session || !voucher || !method) return NextResponse.json({ error: "Sessione, buono o metodo non disponibile." }, { status: 400 });

  const voucherCreditCents = voucher.voucher_type === "value" ? voucher.value_cents ?? 0 : voucher.purchase_price_cents ?? 0;
  const totalDueCents = session.agreed_price_cents + (session.extras ?? []).reduce((sum, extra) => sum + extra.price_cents * extra.quantity, 0);
  const paidCents = (session.payments ?? []).reduce((sum, payment) => sum + payment.amount_cents, 0);
  const { amountCents, unusedCents, remainingCents } = calculateVoucherApplication(voucherCreditCents, totalDueCents, paidCents);
  if (remainingCents === 0) return NextResponse.json({ error: "La sessione e gia saldata." }, { status: 409 });

  const { error } = await supabaseAdmin
    .from("payments")
    .insert({ session_id: id, applied_voucher_id: voucherId, payment_method_id: method.id, category: "voucher_redemption", amount_cents: amountCents, voucher_unused_cents: unusedCents, paid_at: new Date().toISOString() });

  if (error) {
    const message = error.message.includes("expired") ? "Il buono non e attivo o e scaduto."
      : error.message.includes("not valid for this session") ? "Il buono non e valido per questo tipo di sessione."
      : error.message.includes("already fully paid") ? "La sessione e gia saldata."
      : error.message.includes("exceeds") ? "Il buono supera l'importo dovuto per la sessione."
      : error.message.includes("voucher_unused_cents") ? "La configurazione Supabase non e aggiornata: applica l'ultima migration."
      : "Applicazione del buono non riuscita.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
