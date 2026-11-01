import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/adminAuth";
import { authorizeVintageRequest } from "@/lib/vintage/admin";
import { hasVintageDatabase, getVintageDbPool } from "@/lib/vintage/dbPool";
import { completeVintageCmsSections } from "@/lib/vintage/store";
import { CMS_SCHEMA_KEY } from "@/lib/vintage/homepageDocument";
import { vintageStorageError } from "@/lib/vintage/storageError";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/**
 * Read published `__cmsSchema` after migrate.
 */
async function readPublishedSchema(): Promise<number> {
  const result = await getVintageDbPool().query(
    "SELECT published FROM vintage_homepage WHERE id = 1",
  );
  const published = result.rows[0]?.published;
  if (!published || typeof published !== "object") return 0;
  return Number((published as Record<string, unknown>)[CMS_SCHEMA_KEY]) || 0;
}

/**
 * Stamp draft + published CMS as schema v2 (idempotent).
 * Required once per environment after the CMS v2 code deploy.
 */
async function runComplete(): Promise<NextResponse> {
  if (!hasVintageDatabase()) {
    return NextResponse.json(
      { success: false, error: "Vintage CMS database is not configured." },
      { status: 503, headers },
    );
  }
  const version = await completeVintageCmsSections();
  const schema = await readPublishedSchema();
  if (schema < 2) {
    return NextResponse.json(
      {
        success: false,
        error: "Migration ran but published schema is still below 2.",
        version,
        schema,
      },
      { status: 500, headers },
    );
  }
  return NextResponse.json(
    {
      success: true,
      message: "CMS sections completed. Public site should load now.",
      version,
      schema,
    },
    { headers },
  );
}

/**
 * GET — emergency one-click for a signed-in admin (no CSRF).
 * Open `/api/admin/vintage-cms-complete` in the browser after signing in.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json(
        { success: false, error: "Admin access required. Sign in first." },
        { status: 403, headers },
      );
    }
    return await runComplete();
  } catch (error) {
    console.error("[vintage-cms-complete GET]", error);
    return NextResponse.json(vintageStorageError(error), {
      status: 503,
      headers,
    });
  }
}

/**
 * POST — same migrate with full vintage admin CSRF + rate limit.
 */
export async function POST(request: NextRequest) {
  const auth = await authorizeVintageRequest(request);
  if (auth instanceof Response) return auth;
  try {
    return await runComplete();
  } catch (error) {
    console.error("[vintage-cms-complete POST]", error);
    return NextResponse.json(vintageStorageError(error), {
      status: 503,
      headers,
    });
  }
}
