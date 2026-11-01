import { NextRequest, NextResponse } from "next/server";
import { authorizeVintageRequest } from "@/lib/vintage/admin";
import { hasVintageDatabase } from "@/lib/vintage/dbPool";
import type { SidecarSlot } from "@/lib/vintage/homepageDocument";
import { SIDECAR_CODECS } from "@/lib/vintage/sidecarPreserve";
import {
  readVintageSectionState,
  writeVintageSection,
} from "@/lib/vintage/sectionStore";
import { vintageStorageError } from "@/lib/vintage/storageError";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

const COPY_SLOTS = ["emails", "bracketEditor", "scoreboard"] as const;
type CopySlot = (typeof COPY_SLOTS)[number];

/**
 * Parse `?slot=` for the generic copy-tree sidecars.
 *
 * @param request - Incoming request
 */
function parseSlot(request: NextRequest): CopySlot | null {
  const slot = request.nextUrl.searchParams.get("slot");
  return COPY_SLOTS.includes(slot as CopySlot) ? (slot as CopySlot) : null;
}

export async function GET(request: NextRequest) {
  const auth = await authorizeVintageRequest(request);
  if (auth instanceof Response) return auth;
  const slot = parseSlot(request);
  if (!slot) {
    return NextResponse.json({ error: "Unknown CMS section." }, { status: 400, headers });
  }
  try {
    return NextResponse.json(
      {
        state: await readVintageSectionState(slot),
        storageReady: hasVintageDatabase(),
        slot,
      },
      { headers },
    );
  } catch (error) {
    const diagnostic = vintageStorageError(error);
    console.error("[Vintage sidecar] Editor storage read failed:", diagnostic.code);
    return NextResponse.json(diagnostic, { status: 503, headers });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorizeVintageRequest(request);
  if (auth instanceof Response) return auth;
  const slot = parseSlot(request);
  if (!slot) {
    return NextResponse.json({ error: "Unknown CMS section." }, { status: 400, headers });
  }
  const text = await request.text();
  if (Buffer.byteLength(text) > 200000) {
    return NextResponse.json({ error: "Content is too large." }, { status: 413, headers });
  }
  let input: { action: string; version: number; content: unknown };
  try {
    input = JSON.parse(text);
    if (
      !input ||
      !["save", "publish"].includes(input.action) ||
      !Number.isSafeInteger(input.version) ||
      input.version < 0
    ) {
      throw new Error("Invalid action or version.");
    }
    const codec = SIDECAR_CODECS[slot as SidecarSlot];
    input.content = codec.normalize(input.content);
    codec.validate(input.content as never);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid content." },
      { status: 400, headers },
    );
  }
  if (!hasVintageDatabase()) {
    return NextResponse.json(
      {
        error:
          "Dedicated vintage storage is not configured. Your edits have not been saved.",
      },
      { status: 503, headers },
    );
  }
  try {
    return NextResponse.json(
      {
        state: await writeVintageSection(slot, {
          action: input.action as "save" | "publish",
          version: input.version,
          content: input.content as never,
        }),
        storageReady: true,
        slot,
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
    console.error("[Vintage sidecar] Editor storage write failed:", diagnostic.code);
    return NextResponse.json(diagnostic, { status: 503, headers });
  }
}
