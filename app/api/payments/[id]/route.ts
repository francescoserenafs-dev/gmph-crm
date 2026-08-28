import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const allowedCategories = ["deposit", "balance", "full_payment"];

export async function PATCH(request: NextRequest, context: RouteContext<"/api/payments/[id]">) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dati pagamento non validi." }, { status: 400 });

  const { data: existing } = await supabaseAdmin.from("payments").select("id, applied_voucher_id, voucher_id").eq("id", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Pagamento non trovato." }, { status: 404 });
  if (existing.applied_voucher_id) {
    return NextResponse.json({ error: "Un utilizzo buono non e modificabile: eliminalo e ricrealo." }, { status: 409 });
  }

  const isVoucherPayment = existing.voucher_id !== null;

  const amountEuros = Number(body.amountEuros);
  const paidAt = typeof body.paidAt === "string" ? new Date(body.paidAt) : null;
  const methodId = typeof body.methodId === "string" ? body.methodId : "";
  const category = isVoucherPayment ? "voucher_purchase" : (typeof body.category === "string" ? body.category : "");
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

  if (!Number.isInteger(amountEuros) || amountEuros <= 0 || !paidAt || Number.isNaN(paidAt.valueOf()) || !methodId || (!isVoucherPayment && !allowedCategories.includes(category))) {
    return NextResponse.json({ error: "Compila importo, data, metodo e causale con valori validi." }, { status: 400 });
  }


  if (paidAt.getTime() > Date.now()) {
    return NextResponse.json({ error: "La data del pagamento non puo essere futura." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("payments")
    .update({ payment_method_id: methodId, category, amount_cents: amountEuros * 100, paid_at: paidAt.toISOString(), notes })
    .eq("id", id);

  if (error) {
    const exceeds = error.message.includes("exceeds");
    return NextResponse.json({ error: exceeds ? "Il pagamento supera l'importo ancora dovuto." : "Aggiornamento non riuscito." }, { status: exceeds ? 409 : 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/payments/[id]">) {
  const { id } = await context.params;
  const { error } = await supabaseAdmin.from("payments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Eliminazione non riuscita." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
