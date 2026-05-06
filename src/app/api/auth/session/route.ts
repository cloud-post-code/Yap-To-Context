import { timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  buildSessionSetCookie,
  createSessionCookieValue,
} from "@/lib/ingest-session";
import { getEffectiveIngestApiKey } from "@/lib/settings";

export const runtime = "nodejs";

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

const bodySchema = z.object({
  ingestKey: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  let expected: string;
  try {
    expected = getEffectiveIngestApiKey();
  } catch {
    return Response.json(
      { error: "Ingest API key is not configured yet." },
      { status: 400 },
    );
  }

  const given = parsed.data.ingestKey.trim();
  if (!timingSafeStringEq(given, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const val = createSessionCookieValue();
  if (!val) {
    return Response.json(
      {
        error:
          "Cookie sign-in is unavailable. Set AUTH_SECRET on the server (recommended on Railway), or call APIs with the Bearer / X-Api-Key header.",
      },
      { status: 503 },
    );
  }

  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", buildSessionSetCookie(val));
  return res;
}
