import { type NextRequest, NextResponse } from "next/server";
import { LEAD_CONTACT_TYPES, LEAD_DETAIL_FIELDS, LEAD_LOST_REASONS, type LeadContactType, type LeadStatus, isLeadOpen, isValidDateKey } from "@/lib/leads";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: RouteContext<"/api/leads/[id]">) {
  const { id } = await context.params;
  const { data, error } = await supabaseAdmin.from("leads").select(LEAD_DETAIL_FIELDS).eq("id", id).maybeSingle();

  if (error) return NextResponse.json({ error: "Non e stato possibile caricare il lead." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Lead non trovato." }, { status: 404 });

  return NextResponse.json({ lead: data });
}

export async function PATCH(request: NextRequest, context: RouteContext<"/api/leads/[id]">) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body && typeof body.action === "string" ? body.action : "";

  const { data: current } = await supabaseAdmin.from("leads").select("status, info_sent_at, notes, contact_type, client_id, session_id").eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Lead non trovato." }, { status: 404 });

  if (body?.action === "contact_type") {
    if (current.status === "booked" || current.session_id) return NextResponse.json({ error: "Il tipo contatto non può essere modificato dopo la prenotazione." }, { status: 409 });
    const contactType = typeof body.contactType === "string" ? body.contactType : "";
    const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
    if (!(LEAD_CONTACT_TYPES as readonly string[]).includes(contactType)) return NextResponse.json({ error: "Tipo contatto non valido." }, { status: 400 });
    if (contactType === "existing_client" && !clientId) return NextResponse.json({ error: "Seleziona il cliente collegato al lead." }, { status: 400 });

    let nextClientId = contactType === "existing_client" ? clientId : current.client_id;
    if (contactType === "existing_client") {
      const { data: client } = await supabaseAdmin.from("clients").select("id").eq("id", clientId).maybeSingle();
      if (!client) return NextResponse.json({ error: "Cliente non disponibile. Seleziona un cliente attivo." }, { status: 400 });
    } else if (current.contact_type === "existing_client" && !current.session_id) {
      nextClientId = null;
    }

    const { data, error } = await supabaseAdmin.from("leads")
      .update({ contact_type: contactType as LeadContactType, client_id: nextClientId })
      .eq("id", id)
      .eq("status", current.status)
      .select(LEAD_DETAIL_FIELDS)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "Aggiornamento non riuscito." }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Il lead è stato modificato nel frattempo. Ricarica la pagina." }, { status: 409 });
    return NextResponse.json({ lead: data });
  }

  if (!isLeadOpen(current.status as LeadStatus)) return NextResponse.json({ error: "Il lead e gia chiuso." }, { status: 409 });

  const now = new Date().toISOString();
  let update: Record<string, unknown>;

  if (action === "info_sent") {
    update = { status: "info_sent", info_sent_at: current.info_sent_at ?? now };
  } else if (action === "follow_up") {
    const followUpAt = typeof body?.followUpAt === "string" ? body.followUpAt : "";
    if (!isValidDateKey(followUpAt)) return NextResponse.json({ error: "Indica una data di ricontatto valida." }, { status: 400 });
    update = { status: "follow_up", follow_up_at: followUpAt };
  } else if (action === "lost") {
    const lostReason = typeof body?.lostReason === "string" ? body.lostReason : "";
    if (!(LEAD_LOST_REASONS as readonly string[]).includes(lostReason)) return NextResponse.json({ error: "Seleziona il motivo della perdita." }, { status: 400 });
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : "";
    // Nessuna colonna dedicata: la nota di perdita viene accodata alle note del lead.
    const notes = note ? [current.notes, `Perso: ${note}`].filter(Boolean).join("\n\n") : current.notes;
    update = { status: "lost", lost_reason: lostReason, closed_at: now, notes };
  } else {
    return NextResponse.json({ error: "Azione non disponibile." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("leads")
    .update(update)
    .eq("id", id)
    .eq("status", current.status)
    .select(LEAD_DETAIL_FIELDS)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Aggiornamento non riuscito." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Il lead e stato modificato nel frattempo. Ricarica la pagina." }, { status: 409 });

  return NextResponse.json({ lead: data });
}
