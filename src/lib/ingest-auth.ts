import { timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { verifySessionCookie } from "@/lib/ingest-session";
import { getEffectiveIngestApiKey } from "@/lib/settings";

function timingSafeStringEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  try {
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function assertIngestAuthorized(req: NextRequest): Response | null {
  let token =
    req.headers.get("x-api-key")?.trim() ||
    (req.headers.get("authorization")?.startsWith("Bearer ")
      ? req.headers.get("authorization")!.slice(7).trim()
      : null);

  let key: string;
  try {
    key = getEffectiveIngestApiKey();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Not configured";
    return Response.json({ error: msg }, { status: 500 });
  }

  if (verifySessionCookie(req)) {
    return null;
  }

  if (!token || !timingSafeStringEq(token, key)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
