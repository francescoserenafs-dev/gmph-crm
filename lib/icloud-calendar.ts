import { createDAVClient } from "tsdav";

export type IcloudSessionEvent = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  location: string | null;
  notes: string | null;
  serviceName: string;
  clientName: string;
};

let clientPromise: ReturnType<typeof createDAVClient> | null = null;
let calendarUrlPromise: Promise<string | null> | null = null;

function isConfigured() {
  return Boolean(process.env.ICLOUD_CALDAV_USERNAME && process.env.ICLOUD_CALDAV_APP_PASSWORD && process.env.ICLOUD_CALENDAR_NAME);
}

function getClient() {
  if (!clientPromise) {
    clientPromise = createDAVClient({
      serverUrl: "https://caldav.icloud.com",
      credentials: { username: process.env.ICLOUD_CALDAV_USERNAME, password: process.env.ICLOUD_CALDAV_APP_PASSWORD },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });
  }
  return clientPromise;
}

async function getCalendarUrl() {
  if (!calendarUrlPromise) {
    calendarUrlPromise = (async () => {
      const client = await getClient();
      const calendars = await client.fetchCalendars();
      const targetName = process.env.ICLOUD_CALENDAR_NAME?.trim().toLowerCase();
      const match = calendars.find((calendar) => String(calendar.displayName ?? "").trim().toLowerCase() === targetName);
      return match?.url ?? null;
    })();
  }
  return calendarUrlPromise;
}

function formatIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function buildIcsEvent(event: IcloudSessionEvent) {
  const start = new Date(event.scheduledAt);
  const end = new Date(start.getTime() + event.durationMinutes * 60_000);
  const descriptionParts = [event.notes ? `Note: ${event.notes}` : null].filter(Boolean) as string[];

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//crm-gmph//sessions//IT",
    "BEGIN:VEVENT",
    `UID:crm-session-${event.id}@crm-gmph`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(`${event.serviceName} - ${event.clientName}`)}`,
    ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
    ...(descriptionParts.length ? [`DESCRIPTION:${escapeIcsText(descriptionParts.join("\n"))}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

// Best-effort sync: never throws, so a broken iCloud connection cannot block CRM operations.
export async function upsertIcloudEvent(event: IcloudSessionEvent, existingUrl: string | null): Promise<string | null> {
  if (!isConfigured()) return existingUrl;

  try {
    const client = await getClient();
    const iCalString = buildIcsEvent(event);

    if (existingUrl) {
      await client.updateCalendarObject({ calendarObject: { url: existingUrl, data: iCalString } });
      return existingUrl;
    }

    const calendarUrl = await getCalendarUrl();
    if (!calendarUrl) {
      console.error(`Calendario iCloud "${process.env.ICLOUD_CALENDAR_NAME}" non trovato.`);
      return null;
    }

    const response = await client.createCalendarObject({ calendar: { url: calendarUrl }, iCalString, filename: `crm-session-${event.id}.ics` });
    if (!response.ok) {
      console.error(`Creazione evento iCloud non riuscita: ${response.status} ${response.statusText}`);
      return null;
    }
    return new URL(`crm-session-${event.id}.ics`, calendarUrl.endsWith("/") ? calendarUrl : `${calendarUrl}/`).toString();
  } catch (reason) {
    console.error("Sincronizzazione iCloud non riuscita.", reason);
    return existingUrl;
  }
}

export async function deleteIcloudEvent(url: string | null): Promise<void> {
  if (!isConfigured() || !url) return;

  try {
    const client = await getClient();
    await client.deleteCalendarObject({ calendarObject: { url } });
  } catch (reason) {
    console.error("Eliminazione evento iCloud non riuscita.", reason);
  }
}
