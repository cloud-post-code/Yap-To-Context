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

/** Required for signed ingest cookies on production-like hosts (recommended on Railway). */
export function getAuthSecret(): string | undefined {
  const v = process.env.AUTH_SECRET?.trim();
  return v || undefined;
}
