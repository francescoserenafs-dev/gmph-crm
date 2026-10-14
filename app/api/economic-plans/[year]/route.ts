import { type NextRequest, NextResponse } from "next/server";
import { loadPlan, parsePlanPayload, parseYear, savePlanAtomic } from "@/lib/economic-plans-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: RouteContext<"/api/economic-plans/[year]">) {
  const year = parseYear((await context.params).year);
  if (year === null) return NextResponse.json({ error: "Anno non valido." }, { status: 400 });
  try {
    const loaded = await loadPlan(year);
    if (!loaded) return NextResponse.json({ error: `Nessun piano ${year}.` }, { status: 404 });
    return NextResponse.json(loaded.plan);
  } catch {
    return NextResponse.json({ error: "Caricamento del piano non riuscito." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext<"/api/economic-plans/[year]">) {
  const year = parseYear((await context.params).year);
  if (year === null) return NextResponse.json({ error: "Anno non valido." }, { status: 400 });
  const payload = await parsePlanPayload(await request.json().catch(() => null));
  if (typeof payload === "string") return NextResponse.json({ error: payload }, { status: 400 });
  const result = await savePlanAtomic(year, false, payload);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  try {
    return NextResponse.json((await loadPlan(year))!.plan);
  } catch {
    return NextResponse.json({ error: "Piano salvato, ma ricaricamento non riuscito." }, { status: 500 });
  }
}

// Elimina solo la configurazione del piano (i target vanno in cascade); sessioni, pagamenti e servizi restano.
export async function DELETE(_request: NextRequest, context: RouteContext<"/api/economic-plans/[year]">) {
  const year = parseYear((await context.params).year);
  if (year === null) return NextResponse.json({ error: "Anno non valido." }, { status: 400 });
  const { error } = await supabaseAdmin.from("annual_economic_plans").delete().eq("year", year);
  if (error) return NextResponse.json({ error: "Eliminazione del piano non riuscita." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
