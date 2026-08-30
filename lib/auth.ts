import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "gmph_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 giorni

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing SESSION_SECRET environment variable.");
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function createSessionToken() {
  const expiresAt = String(Date.now() + SESSION_DURATION_MS);
  return `${expiresAt}.${sign(expiresAt)}`;
}

export function isValidSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature) return false;
  if (Number(expiresAt) < Date.now()) return false;

  const expectedSignature = sign(expiresAt);
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export { COOKIE_NAME };
