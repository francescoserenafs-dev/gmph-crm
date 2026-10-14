import { type NextRequest, NextResponse } from "next/server";
import { analyzeClientRetention, type RetentionSession } from "@/lib/client-retention";
import { toLocalDateKey } from "@/lib/datetime";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;

type SessionRow = {
  id: string;
  client_id: string;
  service_type_id: string;
  service_name: string;
  scheduled_at: string;
  agreed_price_cents: number;
  current_stage: { code: string } | null;
  client: { first_name: string; last_name: string } | null;
  extras: { line_total_cents: number }[];
};

async function loadSessions() {
  const sessions: SessionRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const result = await supabaseAdmin
      .from("sessions")
      .select("id, client_id, service_type_id, service_name, scheduled_at, agreed_price_cents, current_stage:session_stages!sessions_current_stage_id_fkey(code), client:clients!sessions_client_id_fkey(first_name,last_name), extras:session_extras(line_total_cents)")
      .order("scheduled_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (result.error) return { sessions: null, error: result.error };
    const page = (result.data ?? []) as unknown as SessionRow[];
    sessions.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return { sessions, error: null };
}

function isLegacyProofs(name: string) {
  return name.trim().toLocaleLowerCase("it-IT") === "provini extra";
}

export async function GET(request: NextRequest) {
  const currentYear = Number(toLocalDateKey(new Date()).slice(0, 4));
  const requestedYear = Number(request.nextUrl.searchParams.get("year"));
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : currentYear;
  const requestedThreshold = Number(request.nextUrl.searchParams.get("reactivationMonths"));
  const reactivationMonths = [6, 12, 18, 24].includes(requestedThreshold) ? requestedThreshold : 6;
  const initialServiceId = request.nextUrl.searchParams.get("initialServiceId") ?? "";
  const nextServiceId = request.nextUrl.searchParams.get("nextServiceId") ?? "";

  const [sessionsResult, servicesResult] = await Promise.all([
    loadSessions(),
    supabaseAdmin.from("service_types").select("id, name, is_addon").order("sort_order").order("name"),
  ]);

  if (sessionsResult.error || servicesResult.error) {
    return NextResponse.json({ error: "Non e stato possibile caricare l'analisi clienti." }, { status: 500 });
  }

  const services = servicesResult.data ?? [];
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const sessions: RetentionSession[] = (sessionsResult.sessions ?? []).map((session) => {
    const service = serviceById.get(session.service_type_id);
    return {
      id: session.id,
      clientId: session.client_id,
      clientName: [session.client?.first_name, session.client?.last_name].filter(Boolean).join(" ") || "Cliente senza nome",
      scheduledAt: session.scheduled_at,
      serviceTypeId: session.service_type_id,
      serviceTypeName: service?.name ?? session.service_name,
      serviceName: session.service_name,
      agreedPriceCents: session.agreed_price_cents,
      extrasCents: (session.extras ?? []).reduce((sum, extra) => sum + (extra.line_total_cents ?? 0), 0),
      isCancelled: session.current_stage?.code === "cancelled",
      isAddon: service?.is_addon ?? false,
    };
  });

  const currentTime = new Date();
  const firstYear = sessions
    .filter((session) => !session.isCancelled && !session.isAddon && !isLegacyProofs(session.serviceName) && !isLegacyProofs(session.serviceTypeName))
    .map((session) => Number(toLocalDateKey(new Date(session.scheduledAt)).slice(0, 4)))
    .filter((sessionYear) => sessionYear <= currentYear)
    .sort((a, b) => a - b)[0] ?? currentYear;
  const years = Array.from({ length: Math.max(1, currentYear - firstYear + 1) }, (_, index) => currentYear - index);
  if (!years.includes(year)) years.push(year);
  years.sort((a, b) => b - a);

  const analysis = analyzeClientRetention({
    sessions,
    year,
    now: currentTime,
    reactivationMonths,
    initialServiceId,
    nextServiceId,
  });

  return NextResponse.json({
    year,
    years,
    reactivationMonths,
    services: services
      .filter((service) => !service.is_addon && !isLegacyProofs(service.name))
      .map(({ id, name }) => ({ id, name })),
    ...analysis,
  });
}