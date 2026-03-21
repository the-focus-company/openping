"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  FileIcon,
  Download,
  ImageIcon,
  FileText,
  FileSpreadsheet,
  FileArchive,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize, isImageType } from "@/lib/file-utils";

export interface Attachment {
  storageId: string;
  filename: string;
  mimeType: string;
  size: number;
}

function getFileIcon(mimeType: string) {
  if (isImageType(mimeType)) return ImageIcon;
  if (mimeType === "application/pdf" || mimeType.startsWith("text/"))
    return FileText;
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("csv") ||
    mimeType.includes("excel")
  )
    return FileSpreadsheet;
  if (
    mimeType.includes("zip") ||
    mimeType.includes("tar") ||
    mimeType.includes("gzip") ||
    mimeType.includes("rar")
  )
    return FileArchive;
  return FileIcon;
}

function ImageAttachment({ attachment }: { attachment: Attachment }) {
  const url = useQuery(api.files.getFileUrl, {
    storageId: attachment.storageId,
  });
  const [expanded, setExpanded] = useState(false);

  if (!url) return <ImagePlaceholder filename={attachment.filename} />;

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="group relative overflow-hidden rounded border border-subtle"
      >
        <img
          src={url}
          alt={attachment.filename}
          className="max-h-60 max-w-xs rounded object-cover transition-opacity group-hover:opacity-90"
          loading="lazy"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <p className="truncate text-2xs text-white">{attachment.filename}</p>
        </div>
      </button>

      {/* Lightbox */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8"
          onClick={() => setExpanded(false)}
        >
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={url}
            alt={attachment.filename}
            className="max-h-full max-w-full rounded object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

function ImagePlaceholder({ filename }: { filename: string }) {
  return (
    <div className="flex h-20 w-32 items-center justify-center rounded border border-subtle bg-surface-2">
      <div className="text-center">
        <ImageIcon className="mx-auto h-4 w-4 text-muted-foreground" />
        <p className="mt-1 truncate text-2xs text-muted-foreground">
          {filename}
        </p>
      </div>
    </div>
  );
}

function FileAttachment({ attachment }: { attachment: Attachment }) {
  const url = useQuery(api.files.getFileUrl, {
    storageId: attachment.storageId,
  });
  const Icon = getFileIcon(attachment.mimeType);

  return (
    <a
      href={url ?? "#"}
      download={attachment.filename}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-2.5 rounded border border-subtle bg-surface-2 px-3 py-2 transition-colors",
        url ? "hover:bg-surface-3" : "pointer-events-none opacity-60",
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">
          {attachment.filename}
        </p>
        <p className="text-2xs text-muted-foreground">
          {formatFileSize(attachment.size)}
        </p>
      </div>
      <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </a>
  );
}

interface AttachmentRendererProps {
  attachments: Attachment[];
}

export function AttachmentRenderer({ attachments }: AttachmentRendererProps) {
  if (!attachments || attachments.length === 0) return null;

  const images = attachments.filter((a) => isImageType(a.mimeType));
  const files = attachments.filter((a) => !isImageType(a.mimeType));

  return (
    <div className="mt-1.5 space-y-1.5">
      {/* Images in a grid */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((att) => (
            <ImageAttachment key={att.storageId} attachment={att} />
          ))}
        </div>
      )}

      {/* File download cards */}
      {files.length > 0 && (
        <div className="flex flex-col gap-1">
          {files.map((att) => (
            <FileAttachment key={att.storageId} attachment={att} />
          ))}
        </div>
      )}
    </div>
  );
}
