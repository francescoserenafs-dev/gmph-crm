import { type NextRequest, NextResponse } from "next/server";
import { EXTRA_PRODUCT_FIELDS, type ExtraProduct } from "@/lib/extra-products";
import { normalizeProduct, parseExtraProductPayload, replaceExtraProductTiers } from "@/lib/extra-products-server";
import { hasPrintExtras, isExtraChangeBlockedBySession } from "@/lib/sessions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function checkActiveSessions(productId: string, category: string, action: "disattivare" | "eliminare") {
  const [productExtrasResult, packageExtrasResult] = await Promise.all([
    supabaseAdmin.from("session_extras").select("session_id").eq("extra_product_id", productId),
    supabaseAdmin.from("session_package_inclusion_snapshots").select("session_id").eq("extra_product_id", productId),
  ]);
  if (productExtrasResult.error || packageExtrasResult.error) {
    return NextResponse.json({ error: "Non è stato possibile verificare le sessioni associate." }, { status: 500 });
  }

  const sessionIds = [...new Set([
    ...(productExtrasResult.data ?? []).map((extra) => extra.session_id),
    ...(packageExtrasResult.data ?? []).map((extra) => extra.session_id),
  ])];
  if (sessionIds.length === 0) return null;

  const { data: sessions, error: sessionsError } = await supabaseAdmin
    .from("sessions")
    .select("id, current_stage:session_stages!sessions_current_stage_id_fkey(code), extras:session_extras(category_snapshot,quantity,extra_product_id), package_extras:session_package_inclusion_snapshots(category_snapshot,quantity,extra_product_id)")
    .in("id", sessionIds);
  if (sessionsError) return NextResponse.json({ error: "Non è stato possibile verificare lo stato delle sessioni associate." }, { status: 500 });

  const activeSession = (sessions ?? []).find((session) => {
    const extras = [...(session.extras ?? []), ...(session.package_extras ?? [])].map((extra) => ({
      category_snapshot: extra.category_snapshot ?? (extra.extra_product_id === productId ? category : null),
      quantity: extra.quantity,
    }));
    const stage = Array.isArray(session.current_stage) ? session.current_stage[0] : session.current_stage;
    return isExtraChangeBlockedBySession(stage?.code, extras);
  });

  if (!activeSession) return null;

  const activeExtras = [...(activeSession.extras ?? []), ...(activeSession.package_extras ?? [])].map((extra) => ({
    category_snapshot: extra.category_snapshot ?? (extra.extra_product_id === productId ? category : null),
    quantity: extra.quantity,
  }));
  const milestone = hasPrintExtras(activeExtras) ? "il completamento delle stampe" : "la consegna delle foto finali";
  return NextResponse.json({ error: `Non puoi ${action} questo extra: è presente in una sessione ancora in corso. Attendi ${milestone} o annulla la sessione.` }, { status: 409 });
}

export async function PATCH(request: NextRequest, context: RouteContext<"/api/extra-products/[id]">) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const { data: current, error: currentError } = await supabaseAdmin.from("extra_products").select(EXTRA_PRODUCT_FIELDS).eq("id", id).maybeSingle();
  if (currentError) return NextResponse.json({ error: "Non è stato possibile caricare il prodotto." }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Prodotto non trovato." }, { status: 404 });

  if (body && Object.keys(body).length === 1 && typeof body.isActive === "boolean") {
    if (!body.isActive) {
      const blocked = await checkActiveSessions(id, current.category, "disattivare");
      if (blocked) return blocked;
    }
    const { error } = await supabaseAdmin.from("extra_products").update({ is_active: body.isActive }).eq("id", id);
    if (error) return NextResponse.json({ error: "Aggiornamento non riuscito." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const parsed = parseExtraProductPayload(body);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });
  if (!parsed.row.is_active) {
    const blocked = await checkActiveSessions(id, current.category, "disattivare");
    if (blocked) return blocked;
  }

  const { error } = await supabaseAdmin.from("extra_products").update(parsed.row).eq("id", id);
  if (error) return NextResponse.json({ error: "Aggiornamento non riuscito." }, { status: 500 });

  const failure = await replaceExtraProductTiers(id, parsed.tiers, normalizeProduct(current as unknown as ExtraProduct).tiers);
  if (failure) return failure;

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/extra-products/[id]">) {
  const { id } = await context.params;
  const { data: current, error: currentError } = await supabaseAdmin.from("extra_products").select("id,category").eq("id", id).maybeSingle();
  if (currentError) return NextResponse.json({ error: "Non è stato possibile caricare il prodotto." }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Prodotto non trovato." }, { status: 404 });

  const blocked = await checkActiveSessions(id, current.category, "eliminare");
  if (blocked) return blocked;

  const { error } = await supabaseAdmin.from("extra_products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Eliminazione non riuscita." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
