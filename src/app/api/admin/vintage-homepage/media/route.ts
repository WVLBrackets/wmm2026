import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  hasVintageImageStorage,
  uploadVintageImage,
} from "@/lib/vintage/imageStore";
import { authorizeVintageRequest } from "@/lib/vintage/admin";
import { listVintageMedia, mediaDatabase } from "@/lib/vintage/media";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: NextRequest) {
  const auth = await authorizeVintageRequest(request);
  if (auth instanceof Response) return auth;
  try {
    return NextResponse.json({ media: await listVintageMedia() }, { headers });
  } catch {
    return NextResponse.json(
      { error: "Media library storage is unavailable." },
      { status: 503, headers },
    );
  }
}
export async function POST(request: NextRequest) {
  const auth = await authorizeVintageRequest(request);
  if (auth instanceof Response) return auth;
  let imageStorageReady = false;
  try {
    imageStorageReady = hasVintageImageStorage();
  } catch {
    // Invalid configuration must return a safe storage error, not an unhandled 500.
  }
  if (!imageStorageReady)
    return NextResponse.json(
      { error: "Dedicated vintage image storage is not configured." },
      { status: 503, headers },
    );
  // 3 MB keeps the multipart body below Vercel's request-size limit.
  const length = Number(request.headers.get("content-length"));
  if (length > 3500000)
    return NextResponse.json(
      { error: "Images must be under 3 MB." },
      { status: 413, headers },
    );
  let file: File;
  let alt: string;
  try {
    const form = await request.formData();
    const candidate = form.get("file");
    alt = String(form.get("alt") || "").trim();
    if (
      !(candidate instanceof File) ||
      !candidate.size ||
      candidate.size > 3000000 ||
      !alt ||
      alt.length > 500
    )
      throw new Error("Choose an image under 3 MB and provide alt text.");
    file = candidate;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid upload." },
      { status: 400, headers },
    );
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp =
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP";
  const type = isJpeg
    ? "image/jpeg"
    : isPng
      ? "image/png"
      : isWebp
        ? "image/webp"
        : "";
  if (!type || file.type !== type)
    return NextResponse.json(
      { error: "Only JPEG, PNG and WebP images are supported." },
      { status: 400, headers },
    );
  let uploaded: Awaited<ReturnType<typeof uploadVintageImage>> | undefined;
  let pool;
  try {
    pool = await mediaDatabase();
    const id = randomUUID();
    const extension = isJpeg ? "jpg" : isPng ? "png" : "webp";
    uploaded = await uploadVintageImage(
      `vintage/${id}.${extension}`,
      bytes,
      type,
    );
    const filename =
      file.name.replace(/[^a-zA-Z0-9._ -]/g, "").slice(0, 160) ||
      `image.${extension}`;
    await pool.query(
      "INSERT INTO vintage_homepage_media (id, url, filename, alt, author) VALUES ($1,$2,$3,$4,$5)",
      [id, uploaded.url, filename, alt, auth.email],
    );
    return NextResponse.json(
      { media: { id, url: uploaded.url, filename, alt } },
      { status: 201, headers },
    );
  } catch {
    if (uploaded) await uploaded.remove().catch(() => undefined);
    return NextResponse.json(
      { error: "Image upload failed. Check dedicated vintage storage." },
      { status: 503, headers },
    );
  } finally {
    if (pool) await pool.end();
  }
}
