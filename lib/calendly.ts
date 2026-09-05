const CALENDLY_API_URL = "https://api.calendly.com";

type CalendlyResponse = { resource?: unknown; collection?: unknown; message?: string; details?: { required_scopes?: string[] }[]; pagination?: { next_page?: string | null } };

class CalendlyError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function getToken() {
  const token = process.env.CALENDLY_API_TOKEN;
  if (!token) throw new Error("CALENDLY_API_TOKEN non configurata.");
  return token;
}

async function request(pathOrUrl: string) {
  const response = await fetch(pathOrUrl.startsWith("http") ? pathOrUrl : `${CALENDLY_API_URL}${pathOrUrl}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${getToken()}` },
  });
  const body = (await response.json().catch(() => ({}))) as CalendlyResponse;
  if (!response.ok) {
    const missingScopes = body.details?.flatMap((detail) => detail.required_scopes ?? []).join(", ");
    const message = typeof body.message === "string" ? body.message : `Calendly ha restituito ${response.status}.`;
    throw new CalendlyError(missingScopes ? `${message} Scope mancanti sul token: ${missingScopes}.` : message, response.status);
  }
  return body;
}

async function paginate<T>(initialUrl: string) {
  const items: T[] = [];
  let next: string | null = initialUrl;
  while (next) {
    const body = await request(next);
    if (Array.isArray(body.collection)) items.push(...(body.collection as T[]));
    next = body.pagination?.next_page ?? null;
  }
  return items;
}

export type CalendlyEventType = { uri: string; name: string; active: boolean };
export type CalendlyScheduledEvent = {
  uri: string;
  name: string;
  status: string;
  start_time: string;
  end_time: string;
  location: { location?: string; join_url?: string } | null;
  event_type: string;
};
export type CalendlyInvitee = {
  email: string;
  name: string;
  text_reminder_number: string | null;
  questions_and_answers: { question: string; answer: string }[];
};

export async function getCalendlyCurrentUser() {
  const body = await request("/users/me");
  return body.resource as { uri: string; name: string };
}

export async function listCalendlyEventTypes(userUri: string) {
  return paginate<CalendlyEventType>(`/event_types?${new URLSearchParams({ user: userUri, count: "100" })}`);
}

export async function listCalendlyScheduledEvents(userUri: string, minStartTime: string) {
  const query = new URLSearchParams({ user: userUri, min_start_time: minStartTime, status: "active", count: "100", sort: "start_time:asc" });
  return paginate<CalendlyScheduledEvent>(`/scheduled_events?${query}`);
}

export async function listCalendlyInvitees(eventUri: string) {
  const eventUuid = eventUri.split("/").pop();
  return paginate<CalendlyInvitee>(`/scheduled_events/${eventUuid}/invitees?count=100`);
}
