import sanitizeHtml from "sanitize-html";
import type { EmailTemplateVariable } from "@/lib/email-variables";

const RESEND_API_URL = "https://api.resend.com/emails";

export type EmailSessionContext = {
  clientFirstName: string;
  clientLastName: string;
  serviceName: string;
  scheduledAt: string;
  packageName: string | null;
  packageDescription: string | null;
  includedPhotos: number | null;
  galleryUrl: string | null;
  extras: { name: string; quantity: number; notes: string | null }[];
};

const sessionDate = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" });
// contentEditable can re-serialize hex colors as rgb().
const colorPattern = /^(#[0-9a-f]{3,6}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i;

export function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function sanitizeEmailHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: ["p", "div", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "font", "span", "a"],
    allowedAttributes: { font: ["color", "face", "size"], a: ["href", "style", "target"], span: ["style"] },
    allowedSchemes: ["https", "mailto"],
    allowedStyles: { "*": { color: [colorPattern], "background-color": [colorPattern], padding: [/^[\d\spx]+$/], "text-decoration": [/^none$/], display: [/^inline-block$/], "font-weight": [/^\d{3}$/] } },
    transformTags: { a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: "_blank" } }) },
  }).trim();
}

function multiline(value: string) {
  return escapeHtml(value.trim()).replace(/\r?\n/g, "<br>");
}

function buildVariables(context: EmailSessionContext): Record<EmailTemplateVariable, string> {
  const extras = context.extras.length === 0 ? "" : `<p>Hai inoltre scelto:</p><ul>${context.extras
    .map((extra) => `<li>${extra.quantity > 1 ? `${extra.quantity} × ` : ""}${escapeHtml(extra.name)}${extra.notes ? ` (${escapeHtml(extra.notes)})` : ""}</li>`)
    .join("")}</ul>`;
  const gallery = context.galleryUrl && isHttpsUrl(context.galleryUrl)
    ? `<a href="${escapeHtml(context.galleryUrl)}" style="display: inline-block; padding: 12px 22px; background-color: #9b5d43; color: #ffffff; text-decoration: none; font-weight: 600">Apri la gallery</a>`
    : "";

  return {
    nome: escapeHtml(context.clientFirstName),
    cognome: escapeHtml(context.clientLastName),
    servizio: escapeHtml(context.serviceName),
    data_sessione: sessionDate.format(new Date(context.scheduledAt)),
    pacchetto: escapeHtml(context.packageName ?? ""),
    foto_incluse: context.includedPhotos === null ? "" : String(context.includedPhotos),
    contenuto_pacchetto: context.packageDescription ? multiline(context.packageDescription) : "",
    extra: extras,
    link_gallery: gallery,
  };
}

function replaceVariables(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: string) => (key in variables ? variables[key] : match));
}

export function renderEmailTemplate(template: { subject: string; bodyHtml: string }, context: EmailSessionContext) {
  const variables = buildVariables(context);
  const plainVariables: Record<EmailTemplateVariable, string> = {
    nome: context.clientFirstName,
    cognome: context.clientLastName,
    servizio: context.serviceName,
    data_sessione: variables.data_sessione,
    pacchetto: context.packageName ?? "",
    foto_incluse: variables.foto_incluse,
    contenuto_pacchetto: "",
    extra: "",
    link_gallery: "",
  };
  const body = replaceVariables(sanitizeEmailHtml(template.bodyHtml), variables).replace(/<p>\s*<\/p>/g, "");
  const subject = replaceVariables(template.subject, plainVariables).replace(/\s+/g, " ").trim();

  const warnings: string[] = [];
  if (!variables.link_gallery) warnings.push("Manca il link alla gallery dei provini.");
  if (!context.packageName) warnings.push("Nessun pacchetto associato alla sessione.");
  if (context.includedPhotos === null) warnings.push("Numero di foto incluse non indicato.");

  return { subject, bodyHtml: body, warnings };
}

function wrapInLayout(bodyHtml: string) {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>`
    + `<body style="margin:0;padding:0;background-color:#f5f1eb">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f1eb;padding:24px 12px"><tr><td align="center">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#fdfbf8;border:1px solid #d8d0c5">`
    + `<tr><td style="padding:24px 32px;border-bottom:1px solid #d8d0c5;font-family:Georgia,serif;font-size:14px;letter-spacing:2px;color:#9b5d43">GIULIA MALOSSO PHOTOGRAPHY</td></tr>`
    + `<tr><td style="padding:28px 32px;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#27231f">${bodyHtml}</td></tr>`
    + `</table></td></tr></table></body></html>`;
}

function toPlainText(bodyHtml: string) {
  const withBreaks = bodyHtml.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li)>/gi, "\n").replace(/<li>/gi, "- ").replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, "$2: $1");
  return sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} }).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim();
}

export async function sendTransactionalEmail(input: { to: string; subject: string; bodyHtml: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("Invio email non configurato: imposta RESEND_API_KEY ed EMAIL_FROM.");

  const replyTo = process.env.EMAIL_REPLY_TO?.trim();
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: wrapInLayout(input.bodyHtml),
      text: toPlainText(input.bodyHtml),
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!response.ok) throw new Error(typeof body.message === "string" ? `Invio non riuscito: ${body.message}` : `Invio non riuscito (${response.status}).`);
  return { id: body.id ?? null };
}
