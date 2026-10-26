import { NextRequest, NextResponse } from "next/server";
import { authorizeVintageRequest } from "@/lib/vintage/admin";
import {
  hasVintageInfoDatabase,
  readVintageInfoState,
  writeVintageInfoContent,
} from "@/lib/vintage/infoStore";
import {
  normalizeVintageInfoContent,
  validateVintageInfoContent,
} from "@/lib/vintage/infoContent";
import { vintageStorageError } from "@/lib/vintage/storageError";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  const auth = await authorizeVintageRequest(request);
  if (auth instanceof Response) return auth;
  try {
    return NextResponse.json(
      {
        state: await readVintageInfoState(),
        storageReady: hasVintageInfoDatabase(),
      },
      { headers },
    );
  } catch (error) {
    const diagnostic = vintageStorageError(error);
    console.error("[Vintage Info] Editor storage read failed:", diagnostic.code);
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
    input.content = normalizeVintageInfoContent(input.content);
    validateVintageInfoContent(input.content);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid content." },
      { status: 400, headers },
    );
  }
  if (!hasVintageInfoDatabase())
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
        state: await writeVintageInfoContent(input, auth.email),
        storageReady: true,
      },
      { headers },
    );
  } catch (error) {
    const conflict = error instanceof Error && error.message === "CONFLICT";
    return NextResponse.json(
      {
        error: conflict
          ? "Someone else saved first. Reload before saving again."
          : "Unable to save. Check the vintage database and schema.",
      },
      { status: conflict ? 409 : 503, headers },
    );
  }
}
