import { type NextRequest, NextResponse } from "next/server";
import { toLocalDateKey } from "@/lib/datetime";
import { LEAD_CONTACT_TYPES, LEAD_LIST_FIELDS, LEAD_SOURCES, type LeadContactType, type LeadSource, type LeadStatus, type LeadWithService, compareLeads, isLeadOpen } from "@/lib/leads";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function readText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") ?? "";
  const serviceTypeId = request.nextUrl.searchParams.get("serviceTypeId") ?? "";
  const source = request.nextUrl.searchParams.get("source") ?? "";
  const year = request.nextUrl.searchParams.get("year") ?? "";

  const [leadsResult, servicesResult] = await Promise.all([
    supabaseAdmin.from("leads").select(LEAD_LIST_FIELDS),
    supabaseAdmin.from("service_types").select("id, name, is_active").eq("is_addon", false).order("sort_order"),
  ]);

  if (leadsResult.error || servicesResult.error) {
    return NextResponse.json({ error: "Non e stato possibile caricare i lead." }, { status: 500 });
  }

  const allLeads = (leadsResult.data ?? []) as unknown as LeadWithService[];
  const yearOf = (lead: LeadWithService) => toLocalDateKey(new Date(lead.created_at)).slice(0, 4);

  // I contatori riflettono sempre tutti i lead, indipendentemente dai filtri.
  const counts = {
    toHandle: allLeads.filter((lead) => lead.status === "to_handle").length,
    infoSent: allLeads.filter((lead) => lead.status === "info_sent").length,
    followUp: allLeads.filter((lead) => lead.status === "follow_up").length,
    open: allLeads.filter((lead) => isLeadOpen(lead.status)).length,
  };

  const leads = allLeads
    .filter((lead) => (!status || lead.status === status) && (!serviceTypeId || lead.service_type_id === serviceTypeId) && (!source || lead.source === source) && (!year || yearOf(lead) === year))
    .sort(compareLeads);

  const years = Array.from(new Set(allLeads.map(yearOf))).sort((a, b) => b.localeCompare(a));

  return NextResponse.json({ leads, counts, services: servicesResult.data ?? [], years });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dati non validi." }, { status: 400 });

  const name = readText(body.name, 120);
  const lastName = readText(body.lastName, 120) || null;
  const contact = readText(body.contact, 200);
  const serviceTypeId = readText(body.serviceTypeId, 64);
  const source = readText(body.source, 32);
  const contactType = readText(body.contactType, 32);
  const clientId = readText(body.clientId, 64);
  const requestedPeriod = readText(body.requestedPeriod, 200) || null;
  const notes = readText(body.notes, 2000) || null;

  if (!name || !contact || !serviceTypeId || !(LEAD_SOURCES as readonly string[]).includes(source) || !(LEAD_CONTACT_TYPES as readonly string[]).includes(contactType)) {
    return NextResponse.json({ error: "Compila nome, servizio, contatto e origine." }, { status: 400 });
  }
  if (contactType === "existing_client" && !clientId) {
    return NextResponse.json({ error: "Seleziona il cliente collegato al lead." }, { status: 400 });
  }

  const [{ data: service }, clientResult] = await Promise.all([
    supabaseAdmin.from("service_types").select("id").eq("id", serviceTypeId).eq("is_active", true).eq("is_addon", false).maybeSingle(),
    contactType === "existing_client"
      ? supabaseAdmin.from("clients").select("id").eq("id", clientId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (!service) return NextResponse.json({ error: "Servizio non disponibile." }, { status: 400 });
  if (contactType === "existing_client" && !clientResult.data) return NextResponse.json({ error: "Cliente non disponibile. Seleziona un cliente attivo." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("leads")
    .insert({ name, last_name: lastName, contact, contact_type: contactType as LeadContactType, client_id: contactType === "existing_client" ? clientResult.data!.id : null, service_type_id: service.id, source: source as LeadSource, requested_period: requestedPeriod, notes, status: "to_handle" satisfies LeadStatus })
    .select(LEAD_LIST_FIELDS)
    .single();

  if (error || !data) return NextResponse.json({ error: "Creazione del lead non riuscita." }, { status: 500 });

  return NextResponse.json({ lead: data }, { status: 201 });
}
