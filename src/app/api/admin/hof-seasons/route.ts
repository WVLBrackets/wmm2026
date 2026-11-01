import { NextRequest, NextResponse } from "next/server";
import { authorizeVintageRequest } from "@/lib/vintage/admin";
import {
  deleteHofSeason,
  listHofSeasons,
  upsertHofSeason,
} from "@/lib/repositories/hofSeasonRepository";
import type { HallOfFameEntry } from "@/lib/hallOfFameStats";

/**
 * GET /api/admin/hof-seasons — list podium history.
 */
export async function GET(request: NextRequest) {
  const auth = await authorizeVintageRequest(request);
  if (auth instanceof Response) return auth;
  const seasons = await listHofSeasons();
  return NextResponse.json({ success: true, data: seasons });
}

/**
 * PUT /api/admin/hof-seasons — insert or replace one year.
 */
export async function PUT(request: NextRequest) {
  const auth = await authorizeVintageRequest(request);
  if (auth instanceof Response) return auth;
  const body = (await request.json()) as HallOfFameEntry;
  if (!body?.year?.trim()) {
    return NextResponse.json({ success: false, error: "Year is required." }, { status: 400 });
  }
  await upsertHofSeason({
    year: body.year.trim(),
    firstPlace: {
      name: body.firstPlace?.name ?? "",
      team: body.firstPlace?.team ?? "",
      score: Number(body.firstPlace?.score) || 0,
    },
    secondPlace: {
      name: body.secondPlace?.name ?? "",
      score: Number(body.secondPlace?.score) || 0,
    },
    thirdPlace: {
      name: body.thirdPlace?.name ?? "",
      score: Number(body.thirdPlace?.score) || 0,
    },
    totalEntries: Number(body.totalEntries) || 0,
  });
  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/admin/hof-seasons?year=YYYY
 */
export async function DELETE(request: NextRequest) {
  const auth = await authorizeVintageRequest(request);
  if (auth instanceof Response) return auth;
  const year = new URL(request.url).searchParams.get("year")?.trim() ?? "";
  if (!year) {
    return NextResponse.json({ success: false, error: "Year is required." }, { status: 400 });
  }
  await deleteHofSeason(year);
  return NextResponse.json({ success: true });
}
