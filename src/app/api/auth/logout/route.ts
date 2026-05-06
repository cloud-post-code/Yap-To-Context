import { buildSessionClearCookie } from "@/lib/ingest-session";

export const runtime = "nodejs";

export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", buildSessionClearCookie());
  return res;
}
