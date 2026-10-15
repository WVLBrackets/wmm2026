import { NextRequest, NextResponse } from "next/server";
import { authorizeVintageRequest } from "@/lib/vintage/admin";
import {
  hasVintageDatabase,
  readVintageState,
  writeVintageContent,
} from "@/lib/vintage/store";
import { validateVintageContent } from "@/lib/vintage/content";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: NextRequest) {
  const auth = await authorizeVintageRequest(request);
  if (auth instanceof Response) return auth;
  try {
    return NextResponse.json(
      { state: await readVintageState(), storageReady: hasVintageDatabase() },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Vintage storage is unavailable. Check the dedicated database and schema.",
      },
      { status: 503, headers },
    );
  }
}
export async function POST(request: NextRequest) {
  const auth = await authorizeVintageRequest(request);
  if (auth instanceof Response) return auth;
  // Bound the body before parsing; Content-Length alone is not trusted.
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
    } else validateVintageContent(input.content);
    if (
      input.action === "publish" &&
      input.content.downloads.some((item: { href: string }) => !item.href)
    )
      throw new Error(
        "Configure both existing Excel download URLs before publishing.",
      );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid content." },
      { status: 400, headers },
    );
  }
  if (!hasVintageDatabase())
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
        state: await writeVintageContent(input, auth.email),
        storageReady: true,
      },
      { headers },
    );
  } catch (error) {
    const conflict = error instanceof Error && error.message === "CONFLICT";
    return NextResponse.json(
      {
        error: conflict
          ? "Someone saved a newer revision. Reload before saving again."
          : "Unable to save. Check the vintage database and schema.",
      },
      { status: conflict ? 409 : 503, headers },
    );
  }
}
