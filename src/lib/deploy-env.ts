/**
 * Deployment helpers for Railway and similar hosts.
 */

export function productionLikeDeployment(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    !!process.env.RAILWAY_ENVIRONMENT ||
    !!process.env.RAILWAY_PROJECT_ID
  );
}

/** Optional extra entropy for cookie signatures; when unset, the ingest password is used. */
export function getAuthSecret(): string | undefined {
  const v = process.env.AUTH_SECRET?.trim();
  return v || undefined;
}

/**
 * On Railway/production, when the app password is set via INGEST_API_KEY (recommended),
 * AUTH_SECRET must also be set so session cookies are signed with a dedicated secret.
 */
export function authSecretMissingWhenRequired(): boolean {
  return (
    productionLikeDeployment() &&
    !!process.env.INGEST_API_KEY?.trim() &&
    !getAuthSecret()
  );
}

/**
 * In production / Railway, secrets must come from service variables (not only DB Settings).
 * Fails fast at boot so misconfigured deploys surface in logs immediately.
 */
export function missingRequiredProductionEnvVars(): string[] {
  if (!productionLikeDeployment()) return [];
  const missing: string[] = [];
  if (!process.env.OPENAI_API_KEY?.trim()) missing.push("OPENAI_API_KEY");
  if (!process.env.INGEST_API_KEY?.trim()) missing.push("INGEST_API_KEY");
  if (authSecretMissingWhenRequired()) missing.push("AUTH_SECRET");
  return missing;
}

export function assertRequiredProductionEnvVars(): void {
  const missing = missingRequiredProductionEnvVars();
  if (missing.length === 0) return;
  throw new Error(
    `Set these in the host Variables (e.g. Railway → service → Variables): ${missing.join(", ")}.`,
  );
}
