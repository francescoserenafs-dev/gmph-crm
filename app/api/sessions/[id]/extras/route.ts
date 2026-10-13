import { type NextRequest, NextResponse } from "next/server";
import { EXTRA_PRODUCT_FIELDS, type ExtraProduct, MAX_EXTRA_QUANTITY, computeSuggestedTotalCents, parseEurosToCents } from "@/lib/extra-products";
import { normalizeProduct } from "@/lib/extra-products-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const EXTRA_FIELDS = "id, service_type_id, extra_product_id, service_name, category_snapshot, price_cents, quantity, line_total_cents, unit_cost_cents, notes, created_at";

export async function GET(_request: NextRequest, context: RouteContext<"/api/sessions/[id]/extras">) {
  const { id } = await context.params;

  const { data, error } = await supabaseAdmin
    .from("session_extras")
    .select(EXTRA_FIELDS)
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ extras: data });
}

export async function POST(request: NextRequest, context: RouteContext<"/api/sessions/[id]/extras">) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dati non validi." }, { status: 400 });

  const extraProductId = typeof body.extraProductId === "string" ? body.extraProductId : "";
  const quantity = body.quantity === undefined || body.quantity === "" ? 1 : Number(body.quantity);
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 500) : null;
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 120) : "";

  if (!extraProductId) return NextResponse.json({ error: "Seleziona un prodotto extra." }, { status: 400 });
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_EXTRA_QUANTITY) {
    return NextResponse.json({ error: "Indica una quantita valida." }, { status: 400 });
  }

  const [{ data: session }, { data: productRow }] = await Promise.all([
    supabaseAdmin.from("sessions").select("id").eq("id", id).maybeSingle(),
    supabaseAdmin.from("extra_products").select(EXTRA_PRODUCT_FIELDS).eq("id", extraProductId).eq("is_active", true).maybeSingle(),
  ]);

  if (!session) return NextResponse.json({ error: "Sessione non trovata." }, { status: 404 });
  if (!productRow) return NextResponse.json({ error: "Prodotto extra non disponibile." }, { status: 400 });

  const product = normalizeProduct(productRow as unknown as ExtraProduct);
  const suggestedCents = computeSuggestedTotalCents(product, quantity);
  if (suggestedCents === null) return NextResponse.json({ error: "La quantita supera l'ultimo scaglione configurato." }, { status: 400 });

  // Totale e costo possono essere corretti a mano: si salva cio che e stato davvero venduto.
  const lineTotalCents = body.lineTotalEuros === undefined || body.lineTotalEuros === "" ? suggestedCents : parseEurosToCents(body.lineTotalEuros);
  if (lineTotalCents === null) return NextResponse.json({ error: "Indica un totale valido." }, { status: 400 });

  let unitCostCents = product.unit_cost_cents;
  if (body.unitCostEuros !== undefined) {
    unitCostCents = body.unitCostEuros === "" || body.unitCostEuros === null ? null : parseEurosToCents(body.unitCostEuros);
    if (unitCostCents === null && body.unitCostEuros !== "" && body.unitCostEuros !== null) {
      return NextResponse.json({ error: "Indica un costo valido." }, { status: 400 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from("session_extras")
    .insert({
      session_id: id,
      service_type_id: null,
      extra_product_id: product.id,
      service_name: product.category === "other" && description ? description : product.name,
      category_snapshot: product.category,
      // Prezzo unitario di listino applicato (media per gli scaglioni): dato tecnico, il totale autorevole e line_total_cents.
      price_cents: Math.round(suggestedCents / quantity),
      quantity,
      line_total_cents: lineTotalCents,
      unit_cost_cents: unitCostCents,
      notes,
    })
    .select(EXTRA_FIELDS)
    .single();

  if (error) return NextResponse.json({ error: "Aggiunta extra non riuscita." }, { status: 500 });
  return NextResponse.json({ extra: data }, { status: 201 });
}
