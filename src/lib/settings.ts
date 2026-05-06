import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";

export const SETTING_OPENAI = "openai_api_key";
export const SETTING_INGEST = "ingest_api_key";

export function getSetting(key: string): string | undefined {
  const db = getDb();
  const row = db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, key))
    .get();
  return row?.value;
}

export function setSetting(key: string, value: string) {
  const db = getDb();
  db.insert(schema.appSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value },
    })
    .run();
}

export function deleteSetting(key: string) {
  const db = getDb();
  db.delete(schema.appSettings)
    .where(eq(schema.appSettings.key, key))
    .run();
}

/** Railway / hosting env overrides anything saved in the app UI. */
export function openAiFromEnv(): string | undefined {
  const v = process.env.OPENAI_API_KEY?.trim();
  return v || undefined;
}

export function ingestFromEnv(): string | undefined {
  const v = process.env.INGEST_API_KEY?.trim();
  return v || undefined;
}

export function hasOpenAiKey(): boolean {
  return !!(openAiFromEnv() || getSetting(SETTING_OPENAI)?.trim());
}

export function hasIngestKey(): boolean {
  return !!(ingestFromEnv() || getSetting(SETTING_INGEST)?.trim());
}

export function getEffectiveOpenAiKey(): string {
  const env = openAiFromEnv();
  if (env) return env;
  const dbVal = getSetting(SETTING_OPENAI)?.trim();
  if (dbVal) return dbVal;
  throw new Error(
    "OpenAI API key is not configured. Add it under Settings in the app.",
  );
}

export function getEffectiveIngestApiKey(): string {
  const env = ingestFromEnv();
  if (env) return env;
  const dbVal = getSetting(SETTING_INGEST)?.trim();
  if (dbVal) return dbVal;
  throw new Error(
    "Ingest API key is not configured. Add it under Settings in the app.",
  );
}
