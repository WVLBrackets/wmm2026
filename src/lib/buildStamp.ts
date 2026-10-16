import { getAppEnvironment } from "@/lib/appEnvironment";

export function getBuildStamp(): string {
  const appEnvironment = getAppEnvironment();
  const environment = appEnvironment === "production"
    ? "PROD" : appEnvironment === "local" ? "LOCAL" : "STAGE";
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local";
  const deployment = process.env.VERCEL_DEPLOYMENT_ID?.slice(0, 8);
  return deployment
    ? `${environment} • ${sha} • ${deployment}`
    : `${environment} • ${sha}`;
}
