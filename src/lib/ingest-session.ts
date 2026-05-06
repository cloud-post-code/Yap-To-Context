import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import {
  getAuthSecret as getAuthSecretFromEnv,
  productionLikeDeployment,
} from "@/lib/deploy-env";
import { getEffectiveIngestApiKey } from "@/lib/settings";

export const SESSION_COOKIE = "yap_ingest_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

function getAuthSecret(): string | null {
  const s = getAuthSecretFromEnv()?.trim();
  if (s) return s;
  if (productionLikeDeployment()) return null;
  return "development-auth-secret";
}

function sign(payloadB64: string, ingestKey: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`${payloadB64}:${ingestKey}`)
    .digest("hex");
}

export function createSessionCookieValue(): string | null {
  const secret = getAuthSecret();
  if (!secret) return null;

  let ingestKey: string;
  try {
    ingestKey = getEffectiveIngestApiKey();
  } catch {
    return null;
  }

  const exp = Date.now() + MAX_AGE_SEC * 1000;
  const payloadB64 = Buffer.from(JSON.stringify({ exp }), "utf8").toString(
    "base64url",
  );
  const sig = sign(payloadB64, ingestKey, secret);
  return `${payloadB64}.${sig}`;
}

export function verifySessionCookie(req: NextRequest): boolean {
  const secret = getAuthSecret();
  if (!secret) return false;

  let ingestKey: string;
  try {
    ingestKey = getEffectiveIngestApiKey();
  } catch {
    return false;
  }

  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return false;

  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return false;
  const payloadB64 = raw.slice(0, dot);
  const sigHex = raw.slice(dot + 1);

  let expected: string;
  try {
    expected = sign(payloadB64, ingestKey, secret);
  } catch {
    return false;
  }

  if (sigHex.length !== expected.length) return false;
  try {
    if (!timingSafeEqual(Buffer.from(sigHex), Buffer.from(expected)))
      return false;
  } catch {
    return false;
  }

  let exp = 0;
  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as { exp?: number };
    exp = typeof parsed.exp === "number" ? parsed.exp : 0;
  } catch {
    return false;
  }

  return exp > Date.now();
}

export function buildSessionSetCookie(value: string): string {
  const secure =
    process.env.NODE_ENV === "production" ||
    !!process.env.RAILWAY_ENVIRONMENT;
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${MAX_AGE_SEC}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function buildSessionClearCookie(): string {
  const secure =
    process.env.NODE_ENV === "production" ||
    !!process.env.RAILWAY_ENVIRONMENT;
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function cookieSessionsAvailable(): boolean {
  return !!getAuthSecret();
}
