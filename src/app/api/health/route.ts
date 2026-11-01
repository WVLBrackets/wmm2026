import { NextResponse } from "next/server";
import { sql } from "@/lib/databaseAdapter";
import { assertProductionEnv } from "@/lib/env";
import { getPublishedCmsBundle } from "@/lib/vintage/cmsBundle";

/**
 * Uptime check: env (prod), database ping, published CMS read.
 */
export async function GET() {
  try {
    assertProductionEnv();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "env" },
      { status: 500 },
    );
  }

  try {
    await sql`SELECT 1`;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: `database: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 503 },
    );
  }

  try {
    const bundle = await getPublishedCmsBundle();
    return NextResponse.json({
      ok: true,
      year: bundle.home.tournament.year,
      siteName: bundle.home.keyData.siteName,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: `cms: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 503 },
    );
  }
}
