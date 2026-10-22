import { NextRequest, NextResponse } from "next/server";
import { authorizeVintageRequest } from "@/lib/vintage/admin";
import { getKeyBracketByYear } from "@/lib/repositories/bracketRepository";
import { getLiveStandingsSnapshot } from "@/lib/repositories/liveStandingsSnapshotRepository";
import { getPublishedVintageStandingsContent } from "@/lib/vintage/standingsStore";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/**
 * GET /api/admin/vintage-standings/snapshot?year=YYYY
 * Snapshot freshness for Standings admin (year, computedAt, entry count, KEY id).
 */
export async function GET(request: NextRequest) {
  const auth = await authorizeVintageRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const paramYear = request.nextUrl.searchParams.get("year");
    let yearNum: number;
    if (paramYear && /^\d{4}$/.test(paramYear)) {
      yearNum = parseInt(paramYear, 10);
    } else {
      const copy = await getPublishedVintageStandingsContent();
      yearNum = parseInt(copy.standingsYear.trim(), 10);
      if (!Number.isFinite(yearNum)) {
        yearNum = new Date().getFullYear();
      }
    }

    const [snapshot, keyBracket] = await Promise.all([
      getLiveStandingsSnapshot(yearNum),
      getKeyBracketByYear(yearNum),
    ]);

    return NextResponse.json(
      {
        year: yearNum,
        exists: Boolean(snapshot),
        entryCount: snapshot?.standingsData.entries.length ?? 0,
        computedAt: snapshot?.computedAt.toISOString() ?? null,
        keyBracketId: snapshot?.keyBracketId ?? keyBracket?.id ?? null,
        keyExists: Boolean(keyBracket),
        keyUpdatedAt: keyBracket?.updatedAt?.toISOString?.() ?? null,
      },
      { headers },
    );
  } catch (error) {
    console.error("[GET /api/admin/vintage-standings/snapshot]", error);
    return NextResponse.json(
      { error: "Failed to load standings snapshot status." },
      { status: 500, headers },
    );
  }
}
