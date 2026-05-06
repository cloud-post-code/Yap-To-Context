import type { NextRequest } from "next/server";
import {
  authSecretMissingWhenRequired,
  getAuthSecret as getAuthSecretFromEnv,
} from "@/lib/deploy-env";
import {
  createSignedSessionValue,
  SESSION_COOKIE,
  verifySignedSessionValue,
} from "@/lib/ingest-session-crypto";
import { getEffectiveIngestApiKey } from "@/lib/settings";

export { SESSION_COOKIE } from "@/lib/ingest-session-crypto";

const MAX_AGE_SEC = 60 * 60 * 24 * 7;

/** Prefer AUTH_SECRET when set; otherwise the ingest password is the signing secret too. */
function resolveSigningSecret(ingestKey: string): string | null {
  if (authSecretMissingWhenRequired()) return null;
  const env = getAuthSecretFromEnv()?.trim();
  return env || ingestKey;
}

export async function createSessionCookieValue(): Promise<string | null> {
  let ingestKey: string;
  try {
    ingestKey = await getEffectiveIngestApiKey();
  } catch {
    return null;
  }

  const secret = resolveSigningSecret(ingestKey);
  if (!secret) return null;

  return createSignedSessionValue(ingestKey, secret, MAX_AGE_SEC);
}

export async function verifySessionCookie(req: NextRequest): Promise<boolean> {
  if (authSecretMissingWhenRequired()) return false;

  let ingestKey: string;
  try {
    ingestKey = await getEffectiveIngestApiKey();
  } catch {
    return false;
  }

  const secret = resolveSigningSecret(ingestKey);
  if (!secret) return false;

  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return false;

  return verifySignedSessionValue(raw, ingestKey, secret);
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

/** True once an ingest password exists (cookies use it or AUTH_SECRET for signing). */
export async function cookieSessionsSupported(): Promise<boolean> {
  try {
    await getEffectiveIngestApiKey();
    return true;
  } catch {
    return false;
  }
}
