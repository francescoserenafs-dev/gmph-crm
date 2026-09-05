import { NextResponse } from "next/server";
import { getCalendlyCurrentUser, listCalendlyEventTypes } from "@/lib/calendly";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCalendlyCurrentUser();
    const eventTypes = await listCalendlyEventTypes(user.uri);
    return NextResponse.json({ eventTypes: eventTypes.map((eventType) => ({ uri: eventType.uri, name: eventType.name, active: eventType.active })) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossibile caricare gli eventi Calendly." }, { status: 502 });
  }
}
