import { type NextRequest, NextResponse } from "next/server";
import { entityTables, isEntity, nextSortOrder, slugify } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: RouteContext<"/api/config/[entity]">) {
  const { entity } = await context.params;
  if (!isEntity(entity)) return NextResponse.json({ error: "Entita non valida." }, { status: 400 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = body && typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) return NextResponse.json({ error: "Inserisci un nome valido." }, { status: 400 });

  const config = entityTables[entity];
  const sortOrder = await nextSortOrder(config.table);
  const insert: Record<string, unknown> = { name, sort_order: sortOrder };
  if (config.hasCode) insert.code = `${slugify(name)}_${Date.now().toString(36)}`;

  const { data, error } = await supabaseAdmin.from(config.table).insert(insert).select("id").single();
  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json({ error: duplicate ? "Esiste gia una voce con questo nome." : "Creazione non riuscita." }, { status: duplicate ? 409 : 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
