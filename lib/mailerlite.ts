const MAILERLITE_API_URL = "https://connect.mailerlite.com/api";

type MailerLiteResponse = { data?: unknown; message?: string };

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
  if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : `MailerLite ha restituito ${response.status}.`);
  return body;
}

export async function listMailerLiteGroups() {
  const body = await request("/groups?limit=100");
  return Array.isArray(body.data) ? body.data as { id: string; name: string }[] : [];
}

export async function upsertMailerLiteSubscriber(input: { id?: string | null; email: string; name: string; lastName: string; phone: string | null }) {
  const payload = { email: input.email, fields: { $nome: input.name, $cognome: input.lastName, $cellulare: input.phone ?? "" } };
  const body = input.id
    ? await request(`/subscribers/${encodeURIComponent(input.id)}`, { method: "PUT", body: JSON.stringify(payload) })
    : await request("/subscribers", { method: "POST", body: JSON.stringify(payload) });
  return body.data as { id: string };
}

export async function findMailerLiteSubscriber(email: string) {
  const body = await request(`/subscribers?filter[email]=${encodeURIComponent(email)}&limit=1`);
  const subscribers = Array.isArray(body.data) ? body.data as { id: string }[] : [];
  return subscribers[0] ?? null;
}

export async function addSubscriberToGroup(subscriberId: string, groupId: string) {
  await request(`/subscribers/${encodeURIComponent(subscriberId)}/groups/${encodeURIComponent(groupId)}`, { method: "POST" });
}

export async function removeSubscriberFromGroup(subscriberId: string, groupId: string) {
  await request(`/subscribers/${encodeURIComponent(subscriberId)}/groups/${encodeURIComponent(groupId)}`, { method: "DELETE" });
}