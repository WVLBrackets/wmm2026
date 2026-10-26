import { NextRequest, NextResponse } from "next/server";
import { authorizeVintageRequest } from "@/lib/vintage/admin";
import {
  hasVintageStandingsDatabase,
  readVintageStandingsState,
  writeVintageStandingsContent,
} from "@/lib/vintage/standingsStore";
import {
  normalizeVintageStandingsContent,
  validateVintageStandingsContent,
} from "@/lib/vintage/standingsContent";
import { vintageStorageError } from "@/lib/vintage/storageError";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  const auth = await authorizeVintageRequest(request);
  if (auth instanceof Response) return auth;
  try {
    return NextResponse.json(
      {
        state: await readVintageStandingsState(),
        storageReady: hasVintageStandingsDatabase(),
      },
      { headers },
    );
  } catch (error) {
    const diagnostic = vintageStorageError(error);
    console.error(
      "[Vintage Standings] Editor storage read failed:",
      diagnostic.code,
    );
    return NextResponse.json(diagnostic, { status: 503, headers });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorizeVintageRequest(request);
  if (auth instanceof Response) return auth;
  const text = await request.text();
  if (Buffer.byteLength(text) > 100000)
    return NextResponse.json(
      { error: "Content is too large." },
      { status: 413, headers },
    );
  let input;
  try {
    input = JSON.parse(text);
    if (
      !input ||
      !["save", "publish"].includes(input.action) ||
      !Number.isSafeInteger(input.version) ||
      input.version < 0
    )
      throw new Error("Invalid action or version.");
    input.content = normalizeVintageStandingsContent(input.content);
    validateVintageStandingsContent(input.content);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid content." },
      { status: 400, headers },
    );
  }
  if (!hasVintageStandingsDatabase())
    return NextResponse.json(
      {
        error:
          "Dedicated vintage storage is not configured. Your edits have not been saved.",
      },
      { status: 503, headers },
    );
  try {
    return NextResponse.json(
      {
        state: await writeVintageStandingsContent(input, auth.email),
        storageReady: true,
      },
      { headers },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "CONFLICT") {
      return NextResponse.json(
        { error: "Someone else saved first. Reload and try again." },
        { status: 409, headers },
      );
    }
    const diagnostic = vintageStorageError(error);
    console.error(
      "[Vintage Standings] Editor storage write failed:",
      diagnostic.code,
    );
    return NextResponse.json(diagnostic, { status: 503, headers });
  }
}
