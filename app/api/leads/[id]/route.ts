import { type NextRequest, NextResponse } from "next/server";
import { LEAD_DETAIL_FIELDS, LEAD_LOST_REASONS, type LeadStatus, isLeadOpen, isValidDateKey } from "@/lib/leads";
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

  const { data: current } = await supabaseAdmin.from("leads").select("status, info_sent_at, notes").eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Lead non trovato." }, { status: 404 });
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
