import type { ExtraCategory } from "@/lib/extra-products";

export type PackageInclusion = {
  id: string;
  extra_product_id: string;
  quantity: number;
  sort_order: number;
  product: { name: string; category: ExtraCategory; is_active: boolean } | null;
};

export type SessionPackage = {
  id: string;
  service_type_id: string;
  name: string;
  // Null solo per pacchetti creati prima della V2.
  price_cents: number | null;
  duration_minutes: number | null;
  included_photos: number;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  inclusions: PackageInclusion[];
};

export type PackageInclusionSnapshot = {
  id: string;
  extra_product_id: string | null;
  product_name_snapshot: string;
  category_snapshot: ExtraCategory | null;
  quantity: number;
  unit_cost_cents_snapshot: number | null;
  sort_order: number;
};

export const PACKAGE_COLUMNS = "id, service_type_id, name, price_cents, duration_minutes, included_photos, description, is_active, sort_order, inclusions:session_package_inclusions(id, extra_product_id, quantity, sort_order, product:extra_products(name, category, is_active))";

export const SESSION_PACKAGE_SNAPSHOT_FIELDS = "package_id, package_name_snapshot, package_price_cents_snapshot, package_duration_minutes_snapshot, package_included_photos_snapshot, package_description_snapshot, package_inclusions:session_package_inclusion_snapshots(id, extra_product_id, product_name_snapshot, category_snapshot, quantity, unit_cost_cents_snapshot, sort_order)";

export type ParsedPackage = {
  row: { service_type_id: string; name: string; price_cents: number; duration_minutes: number; included_photos: number; description: string | null; is_active: boolean };
  inclusions: { extra_product_id: string; quantity: number }[];
};

export function parsePackagePayload(body: Record<string, unknown> | null): ParsedPackage | string {
  if (!body) return "Dati non validi.";
  const serviceTypeId = typeof body.serviceTypeId === "string" ? body.serviceTypeId : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const priceEuros = Number(body.priceEuros);
  const durationMinutes = Number(body.durationMinutes);
  const includedPhotos = Number(body.includedPhotos);
  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim().slice(0, 2000) : null;

  if (!serviceTypeId) return "Seleziona il tipo di servizio.";
  if (!name || name.length > 120) return "Inserisci un nome valido (max 120 caratteri).";
  if (body.priceEuros === "" || body.priceEuros === undefined || !Number.isInteger(priceEuros) || priceEuros < 0) return "Indica un prezzo intero in euro.";
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) return "Indica una durata in minuti valida.";
  if (!Number.isInteger(includedPhotos) || includedPhotos < 0 || includedPhotos > 1000) return "Indica un numero di foto incluse valido.";

  const inclusions: ParsedPackage["inclusions"] = [];
  for (const raw of Array.isArray(body.inclusions) ? body.inclusions : []) {
    const item = raw as Record<string, unknown>;
    const productId = typeof item.extraProductId === "string" ? item.extraProductId : "";
    const quantity = Number(item.quantity);
    if (!productId) return "Seleziona il prodotto di ogni inclusione.";
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return "Indica una quantità valida per ogni inclusione.";
    if (inclusions.some((inclusion) => inclusion.extra_product_id === productId)) return "Ogni prodotto può comparire una sola volta tra le inclusioni.";
    inclusions.push({ extra_product_id: productId, quantity });
  }

  return {
    row: { service_type_id: serviceTypeId, name, price_cents: priceEuros * 100, duration_minutes: durationMinutes, included_photos: includedPhotos, description, is_active: body.isActive !== false },
    inclusions,
  };
}

export function sortInclusions<T extends { sort_order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}
