"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Paperclip,
  X,
  ChevronUp,
  Reply,
  ReplyAll,
  Forward,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ComposeMode = "compose" | "reply" | "reply_all" | "forward";

interface EmailComposeProps {
  workspaceId: Id<"workspaces">;
  emailAccountId: Id<"emailAccounts">;
  /** Existing draft to edit */
  draftId?: Id<"emailDrafts">;
  /** Pre-fill for reply/forward */
  mode?: ComposeMode;
  replyToEmailId?: Id<"emails">;
  initialTo?: string[];
  initialCc?: string[];
  initialSubject?: string;
  initialBody?: string;
  /** Agent quick-reply suggestion */
  suggestedAction?: string;
  onSent?: () => void;
  onDiscard?: () => void;
  className?: string;
}

export function EmailCompose({
  workspaceId,
  emailAccountId,
  draftId: initialDraftId,
  mode = "compose",
  replyToEmailId,
  initialTo = [],
  initialCc = [],
  initialSubject = "",
  initialBody = "",
  suggestedAction,
  onSent,
  onDiscard,
  className,
}: EmailComposeProps) {
  const [to, setTo] = useState<string[]>(initialTo);
  const [cc, setCc] = useState<string[]>(initialCc);
  const [bcc, setBcc] = useState<string[]>([]);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(initialCc.length > 0);
  const [isSending, setIsSending] = useState(false);
  const [draftId, setDraftId] = useState<Id<"emailDrafts"> | undefined>(
    initialDraftId,
  );
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  const saveDraft = useMutation(api.emailSend.saveDraft);
  const deleteDraftMutation = useMutation(api.emailSend.deleteDraft);
  const sendEmail = useAction(api.emailSend.sendEmail);
  const accounts = useQuery(api.emailSync.listAccounts);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentAccount = accounts?.find((a) => a._id === emailAccountId);

  // Auto-save draft every 5 seconds of inactivity
  const scheduleSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(async () => {
      if (!to.length && !subject && !body) return;
      try {
        const id = await saveDraft({
          draftId,
          workspaceId,
          emailAccountId,
          to,
          cc: cc.length > 0 ? cc : undefined,
          bcc: bcc.length > 0 ? bcc : undefined,
          subject,
          body,
          mode,
          replyToEmailId,
          suggestedAction,
        });
        if (!draftId) setDraftId(id);
      } catch {
        // Silent fail for auto-save
      }
    }, 5000);
  }, [
    to,
    cc,
    bcc,
    subject,
    body,
    draftId,
    workspaceId,
    emailAccountId,
    mode,
    replyToEmailId,
    suggestedAction,
    saveDraft,
  ]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Trigger auto-save on content change
  useEffect(() => {
    scheduleSave();
  }, [to, cc, bcc, subject, body, scheduleSave]);

  const addRecipient = (
    field: "to" | "cc" | "bcc",
    value: string,
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    // Basic email validation
    if (!trimmed.includes("@")) return;

    switch (field) {
      case "to":
        if (!to.includes(trimmed)) setTo([...to, trimmed]);
        setToInput("");
        break;
      case "cc":
        if (!cc.includes(trimmed)) setCc([...cc, trimmed]);
        setCcInput("");
        break;
      case "bcc":
        if (!bcc.includes(trimmed)) setBcc([...bcc, trimmed]);
        setBccInput("");
        break;
    }
  };

  const removeRecipient = (field: "to" | "cc" | "bcc", email: string) => {
    switch (field) {
      case "to":
        setTo(to.filter((e) => e !== email));
        break;
      case "cc":
        setCc(cc.filter((e) => e !== email));
        break;
      case "bcc":
        setBcc(bcc.filter((e) => e !== email));
        break;
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: "to" | "cc" | "bcc",
    value: string,
  ) => {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      e.preventDefault();
      addRecipient(field, value);
    }
  };

  const handleSend = async () => {
    if (to.length === 0) return;
    setIsSending(true);

    try {
      // Save final draft first
      const id = await saveDraft({
        draftId,
        workspaceId,
        emailAccountId,
        to,
        cc: cc.length > 0 ? cc : undefined,
        bcc: bcc.length > 0 ? bcc : undefined,
        subject,
        body,
        mode,
        replyToEmailId,
        suggestedAction,
      });

      // Send via action
      await sendEmail({ draftId: id });
      onSent?.();
    } catch (error) {
      console.error("Failed to send email:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleDiscard = async () => {
    if (draftId) {
      try {
        await deleteDraftMutation({ draftId });
      } catch {
        // Ignore if draft already deleted
      }
    }
    onDiscard?.();
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setAttachmentFiles((prev) => [...prev, ...files]);
    // Reset input so same file can be re-added
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const useSuggestedAction = () => {
    if (suggestedAction) {
      setBody(suggestedAction);
      bodyRef.current?.focus();
    }
  };

  const modeIcon = {
    compose: null,
    reply: <Reply className="h-3.5 w-3.5" />,
    reply_all: <ReplyAll className="h-3.5 w-3.5" />,
    forward: <Forward className="h-3.5 w-3.5" />,
  };

  const modeLabel = {
    compose: "New Email",
    reply: "Reply",
    reply_all: "Reply All",
    forward: "Forward",
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-subtle bg-surface-1",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-subtle px-4 py-2">
        {modeIcon[mode]}
        <span className="text-sm font-medium text-foreground">
          {modeLabel[mode]}
        </span>
        {currentAccount && (
          <span className="ml-auto text-xs text-muted-foreground">
            from {currentAccount.emailAddress}
          </span>
        )}
      </div>

      {/* Recipients */}
      <div className="space-y-1 px-4 pt-3">
        {/* To */}
        <RecipientField
          label="To"
          recipients={to}
          inputValue={toInput}
          onInputChange={setToInput}
          onKeyDown={(e) => handleKeyDown(e, "to", toInput)}
          onBlur={() => addRecipient("to", toInput)}
          onRemove={(email) => removeRecipient("to", email)}
          extra={
            !showCcBcc ? (
              <button
                type="button"
                onClick={() => setShowCcBcc(true)}
                className="ml-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Cc/Bcc
              </button>
            ) : null
          }
        />

        {/* CC / BCC */}
        {showCcBcc && (
          <>
            <RecipientField
              label="Cc"
              recipients={cc}
              inputValue={ccInput}
              onInputChange={setCcInput}
              onKeyDown={(e) => handleKeyDown(e, "cc", ccInput)}
              onBlur={() => addRecipient("cc", ccInput)}
              onRemove={(email) => removeRecipient("cc", email)}
            />
            <RecipientField
              label="Bcc"
              recipients={bcc}
              inputValue={bccInput}
              onInputChange={setBccInput}
              onKeyDown={(e) => handleKeyDown(e, "bcc", bccInput)}
              onBlur={() => addRecipient("bcc", bccInput)}
              onRemove={(email) => removeRecipient("bcc", email)}
              extra={
                <button
                  type="button"
                  onClick={() => setShowCcBcc(false)}
                  className="ml-1"
                >
                  <ChevronUp className="h-3 w-3 text-muted-foreground" />
                </button>
              }
            />
          </>
        )}
      </div>

      {/* Subject */}
      <div className="px-4 pt-2">
        <Input
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="h-px bg-subtle mx-4" />

      {/* Body */}
      <div className="relative px-4 py-2">
        <Textarea
          ref={bodyRef}
          placeholder="Write your message..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-[160px] resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
      </div>

      {/* Agent suggested action */}
      {suggestedAction && !body && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-md border border-ping-purple/30 bg-ping-purple/5 px-3 py-2">
          <Sparkles className="h-4 w-4 shrink-0 text-ping-purple" />
          <p className="flex-1 text-xs text-muted-foreground line-clamp-2">
            {suggestedAction}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={useSuggestedAction}
            className="shrink-0 text-xs text-ping-purple hover:text-ping-purple"
          >
            Use suggestion
          </Button>
        </div>
      )}

      {/* Attachments */}
      {attachmentFiles.length > 0 && (
        <div className="mx-4 mb-2 flex flex-wrap gap-2">
          {attachmentFiles.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1"
            >
              <Paperclip className="h-3 w-3 text-muted-foreground" />
              <span className="max-w-[120px] truncate text-xs text-foreground">
                {file.name}
              </span>
              <span className="text-2xs text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(i)}
                className="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 border-t border-subtle px-4 py-2">
        <Button
          onClick={handleSend}
          disabled={isSending || to.length === 0}
          size="sm"
          className="gap-1.5"
        >
          <Send className="h-3.5 w-3.5" />
          {isSending ? "Sending..." : "Send"}
        </Button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleAttachClick}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            title="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={handleDiscard}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-destructive"
            title="Discard draft"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Recipient field sub-component ───────────────────────────────────────────

interface RecipientFieldProps {
  label: string;
  recipients: string[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onRemove: (email: string) => void;
  extra?: React.ReactNode;
}

function RecipientField({
  label,
  recipients,
  inputValue,
  onInputChange,
  onKeyDown,
  onBlur,
  onRemove,
  extra,
}: RecipientFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-xs text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-1">
        {recipients.map((email) => (
          <Badge
            key={email}
            variant="secondary"
            className="gap-1 py-0.5 text-xs"
          >
            {email}
            <button
              type="button"
              onClick={() => onRemove(email)}
              className="ml-0.5 rounded-sm hover:bg-white/10"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          placeholder={recipients.length === 0 ? `Add ${label.toLowerCase()} recipients` : ""}
          className="min-w-[100px] flex-1 border-0 bg-transparent px-1 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      {extra}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
