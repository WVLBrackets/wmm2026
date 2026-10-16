import test from "node:test";
import assert from "node:assert/strict";
import { vintageStorageError } from "../src/lib/vintage/storageError";

test("editor storage diagnostics identify failures without exposing database secrets", () => {
  const secret =
    "postgres://private-user:private-password@private-host/private-database";
  for (const [providerCode, expected] of [
    ["28P01", "DATABASE_AUTH_FAILED"],
    ["42P01", "DATABASE_SCHEMA_MISSING"],
    ["3D000", "DATABASE_NOT_FOUND"],
    ["42501", "DATABASE_PERMISSION_DENIED"],
    ["ERR_INVALID_URL", "DATABASE_CONFIGURATION_INVALID"],
    ["CERT_HAS_EXPIRED", "DATABASE_TLS_FAILED"],
    ["ENOTFOUND", "DATABASE_CONNECTION_FAILED"],
    ["UNKNOWN", "STORAGE_READ_FAILED"],
  ]) {
    const failure = Object.assign(new Error(secret), { code: providerCode });
    const safe = vintageStorageError(failure);
    assert.equal(safe.code, expected);
    assert.equal(JSON.stringify(safe).includes(secret), false);
    assert.equal(JSON.stringify(safe).includes("private-password"), false);
  }
  assert.equal(
    vintageStorageError(
      new Error(
        "Vintage requires its own database, separate from the bracket database.",
      ),
    ).code,
    "DATABASE_ISOLATION_BLOCKED",
  );
});
