import { type NextRequest, NextResponse } from "next/server";
import { parseLocalDateTime, toLocalDateKey } from "@/lib/datetime";
import { LEAD_LOST_REASONS, LEAD_SOURCES, type LeadLostReason, type LeadSource, type LeadStatus } from "@/lib/leads";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CohortLead = {
  status: LeadStatus;
  source: LeadSource;
  lost_reason: LeadLostReason | null;
  service_type_id: string;
  created_at: string;
  session: { agreed_price_cents: number } | null;
};

type Bucket = { leads: number; booked: number; bookedValueCents: number };

function emptyBucket(): Bucket {
  return { leads: 0, booked: 0, bookedValueCents: 0 };
}

function addLead(bucket: Bucket, lead: CohortLead) {
  bucket.leads += 1;
  if (lead.status !== "booked") return;
  bucket.booked += 1;
  // Valore iniziale concordato della sessione collegata, senza extra.
  bucket.bookedValueCents += lead.session?.agreed_price_cents ?? 0;
}

function withRates(bucket: Bucket) {
  return {
    ...bucket,
    conversionRate: bucket.leads > 0 ? bucket.booked / bucket.leads : null,
    averageTicketCents: bucket.booked > 0 ? Math.round(bucket.bookedValueCents / bucket.booked) : null,
  };
}

export async function GET(request: NextRequest) {
  const currentYear = Number(toLocalDateKey(new Date()).slice(0, 4));
  const requestedYear = Number(request.nextUrl.searchParams.get("year"));
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : currentYear;
  const serviceTypeId = request.nextUrl.searchParams.get("serviceTypeId") ?? "";

  // Coorte di ingresso: lead creati nell'anno (Europe/Rome), qualunque sia la data di conversione.
  const cohortStart = parseLocalDateTime(`${year}-01-01T00:00`).toISOString();
  const cohortEnd = parseLocalDateTime(`${year + 1}-01-01T00:00`).toISOString();

  let cohortQuery = supabaseAdmin
    .from("leads")
    .select("status, source, lost_reason, service_type_id, created_at, session:sessions!leads_session_id_fkey(agreed_price_cents)")
    .gte("created_at", cohortStart)
    .lt("created_at", cohortEnd);
  if (serviceTypeId) cohortQuery = cohortQuery.eq("service_type_id", serviceTypeId);

  const [cohortResult, yearsResult, servicesResult] = await Promise.all([
    cohortQuery,
    supabaseAdmin.from("leads").select("created_at").order("created_at", { ascending: true }).limit(1),
    supabaseAdmin.from("service_types").select("id, name, is_addon").order("sort_order"),
  ]);

  if (cohortResult.error || yearsResult.error || servicesResult.error) {
    return NextResponse.json({ error: "Non e stato possibile caricare le analisi lead." }, { status: 500 });
  }

  const leads = (cohortResult.data ?? []) as unknown as CohortLead[];
  const services = servicesResult.data ?? [];
  const serviceNames = new Map(services.map((service) => [service.id, service.name]));

  const firstYear = yearsResult.data?.[0] ? Number(toLocalDateKey(new Date(yearsResult.data[0].created_at)).slice(0, 4)) : currentYear;
  const years: number[] = [];
  for (let candidate = Math.max(currentYear, year); candidate >= Math.min(firstYear, year); candidate -= 1) years.push(candidate);

  const total = emptyBucket();
  const byMonth = Array.from({ length: 12 }, emptyBucket);
  const byService = new Map<string, Bucket>();
  const bySource = new Map<LeadSource, Bucket>(LEAD_SOURCES.map((source) => [source, emptyBucket()]));
  const lostByReason = new Map<LeadLostReason, number>(LEAD_LOST_REASONS.map((reason) => [reason, 0]));
  let lostTotal = 0;

  for (const lead of leads) {
    addLead(total, lead);
    addLead(byMonth[Number(toLocalDateKey(new Date(lead.created_at)).slice(5, 7)) - 1], lead);
    if (!byService.has(lead.service_type_id)) byService.set(lead.service_type_id, emptyBucket());
    addLead(byService.get(lead.service_type_id)!, lead);
    addLead(bySource.get(lead.source)!, lead);
    if (lead.status === "lost") {
      lostTotal += 1;
      if (lead.lost_reason) lostByReason.set(lead.lost_reason, (lostByReason.get(lead.lost_reason) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    year,
    years,
    serviceTypeId,
    services: services.filter((service) => !service.is_addon).map(({ id, name }) => ({ id, name })),
    totals: withRates(total),
    byMonth: byMonth.map((bucket, index) => ({ month: index + 1, leads: bucket.leads, booked: bucket.booked })),
    byService: Array.from(byService.entries())
      .map(([id, bucket]) => ({ id, label: serviceNames.get(id) ?? "Servizio non disponibile", ...withRates(bucket) }))
      .sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label)),
    bySource: LEAD_SOURCES.map((source) => ({ source, ...withRates(bySource.get(source)!) })),
    lostReasons: LEAD_LOST_REASONS.map((reason) => ({ reason, count: lostByReason.get(reason) ?? 0, share: lostTotal > 0 ? (lostByReason.get(reason) ?? 0) / lostTotal : null })),
    lostTotal,
  });
}
