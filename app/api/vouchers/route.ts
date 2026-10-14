import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { expireOverdueVouchers } from "@/lib/vouchers";

export const dynamic = "force-dynamic";

const voucherFields =
  "id, code, voucher_type, service_name, value_cents, purchase_price_cents, is_complimentary, status, purchased_at, expires_at, redeemed_session_id, purchaser:clients!gift_vouchers_purchaser_client_id_fkey(id,first_name,last_name), recipient:clients!gift_vouchers_recipient_client_id_fkey(id,first_name,last_name), payments!payments_voucher_id_fkey(amount_cents)";

export async function GET(request: NextRequest) {
  await expireOverdueVouchers();

  const status = request.nextUrl.searchParams.get("status");
  const purchaser = request.nextUrl.searchParams.get("purchaser");

  let query = supabaseAdmin.from("gift_vouchers").select(voucherFields).order("purchased_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (purchaser) query = query.eq("purchaser_client_id", purchaser);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ vouchers: data });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dati buono non validi." }, { status: 400 });

  const code = typeof body.code === "string" ? body.code.trim() : "";
  const voucherType = body.voucherType === "service" || body.voucherType === "value" ? body.voucherType : "";
  const purchaserClientId = typeof body.purchaserClientId === "string" ? body.purchaserClientId : "";
  const recipientClientId = typeof body.recipientClientId === "string" && body.recipientClientId ? body.recipientClientId : null;
  const serviceTypeId = typeof body.serviceTypeId === "string" ? body.serviceTypeId : "";
  const valueEuros = Number(body.valueEuros);
  const purchaseEuros = Number(body.purchaseEuros);
  const purchaseMethodId = typeof body.purchaseMethodId === "string" ? body.purchaseMethodId : "";
  const purchasedAt = typeof body.purchasedAt === "string" && body.purchasedAt ? new Date(body.purchasedAt) : new Date();
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  const isComplimentary = body.isComplimentary === true;
  // Senza scadenza esplicita il trigger DB applica la validita globale.
  const expiresAt = typeof body.expiresAt === "string" && body.expiresAt ? new Date(body.expiresAt) : null;

  if (!code || !voucherType || !purchaserClientId || (!isComplimentary && !purchaseMethodId) || Number.isNaN(purchasedAt.valueOf()) || purchasedAt.getTime() > Date.now()) {
    return NextResponse.json({ error: isComplimentary ? "Compila codice, tipo, cliente e data validi." : "Compila codice, tipo, acquirente, metodo e data validi." }, { status: 400 });
  }
  if (expiresAt && (Number.isNaN(expiresAt.valueOf()) || expiresAt.getTime() <= purchasedAt.getTime())) {
    return NextResponse.json({ error: "La scadenza deve essere successiva alla data di emissione." }, { status: 400 });
  }

  let serviceName: string | null = null;
  let valueCents: number | null = null;
  let purchaseCents: number;

  if (voucherType === "service") {
    if (!serviceTypeId || !Number.isInteger(purchaseEuros) || purchaseEuros <= 0) {
      return NextResponse.json({ error: isComplimentary ? "Per un buono a sessione omaggio indica servizio e valore della sessione." : "Per un buono a sessione indica servizio e prezzo di acquisto." }, { status: 400 });
    }
    const { data: service } = await supabaseAdmin.from("service_types").select("id,name").eq("id", serviceTypeId).eq("is_active", true).eq("is_addon", false).maybeSingle();
    if (!service) return NextResponse.json({ error: "Servizio non disponibile." }, { status: 400 });
    serviceName = service.name;
    purchaseCents = purchaseEuros * 100;
  } else {
    if (!Number.isInteger(valueEuros) || valueEuros <= 0) {
      return NextResponse.json({ error: "Per un buono a valore indica un importo valido." }, { status: 400 });
    }
    valueCents = valueEuros * 100;
    purchaseCents = valueCents;
  }

  if (!isComplimentary) {
    const { data: method } = await supabaseAdmin.from("payment_methods").select("id").eq("id", purchaseMethodId).eq("is_active", true).maybeSingle();
    if (!method) return NextResponse.json({ error: "Metodo di pagamento non disponibile." }, { status: 400 });
  }

  // purchase_price_cents resta il valore nominale anche per gli omaggi: e il credito usato al riscatto.
  const { data: voucher, error } = await supabaseAdmin
    .from("gift_vouchers")
    .insert({ code, voucher_type: voucherType, purchaser_client_id: purchaserClientId, recipient_client_id: recipientClientId, service_type_id: voucherType === "service" ? serviceTypeId : null, service_name: serviceName, value_cents: valueCents, purchase_price_cents: purchaseCents, is_complimentary: isComplimentary, purchased_at: purchasedAt.toISOString(), ...(expiresAt ? { expires_at: expiresAt.toISOString() } : {}), notes })
    .select("id")
    .single();

  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json({ error: duplicate ? "Esiste gia un buono con questo codice." : "Creazione non riuscita." }, { status: duplicate ? 409 : 500 });
  }

  if (isComplimentary) return NextResponse.json({ voucher }, { status: 201 });

  const { error: paymentError } = await supabaseAdmin
    .from("payments")
    .insert({ voucher_id: voucher.id, payment_method_id: purchaseMethodId, category: "voucher_purchase", amount_cents: purchaseCents, paid_at: purchasedAt.toISOString() });

  if (paymentError) {
    await supabaseAdmin.from("gift_vouchers").delete().eq("id", voucher.id);
    return NextResponse.json({ error: "Registrazione del pagamento non riuscita." }, { status: 500 });
  }

  return NextResponse.json({ voucher }, { status: 201 });
}
