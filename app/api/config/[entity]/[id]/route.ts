import { type NextRequest, NextResponse } from "next/server";
import { entityTables, isEntity } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: RouteContext<"/api/config/[entity]/[id]">) {
  const { entity, id } = await context.params;
  if (!isEntity(entity)) return NextResponse.json({ error: "Entita non valida." }, { status: 400 });

  const config = entityTables[entity];
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dati non validi." }, { status: 400 });

  if (entity === "methods") {
    const { data: current } = await supabaseAdmin.from(config.table).select("is_system").eq("id", id).maybeSingle();
    if (current?.is_system) return NextResponse.json({ error: "Questa voce di sistema non e modificabile." }, { status: 409 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body.isActive === "boolean") update.is_active = body.isActive;
  if (typeof body.sortOrder === "number" && Number.isInteger(body.sortOrder)) update.sort_order = body.sortOrder;
  if (entity === "services" && typeof body.isAddon === "boolean") update.is_addon = body.isAddon;

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nessuna modifica." }, { status: 400 });

  const { error } = await supabaseAdmin.from(config.table).update(update).eq("id", id);
  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json({ error: duplicate ? "Esiste gia una voce con questo nome." : "Aggiornamento non riuscito." }, { status: duplicate ? 409 : 500 });
  }

  return NextResponse.json({ ok: true });
}
