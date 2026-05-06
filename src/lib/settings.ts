import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";

export const SETTING_OPENAI = "openai_api_key";
export const SETTING_INGEST = "ingest_api_key";

export async function getSetting(key: string): Promise<string | undefined> {
  const db = getDb();
  const row = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, key))
    .limit(1);
  return row[0]?.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = getDb();
  await db
    .insert(schema.appSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value },
    });
}

export async function deleteSetting(key: string): Promise<void> {
  const db = getDb();
  await db.delete(schema.appSettings).where(eq(schema.appSettings.key, key));
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

export async function hasOpenAiKey(): Promise<boolean> {
  return !!(openAiFromEnv() || (await getSetting(SETTING_OPENAI))?.trim());
}

export async function hasIngestKey(): Promise<boolean> {
  return !!(ingestFromEnv() || (await getSetting(SETTING_INGEST))?.trim());
}

export async function getEffectiveOpenAiKey(): Promise<string> {
  const env = openAiFromEnv();
  if (env) return env;
  const dbVal = (await getSetting(SETTING_OPENAI))?.trim();
  if (dbVal) return dbVal;
  throw new Error(
    "OpenAI API key is not configured. Add it under Settings in the app.",
  );
}

export async function getEffectiveIngestApiKey(): Promise<string> {
  const env = ingestFromEnv();
  if (env) return env;
  const dbVal = (await getSetting(SETTING_INGEST))?.trim();
  if (dbVal) return dbVal;
  throw new Error(
    "Ingest API key is not configured. Add it under Settings in the app.",
  );
}
