"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type DecisionType =
  | "pr_review"
  | "ticket_triage"
  | "question_answer"
  | "blocked_unblock"
  | "fact_verify"
  | "cross_team_ack"
  | "channel_summary";

interface DecisionActionsProps {
  type: DecisionType;
  onAction: (action: string, comment?: string) => void;
}

interface ActionDef {
  label: string;
  primary?: boolean;
  needsComment?: boolean;
}

const actionsByType: Record<DecisionType, ActionDef[]> = {
  pr_review: [
    { label: "Approve", primary: true },
    { label: "Request Changes", needsComment: true },
    { label: "Delegate", needsComment: true },
  ],
  question_answer: [
    { label: "Reply", primary: true },
    { label: "Delegate", needsComment: true },
    { label: "Dismiss" },
  ],
  blocked_unblock: [
    { label: "Investigate", primary: true },
    { label: "Reassign" },
    { label: "Snooze" },
  ],
  ticket_triage: [
    { label: "Accept", primary: true },
    { label: "Reject", needsComment: true },
    { label: "Delegate", needsComment: true },
  ],
  fact_verify: [
    { label: "Confirm", primary: true },
    { label: "Dispute" },
    { label: "Investigate" },
  ],
  cross_team_ack: [
    { label: "Acknowledge", primary: true },
    { label: "Follow Up" },
  ],
  channel_summary: [
    { label: "Mark Read", primary: true },
    { label: "Investigate" },
  ],
};

export function DecisionActions({ type, onAction }: DecisionActionsProps) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const actions = actionsByType[type];

  function handleClick(action: ActionDef) {
    if (action.needsComment) {
      setPendingAction(action.label);
      setComment("");
    } else {
      onAction(action.label);
    }
  }

  function handleSubmitComment() {
    if (pendingAction) {
      onAction(pendingAction, comment || undefined);
      setPendingAction(null);
      setComment("");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => handleClick(action)}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
              action.primary
                ? "bg-ping-purple text-white hover:bg-ping-purple/90"
                : "bg-white/5 text-foreground hover:bg-white/10"
            )}
          >
            {action.label}
          </button>
        ))}
      </div>

      {pendingAction && (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={`Add reasoning for "${pendingAction}"...`}
            className="min-h-[60px] w-full resize-none rounded border border-subtle bg-surface-2 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ping-purple"
          />
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSubmitComment}
              className="rounded bg-ping-purple px-2 py-1 text-xs font-medium text-white hover:bg-ping-purple/90"
            >
              Submit
            </button>
            <button
              onClick={() => setPendingAction(null)}
              className="rounded bg-white/5 px-2 py-1 text-xs font-medium text-foreground hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
