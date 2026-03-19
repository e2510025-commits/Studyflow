import { NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { resolveSessionUser } from "@/lib/server/sessionUser";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 300 * 1024;

function readEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function detectExtension(contentType: string, fileName: string) {
  const byMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
  };
  const mimeExt = byMime[contentType.toLowerCase()];
  if (mimeExt) return mimeExt;

  const fromName = fileName.split(".").pop()?.toLowerCase() || "";
  if (/^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  return "jpg";
}

function sanitizeFolder(input: string) {
  const cleaned = input.trim().toLowerCase().replace(/[^a-z0-9/_-]/g, "").replace(/\.{2,}/g, "");
  return cleaned || "uploads";
}

export async function POST(request: Request) {
  try {
    const user = await resolveSessionUser();
    if (!user?.uid) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      fileName?: string;
      contentType?: string;
      folder?: string;
      contentLength?: number;
    };

    const fileName = String(body.fileName || "image").slice(0, 120);
    const contentType = String(body.contentType || "").toLowerCase();
    const folder = sanitizeFolder(String(body.folder || "uploads"));
    const contentLength = Number(body.contentLength || 0);

    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "invalid_content_type" }, { status: 400 });
    }

    if (contentLength <= 0 || contentLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "image_too_large", maxBytes: MAX_IMAGE_BYTES }, { status: 400 });
    }

    const accountId = readEnv("R2_ACCOUNT_ID");
    const accessKeyId = readEnv("R2_ACCESS_KEY_ID");
    const secretAccessKey = readEnv("R2_SECRET_ACCESS_KEY");
    const bucket = readEnv("R2_BUCKET");
    const publicBaseUrl = readEnv("R2_PUBLIC_BASE_URL").replace(/\/$/, "");

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const safeUid = user.uid.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "anon";
    const ext = detectExtension(contentType, fileName);
    const key = `${folder}/${safeUid}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });
    const fileUrl = `${publicBaseUrl}/${key}`;

    return NextResponse.json({
      uploadUrl,
      fileUrl,
      key,
      headers: {
        "Content-Type": contentType,
      },
      maxBytes: MAX_IMAGE_BYTES,
    });
  } catch (error) {
    console.error("r2 presign error:", error);
    return NextResponse.json({ error: "failed_to_presign" }, { status: 500 });
  }
}
