import { type NextRequest, NextResponse } from "next/server";
import { EXTRA_PRODUCT_FIELDS, type ExtraProduct } from "@/lib/extra-products";
import { normalizeProduct, parseExtraProductPayload, replaceExtraProductTiers } from "@/lib/extra-products-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin.from("extra_products").select(EXTRA_PRODUCT_FIELDS).order("sort_order").order("name");
  if (error) return NextResponse.json({ error: "Non e stato possibile caricare il catalogo extra." }, { status: 500 });
  return NextResponse.json({ products: ((data ?? []) as unknown as ExtraProduct[]).map(normalizeProduct) });
}

export async function POST(request: NextRequest) {
  const parsed = parseExtraProductPayload((await request.json().catch(() => null)) as Record<string, unknown> | null);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("extra_products").insert(parsed.row).select("id").single();
  if (error || !data) return NextResponse.json({ error: "Creazione del prodotto non riuscita." }, { status: 500 });

  const failure = await replaceExtraProductTiers(data.id, parsed.tiers, []);
  if (failure) {
    await supabaseAdmin.from("extra_products").delete().eq("id", data.id);
    return failure;
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
