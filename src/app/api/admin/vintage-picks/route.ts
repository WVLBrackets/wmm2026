import { NextRequest, NextResponse } from "next/server";
import { authorizeVintageRequest } from "@/lib/vintage/admin";
import {
  hasVintagePicksDatabase,
  readVintagePicksState,
  writeVintagePicksContent,
} from "@/lib/vintage/picksStore";
import {
  normalizeVintagePicksContent,
  validateVintagePicksContent,
} from "@/lib/vintage/picksContent";
import { vintageStorageError } from "@/lib/vintage/storageError";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  const auth = await authorizeVintageRequest(request);
  if (auth instanceof Response) return auth;
  try {
    return NextResponse.json(
      {
        state: await readVintagePicksState(),
        storageReady: hasVintagePicksDatabase(),
      },
      { headers },
    );
  } catch (error) {
    const diagnostic = vintageStorageError(error);
    console.error("[Vintage Picks] Editor storage read failed:", diagnostic.code);
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
      !["save", "publish", "restore"].includes(input.action) ||
      !Number.isSafeInteger(input.version) ||
      input.version < 0
    )
      throw new Error("Invalid action or version.");
    if (input.action === "restore") {
      if (
        typeof input.revisionId !== "string" ||
        !/^[a-f0-9-]{36}$/i.test(input.revisionId)
      )
        throw new Error("Invalid revision.");
    } else {
      input.content = normalizeVintagePicksContent(input.content);
      validateVintagePicksContent(input.content);
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid content." },
      { status: 400, headers },
    );
  }
  if (!hasVintagePicksDatabase())
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
        state: await writeVintagePicksContent(input, auth.email),
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
    console.error("[Vintage Picks] Editor storage write failed:", diagnostic.code);
    return NextResponse.json(diagnostic, { status: 503, headers });
  }
}
