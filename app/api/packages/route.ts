import { type NextRequest, NextResponse } from "next/server";
import { PACKAGE_COLUMNS, parsePackagePayload } from "@/lib/packages";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const [packages, services] = await Promise.all([
    supabaseAdmin.from("session_packages").select(PACKAGE_COLUMNS).order("sort_order"),
    supabaseAdmin.from("service_types").select("id, name").eq("is_active", true).eq("is_addon", false).order("sort_order"),
  ]);

  const error = packages.error ?? services.error;
  if (error) return NextResponse.json({ error: "Caricamento pacchetti non riuscito." }, { status: 500 });

  return NextResponse.json({ packages: packages.data, services: services.data });
}

export async function POST(request: NextRequest) {
  const parsed = parsePackagePayload((await request.json().catch(() => null)) as Record<string, unknown> | null);
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

  const { data: last } = await supabaseAdmin.from("session_packages").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabaseAdmin.from("session_packages").insert({ ...parsed, sort_order: (last?.sort_order ?? 0) + 10 }).select(PACKAGE_COLUMNS).single();

  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json({ error: duplicate ? "Esiste gia un pacchetto con questo nome per il servizio." : "Creazione non riuscita." }, { status: duplicate ? 409 : 500 });
  }

  return NextResponse.json({ package: data }, { status: 201 });
}
