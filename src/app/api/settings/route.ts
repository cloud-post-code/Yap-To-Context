import { NextRequest } from "next/server";
import { z } from "zod";
import { assertIngestAuthorized } from "@/lib/ingest-auth";
import { cookieSessionsSupported } from "@/lib/ingest-session";
import {
  deleteSetting,
  hasIngestKey,
  ingestFromEnv,
  openAiFromEnv,
  setSetting,
  SETTING_INGEST,
  SETTING_OPENAI,
  hasOpenAiKey,
} from "@/lib/settings";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    openAiConfigured: await hasOpenAiKey(),
    ingestConfigured: await hasIngestKey(),
    envOverrides: {
      openai: !!openAiFromEnv(),
      ingest: !!ingestFromEnv(),
    },
    cookieSessionsAvailable: await cookieSessionsSupported(),
  });
}

const postSchema = z
  .object({
    openAiKey: z.string().optional(),
    ingestKey: z.string().optional(),
  })
  .refine((d) => d.openAiKey !== undefined || d.ingestKey !== undefined, {
    message: "Provide openAiKey and/or ingestKey",
  });

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  if (await hasIngestKey()) {
    const denied = await assertIngestAuthorized(req);
    if (denied) return denied;
  }

  const { openAiKey, ingestKey } = parsed.data;

  if (openAiKey !== undefined) {
    if (openAiFromEnv()) {
      /* skip — env wins */
    } else {
      const v = openAiKey.trim();
      if (v) await setSetting(SETTING_OPENAI, v);
      else await deleteSetting(SETTING_OPENAI);
    }
  }

  if (ingestKey !== undefined) {
    if (ingestFromEnv()) {
      /* skip — env wins */
    } else {
      const v = ingestKey.trim();
      if (v) await setSetting(SETTING_INGEST, v);
      else await deleteSetting(SETTING_INGEST);
    }
  }

  return Response.json({ ok: true });
}
