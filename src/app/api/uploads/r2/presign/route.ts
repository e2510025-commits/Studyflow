import { NextResponse } from "next/server";
import { resolveSessionUser } from "@/lib/server/sessionUser";

export const runtime = "edge";

const MAX_IMAGE_BYTES = 300 * 1024;
const PRESIGN_EXPIRES_SECONDS = 60;

function toAmzDateParts(date: Date) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeKeyPath(key: string) {
  return key.split("/").map(encodeRfc3986).join("/");
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(input: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return bytesToHex(new Uint8Array(hash));
}

async function hmacSha256Raw(key: Uint8Array | string, data: string) {
  const rawKey = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const keyBuffer = Uint8Array.from(rawKey).buffer;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(signature);
}

async function createR2PresignedPutUrl(params: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  key: string;
  expiresSeconds: number;
}) {
  const { accountId, accessKeyId, secretAccessKey, bucket, key, expiresSeconds } = params;
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const region = "auto";
  const service = "s3";
  const method = "PUT";
  const now = new Date();
  const { amzDate, dateStamp } = toAmzDateParts(now);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalUri = `/${encodeRfc3986(bucket)}/${encodeKeyPath(key)}`;

  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": "host",
  });

  const canonicalQueryString = query
    .toString()
    .split("&")
    .sort()
    .join("&");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    `host:${host}`,
    "",
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = await hmacSha256Raw(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = await hmacSha256Raw(kDate, region);
  const kService = await hmacSha256Raw(kRegion, service);
  const kSigning = await hmacSha256Raw(kService, "aws4_request");
  const signature = bytesToHex(await hmacSha256Raw(kSigning, stringToSign));

  return `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

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

    const safeUid = user.uid.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "anon";
    const ext = detectExtension(contentType, fileName);
    const key = `${folder}/${safeUid}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const uploadUrl = await createR2PresignedPutUrl({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      key,
      expiresSeconds: PRESIGN_EXPIRES_SECONDS,
    });
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
