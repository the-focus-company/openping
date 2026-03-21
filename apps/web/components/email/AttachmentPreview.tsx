"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  File,
  Image,
  FileText,
  Download,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Attachment {
  filename: string;
  mimeType: string;
  size: number;
  externalAttachmentId: string;
  storageId?: Id<"_storage">;
}

interface AttachmentPreviewProps {
  emailId: Id<"emails">;
  attachments: Attachment[];
  className?: string;
}

export function AttachmentPreview({
  emailId,
  attachments,
  className,
}: AttachmentPreviewProps) {
  if (!attachments.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {attachments.map((attachment) => (
        <AttachmentItem
          key={attachment.externalAttachmentId}
          emailId={emailId}
          attachment={attachment}
        />
      ))}
    </div>
  );
}

function AttachmentItem({
  emailId,
  attachment,
}: {
  emailId: Id<"emails">;
  attachment: Attachment;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadAttachment = useAction(api.emailSync.downloadAttachment);

  const Icon = getFileIcon(attachment.mimeType);

  const handleDownload = async () => {
    if (attachment.storageId) {
      // Already downloaded — could use Convex storage URL
      return;
    }

    setIsDownloading(true);
    try {
      await downloadAttachment({
        emailId,
        externalAttachmentId: attachment.externalAttachmentId,
      });
    } catch (error) {
      console.error("Failed to download attachment:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isDownloading}
      className={cn(
        "group flex items-center gap-2 rounded-md border border-subtle bg-surface-1 px-3 py-2",
        "transition-colors hover:bg-surface-2",
        "disabled:opacity-50",
      )}
    >
      {isDownloading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 text-left">
        <p className="max-w-[140px] truncate text-xs font-medium text-foreground">
          {attachment.filename}
        </p>
        <p className="text-2xs text-muted-foreground">
          {formatFileSize(attachment.size)}
        </p>
      </div>
      {!isDownloading && (
        <Download className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("text")
  )
    return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
