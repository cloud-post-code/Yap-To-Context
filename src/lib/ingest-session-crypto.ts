import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "yap_ingest_session";

export function createSignedSessionValue(
  ingestKey: string,
  signingSecret: string,
  maxAgeSec: number,
): string {
  const exp = Date.now() + maxAgeSec * 1000;
  const payloadB64 = Buffer.from(JSON.stringify({ exp }), "utf8").toString(
    "base64url",
  );
  const sig = createHmac("sha256", signingSecret)
    .update(`${payloadB64}:${ingestKey}`)
    .digest("hex");
  return `${payloadB64}.${sig}`;
}

export function verifySignedSessionValue(
  raw: string,
  ingestKey: string,
  signingSecret: string,
): boolean {
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return false;
  const payloadB64 = raw.slice(0, dot);
  const sigHex = raw.slice(dot + 1);

  let expected: string;
  try {
    expected = createHmac("sha256", signingSecret)
      .update(`${payloadB64}:${ingestKey}`)
      .digest("hex");
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
