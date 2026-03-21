"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type DragEvent,
  type ClipboardEvent,
} from "react";
import { Paperclip, X, FileIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_FILE_SIZE, formatFileSize, isImageType } from "@/lib/file-utils";

export interface PendingAttachment {
  id: string;
  file: File;
  filename: string;
  mimeType: string;
  size: number;
  previewUrl?: string;
  status: "pending" | "uploading" | "done" | "error";
  storageId?: string;
  error?: string;
  progress: number;
}

interface FileUploadProps {
  attachments: PendingAttachment[];
  onAttachmentsChange: (attachments: PendingAttachment[]) => void;
  children: React.ReactNode;
  /** Exposes a function to programmatically open the file picker */
  onFileInputReady?: (trigger: () => void) => void;
}

let nextId = 0;
function generateId() {
  return `file-${Date.now()}-${nextId++}`;
}

export function FileUpload({
  attachments,
  onAttachmentsChange,
  children,
  onFileInputReady,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expose the file input trigger to parent
  useEffect(() => {
    onFileInputReady?.(() => fileInputRef.current?.click());
  }, [onFileInputReady]);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const newAttachments: PendingAttachment[] = [];

      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          newAttachments.push({
            id: generateId(),
            file,
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            status: "error",
            error: "File exceeds 25MB limit",
            progress: 0,
          });
          continue;
        }

        const previewUrl = isImageType(file.type)
          ? URL.createObjectURL(file)
          : undefined;

        newAttachments.push({
          id: generateId(),
          file,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          previewUrl,
          status: "pending",
          progress: 0,
        });
      }

      onAttachmentsChange([...attachments, ...newAttachments]);
    },
    [attachments, onAttachmentsChange],
  );

  const removeAttachment = useCallback(
    (id: string) => {
      const att = attachments.find((a) => a.id === id);
      if (att?.previewUrl) URL.revokeObjectURL(att.previewUrl);
      onAttachmentsChange(attachments.filter((a) => a.id !== id));
    },
    [attachments, onAttachmentsChange],
  );

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      attachments.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        addFiles(imageFiles);
      }
    },
    [addFiles],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
        e.target.value = "";
      }
    },
    [addFiles],
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaste={handlePaste}
      className="relative"
    >
      {isDragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded border-2 border-dashed border-ping-purple bg-ping-purple/10 backdrop-blur-sm">
          <div className="text-center">
            <Paperclip className="mx-auto mb-2 h-8 w-8 text-ping-purple" />
            <p className="text-sm font-medium text-ping-purple">
              Drop files to attach
            </p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {children}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pb-2">
          {attachments.map((att) => (
            <AttachmentPreview
              key={att.id}
              attachment={att}
              onRemove={() => removeAttachment(att.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileUploadButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded p-1 text-white/25 hover:bg-surface-3 hover:text-white/60"
      title="Attach files"
    >
      <Paperclip className="h-3.5 w-3.5" />
    </button>
  );
}

export async function uploadAttachments(
  attachments: PendingAttachment[],
  generateUploadUrl: () => Promise<string>,
  onUpdate: (updated: PendingAttachment[]) => void,
): Promise<
  { storageId: string; filename: string; mimeType: string; size: number }[]
> {
  const pending = attachments.filter((a) => a.status !== "error");
  const results: {
    storageId: string;
    filename: string;
    mimeType: string;
    size: number;
  }[] = [];
  const updated = [...attachments];

  for (const att of pending) {
    const idx = updated.findIndex((a) => a.id === att.id);

    updated[idx] = { ...updated[idx], status: "uploading", progress: 0 };
    onUpdate([...updated]);

    try {
      const uploadUrl = await generateUploadUrl();

      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": att.mimeType },
        body: att.file,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const { storageId } = (await response.json()) as { storageId: string };

      updated[idx] = {
        ...updated[idx],
        status: "done",
        storageId,
        progress: 100,
      };
      onUpdate([...updated]);

      results.push({
        storageId,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
      });
    } catch (error) {
      updated[idx] = {
        ...updated[idx],
        status: "error",
        error: error instanceof Error ? error.message : "Upload failed",
        progress: 0,
      };
      onUpdate([...updated]);
    }
  }

  return results;
}

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: PendingAttachment;
  onRemove: () => void;
}) {
  const isImage = isImageType(attachment.mimeType);

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 rounded border border-subtle bg-surface-2 p-1.5",
        attachment.status === "error" && "border-red-500/50",
      )}
    >
      {isImage && attachment.previewUrl ? (
        <img
          src={attachment.previewUrl}
          alt={attachment.filename}
          className="h-10 w-10 rounded object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded bg-surface-3">
          <FileIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      <div className="min-w-0 max-w-[120px]">
        <p className="truncate text-2xs font-medium text-foreground">
          {attachment.filename}
        </p>
        <p className="text-2xs text-muted-foreground">
          {attachment.status === "error"
            ? attachment.error
            : formatFileSize(attachment.size)}
        </p>
      </div>

      {attachment.status === "uploading" && (
        <div className="absolute inset-0 flex items-center justify-center rounded bg-black/40">
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        </div>
      )}

      <button
        type="button"
        onClick={onRemove}
        className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-surface-3 p-0.5 text-muted-foreground hover:text-foreground group-hover:block"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
