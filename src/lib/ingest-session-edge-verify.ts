/**
 * Edge-compatible session verification (Web Crypto). Must match
 * {@link verifySignedSessionValue} in ingest-session-crypto.ts.
 */

export const SESSION_COOKIE_NAME = "yap_ingest_session";

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

function hexFromBuffer(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(keyStr: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(keyStr),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return hexFromBuffer(sig);
}

/** Async Edge-safe verifier for middleware (no Node `crypto`). */
export async function verifySignedSessionValueEdge(
  raw: string,
  ingestKey: string,
  signingSecret: string,
): Promise<boolean> {
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return false;
  const payloadB64 = raw.slice(0, dot);
  const sigHex = raw.slice(dot + 1);

  let expected: string;
  try {
    expected = await hmacSha256Hex(signingSecret, `${payloadB64}:${ingestKey}`);
  } catch {
    return false;
  }

  if (!timingSafeEqualHex(sigHex, expected)) return false;

  let exp = 0;
  try {
    const padLength = (4 - (payloadB64.length % 4)) % 4;
    const b64 =
      payloadB64.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat(padLength);
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const jsonStr = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(jsonStr) as { exp?: number };
    exp = typeof parsed.exp === "number" ? parsed.exp : 0;
  } catch {
    return false;
  }

  return exp > Date.now();
}
