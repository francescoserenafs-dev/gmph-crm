import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function DELETE(_request: NextRequest, context: RouteContext<"/api/calendly/mappings/[id]">) {
  const { id } = await context.params;
  const { error } = await supabaseAdmin.from("calendly_event_type_map").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
