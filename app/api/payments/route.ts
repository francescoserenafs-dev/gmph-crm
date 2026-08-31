import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const allowedCategories = ["deposit", "balance", "full_payment"];

const paymentFields =
  "id, amount_cents, paid_at, category, payment_method_name, applied_voucher_id, notes, session:sessions!payments_session_id_fkey(id,service_name,scheduled_at,client:clients!sessions_client_id_fkey(id,first_name,last_name)), voucher:gift_vouchers!payments_voucher_id_fkey(id,code,purchaser:clients!gift_vouchers_purchaser_client_id_fkey(id,first_name,last_name))";

export async function GET(request: NextRequest) {
  const page = Math.max(Number(request.nextUrl.searchParams.get("page") ?? 1), 1);
  const sizeParam = Number(request.nextUrl.searchParams.get("pageSize"));
  const pageSize = [10, 25, 50, 100].includes(sizeParam) ? sizeParam : 25;
  const method = request.nextUrl.searchParams.get("method");
  const category = request.nextUrl.searchParams.get("category");

  let query = supabaseAdmin.from("payments").select(paymentFields, { count: "exact" }).order("paid_at", { ascending: false });
  if (method) query = query.eq("payment_method_name", method);
  if (category) query = query.eq("category", category);

  const { data, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ payments: data, total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dati pagamento non validi." }, { status: 400 });

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const amountEuros = Number(body.amountEuros);
  const paidAt = typeof body.paidAt === "string" ? new Date(body.paidAt) : null;
  const methodId = typeof body.methodId === "string" ? body.methodId : "";
  const category = typeof body.category === "string" ? body.category : "";
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

  if (!sessionId || !Number.isInteger(amountEuros) || amountEuros <= 0 || !paidAt || Number.isNaN(paidAt.valueOf()) || !methodId || !allowedCategories.includes(category)) {
    return NextResponse.json({ error: "Compila sessione, importo, data, metodo e causale con valori validi." }, { status: 400 });
  }

  if (paidAt.getTime() > Date.now()) {
    return NextResponse.json({ error: "La data del pagamento non puo essere futura." }, { status: 400 });
  }

  const [{ data: session }, { data: method }] = await Promise.all([
    supabaseAdmin.from("sessions").select("id").eq("id", sessionId).maybeSingle(),
    supabaseAdmin.from("payment_methods").select("id").eq("id", methodId).eq("is_active", true).maybeSingle(),
  ]);

  if (!session || !method) return NextResponse.json({ error: "Sessione o metodo non disponibile." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("payments")
    .insert({ session_id: sessionId, payment_method_id: methodId, category, amount_cents: amountEuros * 100, paid_at: paidAt.toISOString(), notes })
    .select("id")
    .single();

  if (error) {
    const exceeds = error.message.includes("exceeds");
    return NextResponse.json({ error: exceeds ? "Il pagamento supera l'importo ancora dovuto." : "Registrazione non riuscita." }, { status: exceeds ? 409 : 500 });
  }

  return NextResponse.json({ payment: data }, { status: 201 });
}
