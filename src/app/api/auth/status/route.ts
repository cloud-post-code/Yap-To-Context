import { NextRequest } from "next/server";
import {
  cookieSessionsAvailable,
  verifySessionCookie,
} from "@/lib/ingest-session";
import {
  hasIngestKey,
  hasOpenAiKey,
  ingestFromEnv,
  openAiFromEnv,
} from "@/lib/settings";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return Response.json({
    authenticated: verifySessionCookie(req),
    openAiConfigured: hasOpenAiKey(),
    ingestConfigured: hasIngestKey(),
    cookieSessionsAvailable: cookieSessionsAvailable(),
    envOverrides: {
      openai: !!openAiFromEnv(),
      ingest: !!ingestFromEnv(),
    },
  });
}
