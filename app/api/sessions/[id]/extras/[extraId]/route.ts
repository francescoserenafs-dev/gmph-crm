import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/sessions/[id]/extras/[extraId]">) {
  const { id, extraId } = await context.params;

  const { error } = await supabaseAdmin.from("session_extras").delete().eq("id", extraId).eq("session_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
