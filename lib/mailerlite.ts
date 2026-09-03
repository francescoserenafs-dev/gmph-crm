const MAILERLITE_API_URL = "https://connect.mailerlite.com/api";

type MailerLiteResponse = { data?: unknown; message?: string };

class MailerLiteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function getToken() {
  const token = process.env.MAILERLITE_API_TOKEN;
  if (!token) throw new Error("MAILERLITE_API_TOKEN non configurata.");
  return token;
}

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${MAILERLITE_API_URL}${path}`, {
    ...options,
    headers: { Accept: "application/json", Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json", ...options.headers },
  });
  const body = (await response.json().catch(() => ({}))) as MailerLiteResponse;
  if (!response.ok) throw new MailerLiteError(typeof body.message === "string" ? body.message : `MailerLite ha restituito ${response.status}.`, response.status);
  return body;
}

export async function listMailerLiteGroups() {
  const body = await request("/groups?limit=100");
  return Array.isArray(body.data) ? body.data as { id: string; name: string }[] : [];
}

export async function listMailerLiteSubscribers() {
  const subscribers: { id: string; email: string; status?: string }[] = [];
  let cursor = "";
  do {
    const query = new URLSearchParams({ limit: "100", include: "groups" });
    if (cursor) query.set("cursor", cursor);
    const body = await request(`/subscribers?${query.toString()}`) as MailerLiteResponse & { meta?: { next_cursor?: string | null } };
    if (Array.isArray(body.data)) subscribers.push(...body.data as { id: string; email: string; status?: string }[]);
    cursor = body.meta?.next_cursor ?? "";
  } while (cursor);
  return subscribers;
}

export async function upsertMailerLiteSubscriber(input: { id?: string | null; email: string; name: string; lastName: string; phone: string | null; groupId: string }) {
  const payload = { email: input.email, fields: { nome: input.name, cognome: input.lastName, cellulare: input.phone ?? "" }, groups: [input.groupId] };
  const body = input.id
    ? await request(`/subscribers/${encodeURIComponent(input.id)}`, { method: "PUT", body: JSON.stringify(payload) })
    : await request("/subscribers", { method: "POST", body: JSON.stringify(payload) });
  return body.data as { id: string };
}

export async function batchUpsertMailerLiteSubscribers(inputs: { id?: string | null; email: string; name: string; lastName: string; phone: string | null; groupId: string }[]) {
  const body = await request("/batch", {
    method: "POST",
    body: JSON.stringify({
      requests: inputs.map((input) => ({
        method: input.id ? "PUT" : "POST",
        path: input.id ? `api/subscribers/${encodeURIComponent(input.id)}` : "api/subscribers",
        body: { email: input.email, fields: { nome: input.name, cognome: input.lastName, cellulare: input.phone ?? "" }, groups: [input.groupId] },
      })),
    }),
  }) as MailerLiteResponse & { responses?: { code: number; body?: { data?: { id: string }; message?: string } }[] };
  return (body.responses ?? []).map((response) => ({
    ok: response.code >= 200 && response.code < 300,
    id: response.body?.data?.id ?? null,
    error: response.body?.message ?? `MailerLite ha restituito ${response.code}.`,
  }));
}

export async function findMailerLiteSubscriber(email: string) {
  try {
    const body = await request(`/subscribers/${encodeURIComponent(email)}`);
    return body.data as { id: string };
  } catch (error) {
    if (error instanceof MailerLiteError && error.status === 404) return null;
    throw error;
  }
}

export async function addSubscriberToGroup(subscriberId: string, groupId: string) {
  await request(`/subscribers/${encodeURIComponent(subscriberId)}/groups/${encodeURIComponent(groupId)}`, { method: "POST" });
}

export async function removeSubscriberFromGroup(subscriberId: string, groupId: string) {
  await request(`/subscribers/${encodeURIComponent(subscriberId)}/groups/${encodeURIComponent(groupId)}`, { method: "DELETE" });
}