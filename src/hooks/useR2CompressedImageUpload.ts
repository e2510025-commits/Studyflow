"use client";

import { useCallback, useState } from "react";
import imageCompression from "browser-image-compression";

type UploadResult = {
  fileUrl: string;
  key: string;
  contentType: string;
  bytes: number;
  originalBytes: number;
};

type PresignResponse = {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  headers?: Record<string, string>;
  maxBytes?: number;
};

const DEFAULT_MAX_BYTES = 300 * 1024;

export function useR2CompressedImageUpload(options?: { folder?: string }) {
  const [isUploading, setIsUploading] = useState(false);

  const compressAndUpload = useCallback(
    async (file: File): Promise<UploadResult> => {
      if (!file.type.startsWith("image/")) {
        throw new Error("画像ファイルを選択してください");
      }

      setIsUploading(true);
      try {
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.3,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          initialQuality: 0.8,
        });

        const contentType = compressed.type || "image/jpeg";

        const presignRes = await fetch("/api/uploads/r2/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: compressed.name || file.name,
            contentType,
            folder: options?.folder || "uploads",
            contentLength: compressed.size,
          }),
        });

        const presignData = (await presignRes.json().catch(() => ({}))) as PresignResponse & {
          error?: string;
        };

        if (!presignRes.ok || !presignData.uploadUrl || !presignData.fileUrl) {
          if (presignData.error === "image_too_large") {
            throw new Error("画像が300KB以下に収まりませんでした。別の画像を試してください。");
          }
          throw new Error("アップロード準備に失敗しました");
        }

        const maxBytes = Number(presignData.maxBytes || DEFAULT_MAX_BYTES);
        if (compressed.size > maxBytes) {
          throw new Error("画像が300KB以下に収まりませんでした。別の画像を試してください。");
        }

        const putRes = await fetch(presignData.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": contentType,
            ...(presignData.headers || {}),
          },
          body: compressed,
        });

        if (!putRes.ok) {
          throw new Error("画像アップロードに失敗しました");
        }

        return {
          fileUrl: presignData.fileUrl,
          key: presignData.key,
          contentType,
          bytes: compressed.size,
          originalBytes: file.size,
        };
      } finally {
        setIsUploading(false);
      }
    },
    [options?.folder]
  );

  return {
    isUploading,
    compressAndUpload,
  };
}
