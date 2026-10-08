export type SessionPackage = {
  id: string;
  service_type_id: string;
  name: string;
  included_photos: number;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

export const PACKAGE_COLUMNS = "id, service_type_id, name, included_photos, description, is_active, sort_order";

export function parsePackagePayload(body: Record<string, unknown> | null) {
  if (!body) return "Dati non validi.";
  const serviceTypeId = typeof body.serviceTypeId === "string" ? body.serviceTypeId : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const includedPhotos = Number(body.includedPhotos);
  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim().slice(0, 2000) : null;

  if (!serviceTypeId) return "Seleziona il tipo di servizio.";
  if (!name || name.length > 120) return "Inserisci un nome valido (max 120 caratteri).";
  if (!Number.isInteger(includedPhotos) || includedPhotos < 0 || includedPhotos > 1000) return "Indica un numero di foto incluse valido.";

  return { service_type_id: serviceTypeId, name, included_photos: includedPhotos, description, is_active: body.isActive !== false };
}
