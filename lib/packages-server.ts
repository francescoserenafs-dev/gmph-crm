import { NextResponse } from "next/server";
import type { ParsedPackage } from "@/lib/packages";
import { supabaseAdmin } from "@/lib/supabase/admin";

type InclusionInput = ParsedPackage["inclusions"][number];

const sameInclusions = (a: InclusionInput[], b: InclusionInput[]) =>
  a.length === b.length && a.every((item, index) => item.extra_product_id === b[index].extra_product_id && item.quantity === b[index].quantity);

export async function validateInclusionProducts(inclusions: InclusionInput[]): Promise<string | null> {
  if (inclusions.length === 0) return null;
  const { data, error } = await supabaseAdmin.from("extra_products").select("id").in("id", inclusions.map((item) => item.extra_product_id));
  if (error) return "Verifica dei prodotti inclusi non riuscita.";
  return (data ?? []).length === inclusions.length ? null : "Uno dei prodotti inclusi non esiste piu nel catalogo extra.";
}

// Le sessioni non dipendono da queste righe: hanno gia il proprio snapshot delle inclusioni.
export async function replacePackageInclusions(packageId: string, inclusions: InclusionInput[], previous: InclusionInput[]): Promise<NextResponse | null> {
  if (sameInclusions(inclusions, previous)) return null;

  const removal = await supabaseAdmin.from("session_package_inclusions").delete().eq("package_id", packageId);
  if (removal.error) return NextResponse.json({ error: "Aggiornamento delle inclusioni non riuscito." }, { status: 500 });
  if (inclusions.length === 0) return null;

  const rows = (list: InclusionInput[]) => list.map((item, index) => ({ ...item, package_id: packageId, sort_order: (index + 1) * 10 }));
  const { error } = await supabaseAdmin.from("session_package_inclusions").insert(rows(inclusions));
  if (!error) return null;

  if (previous.length > 0) await supabaseAdmin.from("session_package_inclusions").insert(rows(previous));
  return NextResponse.json({ error: "Aggiornamento delle inclusioni non riuscito." }, { status: 500 });
}
