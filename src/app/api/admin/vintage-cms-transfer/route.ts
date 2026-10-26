import { NextRequest, NextResponse } from "next/server";
import { authorizeVintageRequest } from "@/lib/vintage/admin";
import { hasVintageDatabase } from "@/lib/vintage/dbPool";
import {
  applyVintageCmsTransfer,
  exportVintageCmsTransferBundle,
  previewVintageCmsTransfer,
} from "@/lib/vintage/cmsTransferStore";
import { vintageStorageError } from "@/lib/vintage/storageError";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

/** CMS packages can include every desk — allow up to 1 MB. */
const MAX_BODY_BYTES = 1_000_000;

/**
 * Export the current environment’s full vintage CMS package (draft + published).
 */
export async function GET(request: NextRequest) {
  const auth = await authorizeVintageRequest(request);
  if (auth instanceof Response) return auth;
  try {
    if (!hasVintageDatabase()) {
      return NextResponse.json(
        {
          error:
            "Dedicated vintage storage is not configured. Nothing to export.",
        },
        { status: 503, headers },
      );
    }
    const sourceLabel =
      request.nextUrl.searchParams.get("label")?.trim() || undefined;
    const bundle = await exportVintageCmsTransferBundle(sourceLabel);
    return NextResponse.json(
      { bundle, storageReady: true },
      { headers },
    );
  } catch (error) {
    const diagnostic = vintageStorageError(error);
    console.error("[Vintage] CMS export failed:", diagnostic.code);
    return NextResponse.json(diagnostic, { status: 503, headers });
  }
}

/**
 * Preview (diff) or apply a CMS transfer package.
 * Body: `{ action: "preview" | "apply", bundle, version?, expectedChangeCount? }`
 */
export async function POST(request: NextRequest) {
  const auth = await authorizeVintageRequest(request);
  if (auth instanceof Response) return auth;

  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "CMS package is too large (max 1 MB)." },
      { status: 413, headers },
    );
  }

  let input: {
    action?: string;
    bundle?: unknown;
    version?: number;
    expectedChangeCount?: number;
  };
  try {
    input = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers },
    );
  }

  if (!input || (input.action !== "preview" && input.action !== "apply")) {
    return NextResponse.json(
      { error: 'Action must be "preview" or "apply".' },
      { status: 400, headers },
    );
  }

  try {
    if (input.action === "preview") {
      if (!hasVintageDatabase()) {
        return NextResponse.json(
          {
            error:
              "Dedicated vintage storage is not configured. Cannot compare import.",
          },
          { status: 503, headers },
        );
      }
      const preview = await previewVintageCmsTransfer(input.bundle);
      return NextResponse.json(
        {
          version: preview.version,
          changes: preview.changes,
          summary: preview.summary,
          bundle: preview.bundle,
          storageReady: true,
        },
        { headers },
      );
    }

    if (
      !Number.isSafeInteger(input.version) ||
      (input.version ?? -1) < 0 ||
      !Number.isSafeInteger(input.expectedChangeCount) ||
      (input.expectedChangeCount ?? -1) < 0
    ) {
      return NextResponse.json(
        { error: "Apply requires version and expectedChangeCount." },
        { status: 400, headers },
      );
    }

    const result = await applyVintageCmsTransfer({
      version: input.version!,
      bundle: input.bundle,
      expectedChangeCount: input.expectedChangeCount!,
    });
    return NextResponse.json(
      {
        version: result.version,
        appliedChanges: result.appliedChanges,
        storageReady: true,
      },
      { headers },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    if (message === "CONFLICT") {
      return NextResponse.json(
        {
          error:
            "Someone else saved first. Reload and review the import again.",
        },
        { status: 409, headers },
      );
    }
    if (
      message.startsWith("CMS package") ||
      message.startsWith("Unsupported") ||
      message.includes("missing") ||
      message.includes("kind must") ||
      message.includes("changed since the preview") ||
      message.includes("schemaVersion")
    ) {
      return NextResponse.json({ error: message }, { status: 400, headers });
    }
    const diagnostic = vintageStorageError(error);
    console.error("[Vintage] CMS import failed:", diagnostic.code);
    return NextResponse.json(
      { ...diagnostic, error: message || diagnostic.error },
      { status: 503, headers },
    );
  }
}
