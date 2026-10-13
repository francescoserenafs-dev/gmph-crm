import { NextResponse } from "next/server";
import { EXTRA_CATEGORIES, EXTRA_PRICING_MODES, type ExtraCategory, type ExtraPriceTier, type ExtraPricingMode, type ExtraProduct, parseEurosToCents, sortTiers, validateTiers } from "@/lib/extra-products";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ParsedExtraProduct = {
  row: { name: string; category: ExtraCategory; pricing_mode: ExtraPricingMode; unit_price_cents: number | null; unit_cost_cents: number | null; is_active: boolean; sort_order: number };
  tiers: ExtraPriceTier[];
};

function optionalCents(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return parseEurosToCents(value) ?? undefined;
}

export function parseExtraProductPayload(body: Record<string, unknown> | null): ParsedExtraProduct | string {
  if (!body) return "Dati non validi.";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = body.category as ExtraCategory;
  const pricingMode = body.pricingMode as ExtraPricingMode;
  const sortOrder = body.sortOrder === undefined || body.sortOrder === "" ? 0 : Number(body.sortOrder);

  if (!name || name.length > 120) return "Inserisci un nome valido (max 120 caratteri).";
  if (!EXTRA_CATEGORIES.includes(category)) return "Seleziona una categoria valida.";
  if (!EXTRA_PRICING_MODES.includes(pricingMode)) return "Seleziona una modalità di prezzo valida.";
  if (!Number.isInteger(sortOrder)) return "L'ordinamento deve essere un numero intero.";

  const unitCost = optionalCents(body.unitCostEuros);
  if (unitCost === undefined) return "Il costo unitario deve essere un importo non negativo.";

  if (pricingMode === "unit") {
    const unitPrice = optionalCents(body.unitPriceEuros);
    if (unitPrice === undefined || unitPrice === null) return "Indica il prezzo unitario.";
    return { row: { name, category, pricing_mode: pricingMode, unit_price_cents: unitPrice, unit_cost_cents: unitCost, is_active: body.isActive !== false, sort_order: sortOrder }, tiers: [] };
  }

  const tiers: ExtraPriceTier[] = [];
  for (const raw of Array.isArray(body.tiers) ? body.tiers : []) {
    const item = raw as Record<string, unknown>;
    const min = Number(item.minQuantity);
    const max = item.maxQuantity === null || item.maxQuantity === undefined || item.maxQuantity === "" ? null : Number(item.maxQuantity);
    const price = parseEurosToCents(item.unitPriceEuros);
    if (price === null) return "Ogni scaglione deve avere un prezzo valido.";
    tiers.push({ min_quantity: min, max_quantity: max, unit_price_cents: price });
  }
  const tierError = validateTiers(tiers);
  if (tierError) return tierError;

  return { row: { name, category, pricing_mode: pricingMode, unit_price_cents: null, unit_cost_cents: unitCost, is_active: body.isActive !== false, sort_order: sortOrder }, tiers: sortTiers(tiers) };
}

export async function replaceExtraProductTiers(productId: string, tiers: ExtraPriceTier[], previous: ExtraPriceTier[]): Promise<NextResponse | null> {
  const removal = await supabaseAdmin.from("extra_product_price_tiers").delete().eq("extra_product_id", productId);
  if (removal.error) return NextResponse.json({ error: "Aggiornamento degli scaglioni non riuscito." }, { status: 500 });
  if (tiers.length === 0) return null;

  const rows = (list: ExtraPriceTier[]) => list.map((tier, index) => ({ ...tier, extra_product_id: productId, sort_order: (index + 1) * 10 }));
  const { error } = await supabaseAdmin.from("extra_product_price_tiers").insert(rows(tiers));
  if (!error) return null;

  // Ripristino best-effort per non lasciare un prodotto a scaglioni senza scaglioni.
  if (previous.length > 0) await supabaseAdmin.from("extra_product_price_tiers").insert(rows(previous));
  return NextResponse.json({ error: "Aggiornamento degli scaglioni non riuscito." }, { status: 500 });
}

export function normalizeProduct(product: ExtraProduct): ExtraProduct {
  return { ...product, tiers: sortTiers(product.tiers ?? []) };
}
