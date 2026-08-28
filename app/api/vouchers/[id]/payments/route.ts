import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: RouteContext<"/api/vouchers/[id]/payments">) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dati pagamento non validi." }, { status: 400 });

  const amountEuros = Number(body.amountEuros);
  const paidAt = typeof body.paidAt === "string" ? new Date(body.paidAt) : null;
  const methodId = typeof body.methodId === "string" ? body.methodId : "";
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

  if (!Number.isInteger(amountEuros) || amountEuros <= 0 || !paidAt || Number.isNaN(paidAt.valueOf()) || !methodId) {
    return NextResponse.json({ error: "Compila importo, data e metodo con valori validi." }, { status: 400 });
  }

  if (paidAt.getTime() > Date.now()) {
    return NextResponse.json({ error: "La data del pagamento non puo essere futura." }, { status: 400 });
  }

  const { data: method } = await supabaseAdmin.from("payment_methods").select("id, code").eq("id", methodId).eq("is_active", true).maybeSingle();
  if (!method || method.code === "gift_voucher") return NextResponse.json({ error: "Metodo di pagamento non disponibile." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("payments")
    .insert({ voucher_id: id, payment_method_id: methodId, category: "voucher_purchase", amount_cents: amountEuros * 100, paid_at: paidAt.toISOString(), notes })
    .select("id, amount_cents, paid_at, payment_method_name, notes")
    .single();

  if (error) {
    const exceeds = error.message.includes("exceeds");
    return NextResponse.json({ error: exceeds ? "Il pagamento supera l'importo ancora dovuto." : "Registrazione non riuscita." }, { status: exceeds ? 409 : 500 });
  }

  return NextResponse.json({ payment: data }, { status: 201 });
}
