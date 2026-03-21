"use client";

import {
  GitPullRequest,
  CheckCircle2,
  XCircle,
  Loader2,
  FileDiff,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface GitHubPRCardProps {
  prNumber: number;
  title: string;
  repoName: string;
  author: string;
  status: "open" | "merged" | "closed" | "draft";
  additions?: number;
  deletions?: number;
  reviewCommentCount?: number;
  ciStatus?: "success" | "failure" | "pending" | "neutral";
  url: string;
  compact?: boolean;
}

const STATUS_CONFIG: Record<
  GitHubPRCardProps["status"],
  { color: string; label: string }
> = {
  open: { color: "text-green-400", label: "Open" },
  merged: { color: "text-purple-400", label: "Merged" },
  closed: { color: "text-red-400", label: "Closed" },
  draft: { color: "text-white/40", label: "Draft" },
};

const CI_CONFIG: Record<
  NonNullable<GitHubPRCardProps["ciStatus"]>,
  { icon: typeof CheckCircle2; color: string }
> = {
  success: { icon: CheckCircle2, color: "text-green-400" },
  failure: { icon: XCircle, color: "text-red-400" },
  pending: { icon: Loader2, color: "text-amber-400" },
  neutral: { icon: CheckCircle2, color: "text-white/30" },
};

export function GitHubPRCard({
  prNumber,
  title,
  repoName,
  author,
  status,
  additions,
  deletions,
  reviewCommentCount,
  ciStatus,
  url,
  compact,
}: GitHubPRCardProps) {
  const statusCfg = STATUS_CONFIG[status];
  const ciCfg = ciStatus ? CI_CONFIG[ciStatus] : null;
  const CiIcon = ciCfg?.icon ?? null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-start gap-2 rounded border border-subtle p-2 transition-colors hover:bg-surface-2",
        compact && "p-1.5 gap-1.5"
      )}
    >
      <GitPullRequest
        className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", statusCfg.color)}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "truncate font-medium text-foreground",
              compact ? "text-2xs" : "text-xs"
            )}
          >
            {title}
          </span>
          <span className="shrink-0 text-2xs text-muted-foreground">
            #{prNumber}
          </span>
        </div>

        <div className="mt-0.5 flex items-center gap-2 text-2xs text-muted-foreground">
          <span>{repoName}</span>
          <span className="text-white/20">·</span>
          <span>{author}</span>

          {/* Diff stats */}
          {(additions !== undefined || deletions !== undefined) && (
            <>
              <span className="text-white/20">·</span>
              <span className="flex items-center gap-0.5">
                <FileDiff className="h-3 w-3 text-white/30" />
                {additions !== undefined && (
                  <span className="text-green-400">+{additions}</span>
                )}
                {deletions !== undefined && (
                  <span className="text-red-400">-{deletions}</span>
                )}
              </span>
            </>
          )}

          {/* Review comment count */}
          {reviewCommentCount !== undefined && reviewCommentCount > 0 && (
            <>
              <span className="text-white/20">·</span>
              <span className="flex items-center gap-0.5">
                <span aria-hidden>💬</span>
                <span>{reviewCommentCount}</span>
              </span>
            </>
          )}

          {/* CI status */}
          {CiIcon && ciCfg && (
            <>
              <span className="text-white/20">·</span>
              <CiIcon
                className={cn(
                  "h-3.5 w-3.5",
                  ciCfg.color,
                  ciStatus === "pending" && "animate-spin"
                )}
              />
            </>
          )}
        </div>
      </div>
    </a>
  );
}
