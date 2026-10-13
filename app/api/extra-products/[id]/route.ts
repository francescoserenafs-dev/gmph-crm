import { type NextRequest, NextResponse } from "next/server";
import { EXTRA_PRODUCT_FIELDS, type ExtraProduct } from "@/lib/extra-products";
import { normalizeProduct, parseExtraProductPayload, replaceExtraProductTiers } from "@/lib/extra-products-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Nessun DELETE: i prodotti si disattivano, le vendite storiche li referenziano.
export async function PATCH(request: NextRequest, context: RouteContext<"/api/extra-products/[id]">) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const { data: current } = await supabaseAdmin.from("extra_products").select(EXTRA_PRODUCT_FIELDS).eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Prodotto non trovato." }, { status: 404 });

  if (body && Object.keys(body).length === 1 && typeof body.isActive === "boolean") {
    const { error } = await supabaseAdmin.from("extra_products").update({ is_active: body.isActive }).eq("id", id);
    if (error) return NextResponse.json({ error: "Aggiornamento non riuscito." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const parsed = parseExtraProductPayload(body);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

  const { error } = await supabaseAdmin.from("extra_products").update(parsed.row).eq("id", id);
  if (error) return NextResponse.json({ error: "Aggiornamento non riuscito." }, { status: 500 });

  const failure = await replaceExtraProductTiers(id, parsed.tiers, normalizeProduct(current as unknown as ExtraProduct).tiers);
  if (failure) return failure;

  return NextResponse.json({ ok: true });
}
