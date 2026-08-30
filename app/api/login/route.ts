import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, createSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const accessCode = process.env.ACCESS_CODE;

  if (!accessCode) return NextResponse.json({ error: "Accesso non configurato." }, { status: 500 });
  if (!code || code !== accessCode) return NextResponse.json({ error: "Codice non valido." }, { status: 401 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
