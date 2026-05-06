import { NextRequest } from "next/server";
import { authSecretMissingWhenRequired } from "@/lib/deploy-env";
import {
  cookieSessionsSupported,
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
    authenticated: await verifySessionCookie(req),
    openAiConfigured: await hasOpenAiKey(),
    ingestConfigured: await hasIngestKey(),
    cookieSessionsAvailable: await cookieSessionsSupported(),
    deploymentBlocked: authSecretMissingWhenRequired(),
    envOverrides: {
      openai: !!openAiFromEnv(),
      ingest: !!ingestFromEnv(),
    },
  });
}
