import { type NextRequest, NextResponse } from "next/server";
import { PACKAGE_COLUMNS, type SessionPackage, parsePackagePayload, sortInclusions } from "@/lib/packages";
import { replacePackageInclusions, validateInclusionProducts } from "@/lib/packages-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Le modifiche valgono solo per le sessioni future: quelle esistenti hanno il proprio snapshot.
export async function PATCH(request: NextRequest, context: RouteContext<"/api/packages/[id]">) {
  const { id } = await context.params;
  const parsed = parsePackagePayload((await request.json().catch(() => null)) as Record<string, unknown> | null);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

  const productError = await validateInclusionProducts(parsed.inclusions);
  if (productError) return NextResponse.json({ error: productError }, { status: 400 });

  const { data: current } = await supabaseAdmin.from("session_packages").select(PACKAGE_COLUMNS).eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Pacchetto non trovato." }, { status: 404 });

  const { error } = await supabaseAdmin.from("session_packages").update(parsed.row).eq("id", id);
  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json({ error: duplicate ? "Esiste gia un pacchetto con questo nome per il servizio." : "Aggiornamento non riuscito." }, { status: duplicate ? 409 : 500 });
  }

  const previous = sortInclusions((current as unknown as SessionPackage).inclusions ?? []).map((item) => ({ extra_product_id: item.extra_product_id, quantity: item.quantity }));
  const failure = await replacePackageInclusions(id, parsed.inclusions, previous);
  if (failure) return failure;

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/packages/[id]">) {
  const { id } = await context.params;
  const { error } = await supabaseAdmin.from("session_packages").delete().eq("id", id);

  if (error) {
    const inUse = error.code === "23503";
    return NextResponse.json({ error: inUse ? "Il pacchetto e usato da almeno una sessione: disattivalo invece di eliminarlo." : "Eliminazione non riuscita." }, { status: inUse ? 409 : 500 });
  }

  return NextResponse.json({ ok: true });
}
