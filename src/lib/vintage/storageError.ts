/** Safe diagnostics for authenticated editor responses. Never return raw driver messages. */
export function vintageStorageError(error: unknown): {
  code: string;
  error: string;
} {
  const raw =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  const message = error instanceof Error ? error.message : "";
  let code = "STORAGE_READ_FAILED";
  let detail = "The editor could not read its dedicated database.";
  if (raw === "28P01" || raw === "28000") {
    code = "DATABASE_AUTH_FAILED";
    detail = "The Preview database credentials were rejected.";
  } else if (raw === "42P01" || raw === "3F000") {
    code = "DATABASE_SCHEMA_MISSING";
    detail = "The Preview connection is missing the vintage content tables.";
  } else if (raw === "3D000") {
    code = "DATABASE_NOT_FOUND";
    detail = "The configured vintage database does not exist on this endpoint.";
  } else if (raw === "42501") {
    code = "DATABASE_PERMISSION_DENIED";
    detail =
      "The Preview database role cannot read the vintage content tables.";
  } else if (
    raw === "ERR_INVALID_URL" ||
    /Postgres connection URL|VINTAGE_DATABASE_URL is required|Set VINTAGE_DATABASE_URL/.test(
      message,
    )
  ) {
    code = "DATABASE_CONFIGURATION_INVALID";
    detail = "A database connection setting in this deployment is invalid.";
  } else if (/Vintage requires its own database/.test(message)) {
    code = "DATABASE_ISOLATION_BLOCKED";
    detail = "The safety check prevented use of a bracket database.";
  } else if (/CERT|TLS|SSL/.test(raw) || /certificate|TLS|SSL/i.test(message)) {
    code = "DATABASE_TLS_FAILED";
    detail = "The secure connection to the vintage database failed.";
  } else if (
    [
      "ENOTFOUND",
      "EAI_AGAIN",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "ECONNRESET",
    ].includes(raw) ||
    /timeout|timed out/i.test(message)
  ) {
    code = "DATABASE_CONNECTION_FAILED";
    detail = "The deployed editor could not reach the vintage database.";
  }
  return { code, error: `${detail} Reference: ${code}.` };
}
