import { type NextRequest, NextResponse } from "next/server";
import { sanitizeEmailHtml } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TEMPLATE_COLUMNS = "code, name, subject, body_html, updated_at";

export async function GET(_request: NextRequest, context: RouteContext<"/api/email-templates/[code]">) {
  const { code } = await context.params;
  const { data, error } = await supabaseAdmin.from("email_templates").select(TEMPLATE_COLUMNS).eq("code", code).maybeSingle();

  if (error) return NextResponse.json({ error: "Caricamento modello non riuscito." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Modello non trovato." }, { status: 404 });

  return NextResponse.json({ template: data });
}

export async function PATCH(request: NextRequest, context: RouteContext<"/api/email-templates/[code]">) {
  const { code } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const subject = body && typeof body.subject === "string" ? body.subject.trim() : "";
  const bodyHtml = body && typeof body.bodyHtml === "string" ? sanitizeEmailHtml(body.bodyHtml) : "";

  if (!subject || subject.length > 200) return NextResponse.json({ error: "Inserisci un oggetto valido (max 200 caratteri)." }, { status: 400 });
  if (!bodyHtml || bodyHtml.length > 50_000) return NextResponse.json({ error: "Inserisci il testo dell'email." }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("email_templates").update({ subject, body_html: bodyHtml }).eq("code", code).select(TEMPLATE_COLUMNS).maybeSingle();

  if (error) return NextResponse.json({ error: "Salvataggio non riuscito." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Modello non trovato." }, { status: 404 });

  return NextResponse.json({ template: data });
}
