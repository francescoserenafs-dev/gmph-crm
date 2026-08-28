import { supabaseAdmin } from "@/lib/supabase/admin";

export const entityTables = {
  services: { table: "service_types", hasCode: false },
  methods: { table: "payment_methods", hasCode: true },
  stages: { table: "session_stages", hasCode: true },
} as const;

export type EntityKey = keyof typeof entityTables;

export function isEntity(value: string): value is EntityKey {
  return value === "services" || value === "methods" || value === "stages";
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || `voce_${Date.now()}`;
}

export async function nextSortOrder(table: string): Promise<number> {
  const { data } = await supabaseAdmin.from(table).select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  return (data?.sort_order ?? 0) + 10;
}
