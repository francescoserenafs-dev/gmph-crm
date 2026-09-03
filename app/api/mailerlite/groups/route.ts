import { NextResponse } from "next/server";
import { listMailerLiteGroups } from "@/lib/mailerlite";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ groups: await listMailerLiteGroups() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Connessione a MailerLite non riuscita." }, { status: 502 });
  }
}