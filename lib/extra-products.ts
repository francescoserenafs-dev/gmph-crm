export const EXTRA_CATEGORIES = ["digital", "print", "album", "other"] as const;
export type ExtraCategory = (typeof EXTRA_CATEGORIES)[number];

export const EXTRA_PRICING_MODES = ["unit", "tiered"] as const;
export type ExtraPricingMode = (typeof EXTRA_PRICING_MODES)[number];

export const EXTRA_CATEGORY_LABELS: Record<ExtraCategory, string> = {
  digital: "Foto digitali extra",
  print: "Stampe / prodotti stampati",
  album: "Album",
  other: "Altro",
};

export const EXTRA_PRICING_MODE_LABELS: Record<ExtraPricingMode, string> = {
  unit: "Prezzo unitario",
  tiered: "Prezzo a scaglioni",
};

export type ExtraPriceTier = { min_quantity: number; max_quantity: number | null; unit_price_cents: number };

export type ExtraProduct = {
  id: string;
  name: string;
  category: ExtraCategory;
  pricing_mode: ExtraPricingMode;
  unit_price_cents: number | null;
  unit_cost_cents: number | null;
  is_active: boolean;
  sort_order: number;
  tiers: ExtraPriceTier[];
};

export const EXTRA_PRODUCT_FIELDS = "id, name, category, pricing_mode, unit_price_cents, unit_cost_cents, is_active, sort_order, tiers:extra_product_price_tiers(min_quantity, max_quantity, unit_price_cents)";

export const MAX_EXTRA_QUANTITY = 999;

export function sortTiers(tiers: ExtraPriceTier[]): ExtraPriceTier[] {
  return [...tiers].sort((a, b) => a.min_quantity - b.min_quantity);
}

// Scaglioni ordinati, contigui e partendo da 1; solo l'ultimo puo essere senza limite superiore.
export function validateTiers(tiers: ExtraPriceTier[]): string | null {
  if (tiers.length === 0) return "Inserisci almeno uno scaglione.";
  const sorted = sortTiers(tiers);
  for (const [index, tier] of sorted.entries()) {
    const isLast = index === sorted.length - 1;
    if (!Number.isInteger(tier.min_quantity) || tier.min_quantity < 1) return "La quantità minima di ogni scaglione deve essere un intero positivo.";
    if (tier.max_quantity !== null && (!Number.isInteger(tier.max_quantity) || tier.max_quantity < tier.min_quantity)) return "La quantità massima deve essere maggiore o uguale alla minima.";
    if (!Number.isInteger(tier.unit_price_cents) || tier.unit_price_cents < 0) return "Il prezzo di ogni scaglione deve essere un importo non negativo.";
    if (tier.max_quantity === null && !isLast) return "Solo l'ultimo scaglione può essere senza limite.";
    if (index === 0 && tier.min_quantity !== 1) return "Il primo scaglione deve partire da 1.";
    if (index > 0 && tier.min_quantity !== (sorted[index - 1].max_quantity ?? 0) + 1) return "Gli scaglioni devono essere contigui, senza buchi né sovrapposizioni.";
  }
  return null;
}

// Totale cumulativo: ogni unita e prezzata con lo scaglione in cui cade. Null se la quantita supera l'ultimo scaglione.
export function computeTieredTotalCents(tiers: ExtraPriceTier[], quantity: number): number | null {
  let total = 0;
  let covered = 0;
  for (const tier of sortTiers(tiers)) {
    if (quantity < tier.min_quantity) break;
    const upper = tier.max_quantity === null ? quantity : Math.min(quantity, tier.max_quantity);
    total += (upper - tier.min_quantity + 1) * tier.unit_price_cents;
    covered = upper;
  }
  return covered === quantity ? total : null;
}

export function computeSuggestedTotalCents(product: Pick<ExtraProduct, "pricing_mode" | "unit_price_cents" | "tiers">, quantity: number): number | null {
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  if (product.pricing_mode === "unit") return product.unit_price_cents === null ? null : product.unit_price_cents * quantity;
  return computeTieredTotalCents(product.tiers, quantity);
}

export function parseEurosToCents(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
}
