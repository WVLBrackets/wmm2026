export function getBuildStamp(): string {
  const environment =
    process.env.VERCEL_ENV === "production" ? "PROD" : "STAGE";
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local";
  const deployment = process.env.VERCEL_DEPLOYMENT_ID?.slice(0, 8);
  return deployment
    ? `${environment} • ${sha} • ${deployment}`
    : `${environment} • ${sha}`;
}
