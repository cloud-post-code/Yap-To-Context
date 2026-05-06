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
 * Fail fast when INGEST_API_KEY is set in production but AUTH_SECRET is missing.
 * (Middleware blocks the app in that state; this surfaces it at boot.)
 * OpenAI / ingest passwords may live in Variables or in DB via Settings — not asserted here.
 */
export function assertProductionAuthSecretIfNeeded(): void {
  if (!authSecretMissingWhenRequired()) return;
  throw new Error(
    "Set AUTH_SECRET in host Variables alongside INGEST_API_KEY (e.g. Railway → service → Variables).",
  );
}
