import { type NextRequest, NextResponse } from "next/server";
import { computeEconomicDashboard } from "@/lib/economic-plans";
import { loadEconomicDataset, loadPlan, loadPlanYears, parseYear } from "@/lib/economic-plans-server";
import { toLocalDateKey } from "@/lib/datetime";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const currentYear = Number(toLocalDateKey(new Date()).slice(0, 4));
  const year = parseYear(request.nextUrl.searchParams.get("year")) ?? currentYear;

  try {
    const [dataset, loaded, planYears, services, firstSession] = await Promise.all([
      loadEconomicDataset(year),
      loadPlan(year),
      loadPlanYears(),
      supabaseAdmin.from("service_types").select("id, name"),
      supabaseAdmin.from("sessions").select("scheduled_at").order("scheduled_at").limit(1),
    ]);
    if (services.error || firstSession.error) throw services.error ?? firstSession.error;

    const firstYear = firstSession.data?.[0] ? Number(toLocalDateKey(new Date(firstSession.data[0].scheduled_at)).slice(0, 4)) : currentYear;
    const years = new Set<number>([...planYears, year, currentYear]);
    for (let candidate = firstYear; candidate <= currentYear; candidate += 1) years.add(candidate);

    const dashboard = computeEconomicDashboard({
      year,
      now: new Date(),
      plan: loaded?.plan ?? null,
      ...dataset,
      serviceNames: new Map((services.data ?? []).map((service) => [service.id, service.name])),
    });

    return NextResponse.json({ ...dashboard, years: Array.from(years).sort((a, b) => b - a), planYears });
  } catch {
    return NextResponse.json({ error: "Non e stato possibile caricare l'analisi economica." }, { status: 500 });
  }
}
