/** Reject reuse of a known bracket database, including credentials/query-string variants. */
export function assertDedicatedVintageDatabase(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!url) throw new Error("VINTAGE_DATABASE_URL is required.");
  const identity = (value: string): string => {
    const parsed = new URL(value);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol))
      throw new Error("A Postgres connection URL is required.");
    return `${parsed.hostname.replace("-pooler.", ".")}:${parsed.port || "5432"}${decodeURIComponent(parsed.pathname)}`;
  };
  const target = identity(url);
  for (const key of [
    "POSTGRES_URL",
    "PRODUCTION_POSTGRES_URL",
    "PREVIEW_POSTGRES_URL",
    "LOCAL_POSTGRES_URL",
    "POSTGRES_URL_LOCAL",
  ]) {
    const other = env[key];
    if (other && identity(other) === target)
      throw new Error(
        "Vintage requires its own database, separate from the bracket database.",
      );
  }
}
