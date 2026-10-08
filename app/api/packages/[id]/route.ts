import { type NextRequest, NextResponse } from "next/server";
import { PACKAGE_COLUMNS, parsePackagePayload } from "@/lib/packages";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: RouteContext<"/api/packages/[id]">) {
  const { id } = await context.params;
  const parsed = parsePackagePayload((await request.json().catch(() => null)) as Record<string, unknown> | null);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("session_packages").update(parsed).eq("id", id).select(PACKAGE_COLUMNS).maybeSingle();

  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json({ error: duplicate ? "Esiste gia un pacchetto con questo nome per il servizio." : "Aggiornamento non riuscito." }, { status: duplicate ? 409 : 500 });
  }
  if (!data) return NextResponse.json({ error: "Pacchetto non trovato." }, { status: 404 });

  return NextResponse.json({ package: data });
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
