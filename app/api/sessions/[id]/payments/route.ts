import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const allowedCategories = ["deposit", "balance", "full_payment"];

export async function POST(request: NextRequest, context: RouteContext<"/api/sessions/[id]/payments">) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dati pagamento non validi." }, { status: 400 });

  const amountEuros = Number(body.amountEuros);
  const paidAt = typeof body.paidAt === "string" && body.paidAt.trim() ? new Date(body.paidAt) : null;
  const paidDate = typeof body.paidDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.paidDate) ? body.paidDate : null;
  const methodId = typeof body.methodId === "string" ? body.methodId : "";
  const category = typeof body.category === "string" ? body.category : "";
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

  if (!Number.isInteger(amountEuros) || amountEuros <= 0 || (!paidAt && !paidDate) || (paidAt && Number.isNaN(paidAt.valueOf())) || !methodId || !allowedCategories.includes(category)) {
    return NextResponse.json({ error: "Compila importo, data, metodo e causale con valori validi." }, { status: 400 });
  }

  if ((paidAt && paidAt.getTime() > Date.now()) || (paidDate && paidDate > new Date().toISOString().slice(0, 10))) {
    return NextResponse.json({ error: "La data del pagamento non puo essere futura." }, { status: 400 });
  }

  const { data: method } = await supabaseAdmin.from("payment_methods").select("id").eq("id", methodId).eq("is_active", true).maybeSingle();
  if (!method) return NextResponse.json({ error: "Metodo di pagamento non disponibile." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("payments")
    .insert({ session_id: id, payment_method_id: methodId, category, amount_cents: amountEuros * 100, paid_at: paidAt?.toISOString() ?? null, paid_date: paidDate, notes })
    .select("id, amount_cents, paid_at, category, payment_method_name, notes")
    .single();

  if (error) {
    const exceeds = error.message.includes("exceeds");
    return NextResponse.json({ error: exceeds ? "Il pagamento supera l'importo ancora dovuto." : "Registrazione non riuscita." }, { status: exceeds ? 409 : 500 });
  }

  return NextResponse.json({ payment: data }, { status: 201 });
}
