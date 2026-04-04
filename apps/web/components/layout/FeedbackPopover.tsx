"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Bug, Lightbulb, MessageSquarePlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

type FeedbackType = "bug" | "idea";

interface FeedbackPopoverProps {
  workspaceId: Id<"workspaces"> | undefined;
}

export function FeedbackPopover({ workspaceId }: FeedbackPopoverProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("idea");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitFeedback = useMutation(api.feedback.submit);
  const { toast } = useToast();
  const pathname = usePathname();

  const handleSubmit = async () => {
    if (!workspaceId || !message.trim()) return;
    setSubmitting(true);
    try {
      await submitFeedback({
        workspaceId,
        type,
        message: message.trim(),
        context: pathname,
      });
      toast("Thanks for the feedback!", "success");
      setMessage("");
      setType("idea");
      setOpen(false);
    } catch {
      toast("Failed to send feedback", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
          aria-label="Send feedback"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" sideOffset={8} className="w-80 p-0">
        <div className="p-3 space-y-3">
          <p className="text-xs font-medium text-foreground">Send feedback</p>

          {/* Type selector */}
          <div className="flex gap-1.5">
            <button
              onClick={() => setType("bug")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors",
                type === "bug"
                  ? "border-status-danger/40 bg-status-danger/10 text-status-danger"
                  : "border-subtle bg-transparent text-muted-foreground hover:bg-surface-3",
              )}
            >
              <Bug className="h-3.5 w-3.5" />
              Bug
            </button>
            <button
              onClick={() => setType("idea")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors",
                type === "idea"
                  ? "border-ping-purple/40 bg-ping-purple-muted text-ping-purple"
                  : "border-subtle bg-transparent text-muted-foreground hover:bg-surface-3",
              )}
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Idea
            </button>
          </div>

          {/* Message */}
          <Textarea
            placeholder={
              type === "bug"
                ? "What went wrong?"
                : "What would you like to see?"
            }
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            rows={3}
            className="resize-none text-xs"
          />

          {/* Submit */}
          <div className="flex items-center justify-between">
            <span className="text-2xs text-muted-foreground">
              {"\u2318"}Enter to send
            </span>
            <Button
              size="sm"
              disabled={!message.trim() || submitting}
              onClick={handleSubmit}
              className="h-7 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover disabled:opacity-40"
            >
              {submitting ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
