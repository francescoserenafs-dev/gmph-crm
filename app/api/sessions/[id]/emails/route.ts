import { type NextRequest, NextResponse } from "next/server";
import { type EmailSessionContext, renderEmailTemplate, sanitizeEmailHtml, sendTransactionalEmail } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Stage set automatically after a successful send, per template.
const STAGE_AFTER_SEND: Record<string, string> = { proofs: "proofs_sent" };

type LoadedSession = {
  scheduled_at: string;
  service_name: string;
  service_detail: string | null;
  included_photos: number | null;
  proofs_gallery_url: string | null;
  current_stage: { code: string } | null;
  client: { first_name: string; last_name: string; email: string | null } | null;
  package: { name: string; included_photos: number; description: string | null } | null;
  extras: { service_name: string; quantity: number; notes: string | null; created_at: string }[];
};

async function loadContext(sessionId: string) {
  const { data } = await supabaseAdmin
    .from("sessions")
    .select("scheduled_at, service_name, service_detail, included_photos, proofs_gallery_url, current_stage:session_stages!sessions_current_stage_id_fkey(code), client:clients!sessions_client_id_fkey(first_name,last_name,email), package:session_packages!sessions_package_id_fkey(name,included_photos,description), extras:session_extras(service_name,quantity,notes,created_at)")
    .eq("id", sessionId)
    .maybeSingle();
  const session = data as unknown as LoadedSession | null;
  if (!session || !session.client) return null;

  const context: EmailSessionContext = {
    clientFirstName: session.client.first_name,
    clientLastName: session.client.last_name,
    serviceName: session.service_detail ? `${session.service_name} - ${session.service_detail}` : session.service_name,
    scheduledAt: session.scheduled_at,
    packageName: session.package?.name ?? null,
    packageDescription: session.package?.description ?? null,
    includedPhotos: session.included_photos ?? session.package?.included_photos ?? null,
    galleryUrl: session.proofs_gallery_url,
    extras: [...session.extras].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((extra) => ({ name: extra.service_name, quantity: extra.quantity, notes: extra.notes })),
  };
  return { context, email: session.client.email?.trim() || null, stageCode: session.current_stage?.code ?? null };
}

export async function POST(request: NextRequest, context: RouteContext<"/api/sessions/[id]/emails">) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const templateCode = body && typeof body.templateCode === "string" ? body.templateCode : "";
  const mode = body?.mode === "send" ? "send" : "preview";

  const { data: template } = await supabaseAdmin.from("email_templates").select("subject, body_html").eq("code", templateCode).maybeSingle();
  if (!template) return NextResponse.json({ error: "Modello email non trovato." }, { status: 404 });

  const loaded = await loadContext(id);
  if (!loaded) return NextResponse.json({ error: "Sessione o cliente non trovati." }, { status: 404 });
  if (loaded.stageCode === "cancelled") return NextResponse.json({ error: "La sessione e annullata." }, { status: 409 });

  if (mode === "preview") {
    const rendered = renderEmailTemplate({ subject: template.subject, bodyHtml: template.body_html }, loaded.context);
    if (!loaded.email) rendered.warnings.unshift("Il cliente non ha un indirizzo email.");
    return NextResponse.json({ to: loaded.email, ...rendered });
  }

  const subject = typeof body?.subject === "string" ? body.subject.replace(/\s+/g, " ").trim() : "";
  const bodyHtml = typeof body?.bodyHtml === "string" ? sanitizeEmailHtml(body.bodyHtml) : "";
  if (!loaded.email) return NextResponse.json({ error: "Il cliente non ha un indirizzo email." }, { status: 400 });
  if (!subject || subject.length > 200 || !bodyHtml || bodyHtml.length > 50_000) return NextResponse.json({ error: "Oggetto o testo dell'email non validi." }, { status: 400 });
  if (templateCode === "proofs" && !loaded.context.galleryUrl) return NextResponse.json({ error: "Aggiungi il link alla gallery prima di inviare." }, { status: 400 });

  let messageId: string | null;
  try {
    ({ id: messageId } = await sendTransactionalEmail({ to: loaded.email, subject, bodyHtml }));
  } catch (reason) {
    return NextResponse.json({ error: reason instanceof Error ? reason.message : "Invio non riuscito." }, { status: 502 });
  }

  await supabaseAdmin.from("session_emails").insert({ session_id: id, template_code: templateCode, to_email: loaded.email, subject, body_html: bodyHtml, provider_message_id: messageId });

  const nextStageCode = STAGE_AFTER_SEND[templateCode];
  if (nextStageCode && loaded.stageCode !== nextStageCode) {
    const { data: stage } = await supabaseAdmin.from("session_stages").select("id").eq("code", nextStageCode).eq("is_active", true).maybeSingle();
    if (stage) await supabaseAdmin.from("sessions").update({ current_stage_id: stage.id }).eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
