/** Vintage V1 is deliberately unavailable in production. */
export function isVintageEnabled(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  return (
    process.env.NODE_ENV === "development" ||
    (process.env.VERCEL_ENV === "preview" &&
      process.env.VINTAGE_HOMEPAGE_ENABLED === "true")
  );
}
