import { NextRequest, NextResponse } from "next/server";
import { authorizeVintageRequest } from "@/lib/vintage/admin";
import { getKeyBracketByYear } from "@/lib/repositories/bracketRepository";
import { getLiveStandingsSnapshot } from "@/lib/repositories/liveStandingsSnapshotRepository";
import { recomputeLiveStandingsAfterKeySave } from "@/lib/liveStandingsService";
import { getPublishedVintageStandingsContent } from "@/lib/vintage/standingsStore";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/**
 * POST /api/admin/vintage-standings/recompute
 * Rebuild the live standings snapshot for a year from KEY + submitted brackets.
 * Body: `{ year?: number }` — defaults to CMS Standings Year.
 */
export async function POST(request: NextRequest) {
  const auth = await authorizeVintageRequest(request);
  if (auth instanceof Response) return auth;

  try {
    let yearNum: number | null = null;
    const text = await request.text();
    if (text.trim()) {
      const body = JSON.parse(text) as { year?: unknown };
      if (body.year != null) {
        const n =
          typeof body.year === "number"
            ? body.year
            : parseInt(String(body.year).trim(), 10);
        if (!Number.isFinite(n) || !/^\d{4}$/.test(String(n))) {
          return NextResponse.json(
            { error: "Year must be a four-digit number." },
            { status: 400, headers },
          );
        }
        yearNum = n;
      }
    }

    if (yearNum == null) {
      const copy = await getPublishedVintageStandingsContent();
      yearNum = parseInt(copy.standingsYear.trim(), 10);
      if (!Number.isFinite(yearNum)) {
        yearNum = new Date().getFullYear();
      }
    }

    const keyBracket = await getKeyBracketByYear(yearNum);
    if (!keyBracket) {
      return NextResponse.json(
        {
          error: `No KEY bracket for ${yearNum}. Create/save KEY results before regenerating standings.`,
        },
        { status: 404, headers },
      );
    }

    const result = await recomputeLiveStandingsAfterKeySave(
      yearNum,
      keyBracket.id,
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Standings recompute failed." },
        { status: 500, headers },
      );
    }

    const snapshot = await getLiveStandingsSnapshot(yearNum);
    return NextResponse.json(
      {
        success: true,
        year: yearNum,
        entryCount: snapshot?.standingsData.entries.length ?? 0,
        computedAt: snapshot?.computedAt.toISOString() ?? null,
        keyBracketId: keyBracket.id,
      },
      { headers },
    );
  } catch (error) {
    console.error("[POST /api/admin/vintage-standings/recompute]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to regenerate standings snapshot.",
      },
      { status: 500, headers },
    );
  }
}
