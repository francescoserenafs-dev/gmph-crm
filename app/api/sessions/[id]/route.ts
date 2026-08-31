import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const sessionFields =
  "id, scheduled_at, duration_minutes, location, service_name, service_detail, notes, agreed_price_cents, is_settled, service_type_id, image_consent_granted_at, image_consent_revoked_at, current_stage:session_stages!sessions_current_stage_id_fkey(id,name,code), client:clients!sessions_client_id_fkey(id,first_name,last_name), payments(id,amount_cents,paid_at,paid_date,category,payment_method_name,applied_voucher_id,reference,notes), stage_history:session_stage_history(id,stage_name,changed_at,notes), extras:session_extras(id,service_type_id,service_name,price_cents,notes,created_at)";

async function loadSession(id: string) {
  return supabaseAdmin.from("sessions").select(sessionFields).eq("id", id).maybeSingle();
}

export async function GET(_request: NextRequest, context: RouteContext<"/api/sessions/[id]">) {
  const { id } = await context.params;
  const { data, error } = await loadSession(id);

  if (error) return NextResponse.json({ error: "Non e stato possibile caricare la sessione." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Sessione non trovata." }, { status: 404 });

  return NextResponse.json({ session: data });
}

export async function PATCH(request: NextRequest, context: RouteContext<"/api/sessions/[id]">) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dati non validi." }, { status: 400 });

  if (body.action === "updateStage") {
    const stageId = typeof body.stageId === "string" ? body.stageId : "";
    const changedAt = typeof body.changedAt === "string" ? new Date(body.changedAt) : new Date();
    const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

    if (!stageId || Number.isNaN(changedAt.valueOf())) {
      return NextResponse.json({ error: "Avanzamento non valido." }, { status: 400 });
    }

    const { data: stage } = await supabaseAdmin.from("session_stages").select("id,name").eq("id", stageId).eq("is_active", true).maybeSingle();
    if (!stage) return NextResponse.json({ error: "Avanzamento non disponibile." }, { status: 400 });

    const { error: updateError } = await supabaseAdmin.from("sessions").update({ current_stage_id: stageId }).eq("id", id);
    if (updateError) {
      const overlaps = updateError.message.includes("overlaps");
      return NextResponse.json({ error: overlaps ? "Il ripristino crea una sovrapposizione con un'altra sessione." : "Aggiornamento non riuscito." }, { status: overlaps ? 409 : 500 });
    }

    await supabaseAdmin
      .from("session_stage_history")
      .update({ changed_at: changedAt.toISOString(), notes })
      .eq("session_id", id)
      .order("changed_at", { ascending: false })
      .limit(1);

    const { data } = await loadSession(id);
    return NextResponse.json({ session: data });
  }

  if (body.action === "updateImageConsent") {
    const granted = body.granted === true;

    const { data: current } = await supabaseAdmin.from("sessions").select("image_consent_granted_at, image_consent_revoked_at").eq("id", id).maybeSingle();
    if (!current) return NextResponse.json({ error: "Sessione non trovata." }, { status: 404 });

    const isActive = current.image_consent_granted_at !== null && current.image_consent_revoked_at === null;
    const now = new Date().toISOString();

    const { error: consentError } = await supabaseAdmin
      .from("sessions")
      .update({
        image_consent_granted_at: granted ? (isActive ? current.image_consent_granted_at : now) : current.image_consent_granted_at,
        image_consent_revoked_at: granted ? null : isActive ? now : current.image_consent_revoked_at,
      })
      .eq("id", id);

    if (consentError) return NextResponse.json({ error: "Aggiornamento del consenso non riuscito." }, { status: 500 });

    const { data } = await loadSession(id);
    return NextResponse.json({ session: data });
  }

  const scheduledAt = typeof body.scheduledAt === "string" ? new Date(body.scheduledAt) : null;
  const durationMinutes = Number(body.durationMinutes);
  const priceEuros = Number(body.priceEuros);
  const location = typeof body.location === "string" && body.location.trim() ? body.location.trim() : null;
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  const serviceDetail = typeof body.serviceDetail === "string" && body.serviceDetail.trim() ? body.serviceDetail.trim() : null;

  if (!scheduledAt || Number.isNaN(scheduledAt.valueOf()) || !Number.isInteger(durationMinutes) || durationMinutes <= 0 || !Number.isInteger(priceEuros) || priceEuros < 0) {
    return NextResponse.json({ error: "Compila i campi obbligatori con valori validi." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("sessions")
    .update({ scheduled_at: scheduledAt.toISOString(), duration_minutes: durationMinutes, agreed_price_cents: priceEuros * 100, location, notes, service_detail: serviceDetail })
    .eq("id", id);

  if (error) {
    const overlaps = error.message.includes("overlaps");
    return NextResponse.json({ error: overlaps ? "La sessione si sovrappone a un altro appuntamento." : "Aggiornamento non riuscito." }, { status: overlaps ? 409 : 500 });
  }

  const { data } = await loadSession(id);
  return NextResponse.json({ session: data });
}

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/sessions/[id]">) {
  const { id } = await context.params;
  const { count } = await supabaseAdmin.from("payments").select("id", { count: "exact", head: true }).eq("session_id", id);

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: "La sessione ha pagamenti collegati e non puo essere eliminata." }, { status: 409 });
  }

  const { error } = await supabaseAdmin.from("sessions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Eliminazione non riuscita." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
