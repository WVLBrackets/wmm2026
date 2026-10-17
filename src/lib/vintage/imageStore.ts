import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { put, del } from "@vercel/blob";

function neonStorage() {
  const endpoint = process.env.VINTAGE_S3_ENDPOINT;
  const region = process.env.VINTAGE_S3_REGION;
  const accessKeyId = process.env.VINTAGE_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.VINTAGE_S3_SECRET_ACCESS_KEY;
  const bucket = process.env.VINTAGE_S3_BUCKET;
  if (!endpoint || !region || !accessKeyId || !secretAccessKey || !bucket)
    return;
  const url = new URL(endpoint);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".neon.tech") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error("A dedicated Neon storage endpoint is required.");
  }
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket))
    throw new Error("Invalid image bucket.");
  return {
    bucket,
    endpoint: url.origin,
    client: new S3Client({
      endpoint: url.origin,
      region,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

export function hasVintageImageStorage(): boolean {
  return !!neonStorage() || !!process.env.VINTAGE_BLOB_READ_WRITE_TOKEN;
}

/** Uploaded keys are immutable. Credentials and bucket configuration stay server-side. */
export async function uploadVintageImage(
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<{ url: string; remove: () => Promise<void> }> {
  const storage = neonStorage();
  if (storage) {
    await storage.client.send(
      new PutObjectCommand({
        Bucket: storage.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return {
      url: `${storage.endpoint}/${storage.bucket}/${key}`,
      remove: async () => {
        await storage.client.send(
          new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }),
        );
      },
    };
  }
  const token = process.env.VINTAGE_BLOB_READ_WRITE_TOKEN;
  if (!token)
    throw new Error("Dedicated vintage image storage is not configured.");
  const blob = await put(key, bytes, {
    access: "public",
    token,
    contentType,
    addRandomSuffix: false,
  });
  return {
    url: blob.url,
    remove: async () => {
      await del(blob.url, { token });
    },
  };
}
