import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { expireOverdueVouchers } from "@/lib/vouchers";

export const dynamic = "force-dynamic";

const voucherFields =
  "id, code, voucher_type, service_type_id, service_name, value_cents, purchase_price_cents, status, purchased_at, expires_at, redeemed_session_id, notes, purchaser:clients!gift_vouchers_purchaser_client_id_fkey(id,first_name,last_name), recipient:clients!gift_vouchers_recipient_client_id_fkey(id,first_name,last_name), payments!payments_voucher_id_fkey(id,amount_cents,paid_at,payment_method_name,notes)";

async function loadVoucher(id: string) {
  await expireOverdueVouchers();
  return supabaseAdmin.from("gift_vouchers").select(voucherFields).eq("id", id).maybeSingle();
}

export async function GET(_request: NextRequest, context: RouteContext<"/api/vouchers/[id]">) {
  const { id } = await context.params;
  const { data, error } = await loadVoucher(id);

  if (error) return NextResponse.json({ error: "Non e stato possibile caricare il buono." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Buono non trovato." }, { status: 404 });

  return NextResponse.json({ voucher: data });
}

export async function PATCH(request: NextRequest, context: RouteContext<"/api/vouchers/[id]">) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dati non validi." }, { status: 400 });

  const update: Record<string, unknown> = {};

  if ("recipientClientId" in body) {
    update.recipient_client_id = typeof body.recipientClientId === "string" && body.recipientClientId ? body.recipientClientId : null;
  }

  if ("code" in body) {
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) return NextResponse.json({ error: "Il codice non puo essere vuoto." }, { status: 400 });
    update.code = code;
  }

  if ("notes" in body) {
    update.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  }

  if ("expiresAt" in body) {
    const expiresAt = typeof body.expiresAt === "string" ? new Date(body.expiresAt) : null;
    if (!expiresAt || Number.isNaN(expiresAt.valueOf())) {
      return NextResponse.json({ error: "Data di scadenza non valida." }, { status: 400 });
    }
    update.expires_at = expiresAt.toISOString();
  }

  if ("purchasedAt" in body) {
    const purchasedAt = typeof body.purchasedAt === "string" ? new Date(body.purchasedAt) : null;
    if (!purchasedAt || Number.isNaN(purchasedAt.valueOf()) || purchasedAt.getTime() > Date.now()) {
      return NextResponse.json({ error: "Data di acquisto non valida." }, { status: 400 });
    }
    update.purchased_at = purchasedAt.toISOString();
  }

  if ("voucherType" in body) {
    const voucherType = body.voucherType === "service" || body.voucherType === "value" ? body.voucherType : "";
    if (!voucherType) return NextResponse.json({ error: "Tipo di buono non valido." }, { status: 400 });

    let serviceName: string | null = null;
    let valueCents: number | null = null;
    let serviceTypeId: string | null = null;
    let purchaseCents: number;

    if (voucherType === "service") {
      const requestedServiceTypeId = typeof body.serviceTypeId === "string" ? body.serviceTypeId : "";
      const purchaseEuros = Number(body.purchaseEuros);
      if (!requestedServiceTypeId || !Number.isInteger(purchaseEuros) || purchaseEuros <= 0) {
        return NextResponse.json({ error: "Per un buono a sessione indica servizio e prezzo di acquisto." }, { status: 400 });
      }
      const { data: service } = await supabaseAdmin.from("service_types").select("id,name").eq("id", requestedServiceTypeId).eq("is_active", true).eq("is_addon", false).maybeSingle();
      if (!service) return NextResponse.json({ error: "Servizio non disponibile." }, { status: 400 });
      serviceName = service.name;
      serviceTypeId = requestedServiceTypeId;
      purchaseCents = purchaseEuros * 100;
    } else {
      const valueEuros = Number(body.valueEuros);
      if (!Number.isInteger(valueEuros) || valueEuros <= 0) {
        return NextResponse.json({ error: "Per un buono a valore indica un importo valido." }, { status: 400 });
      }
      valueCents = valueEuros * 100;
      purchaseCents = valueCents;
    }

    const { data: existingPayments } = await supabaseAdmin.from("payments").select("amount_cents").eq("voucher_id", id);
    const paidSoFar = (existingPayments ?? []).reduce((sum, payment) => sum + payment.amount_cents, 0);
    if (paidSoFar > purchaseCents) {
      return NextResponse.json({ error: "Il nuovo prezzo e inferiore a quanto gia incassato per questo buono." }, { status: 400 });
    }

    update.voucher_type = voucherType;
    update.service_type_id = serviceTypeId;
    update.service_name = serviceName;
    update.value_cents = valueCents;
    update.purchase_price_cents = purchaseCents;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nessuna modifica da salvare." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("gift_vouchers").update(update).eq("id", id);
  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json({ error: duplicate ? "Esiste gia un buono con questo codice." : "Aggiornamento non riuscito." }, { status: duplicate ? 409 : 500 });
  }

  const { data } = await loadVoucher(id);
  return NextResponse.json({ voucher: data });
}
