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
