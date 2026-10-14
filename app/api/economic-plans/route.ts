import { type NextRequest, NextResponse } from "next/server";
import { EMPTY_PLAN_PAYLOAD, loadActivePackages, loadPlanYears, parseYear, savePlanAtomic } from "@/lib/economic-plans-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [years, services, packages] = await Promise.all([
      loadPlanYears(),
      supabaseAdmin.from("service_types").select("id, name, is_active").eq("is_addon", false).order("sort_order").order("name"),
      loadActivePackages(),
    ]);
    if (services.error) throw services.error;
    return NextResponse.json({ years, services: services.data ?? [], packages });
  } catch {
    return NextResponse.json({ error: "Non e stato possibile caricare i piani economici." }, { status: 500 });
  }
}

// Nuovo piano vuoto: nessuna copia dall'anno precedente.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const year = parseYear(body?.year);
  if (year === null) return NextResponse.json({ error: "Anno non valido." }, { status: 400 });

  const result = await savePlanAtomic(year, true, EMPTY_PLAN_PAYLOAD);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ year }, { status: 201 });
}
