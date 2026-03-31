import { api } from "@convex/_generated/api";
import type { ConvexReactClient } from "convex/react";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export interface Attachment {
  storageId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export async function uploadFile(
  convex: ConvexReactClient,
  file: {
    uri: string;
    name: string;
    mimeType: string;
    size: number;
  },
): Promise<Attachment> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is 25 MB.`);
  }

  // Get upload URL from Convex
  const uploadUrl = await convex.mutation(api.files.generateUploadUrl);

  // Fetch the file as a blob
  const response = await fetch(file.uri);
  const blob = await response.blob();

  // Upload to Convex storage
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.mimeType },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error("File upload failed");
  }

  const { storageId } = await uploadResponse.json();

  return {
    storageId,
    filename: file.name,
    mimeType: file.mimeType,
    size: file.size,
  };
}
