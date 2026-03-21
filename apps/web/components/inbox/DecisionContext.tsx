"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CircleDot,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";

interface Bullet {
  text: string;
  priority: string;
}

interface SourceMessage {
  body: string;
  authorName: string;
  createdAt: number;
}

interface IntegrationObject {
  type: string;
  title: string;
  status: string;
  url: string;
}

interface RelatedDecision {
  title: string;
  outcome: string;
  decidedAt: number;
}

interface DecisionContextProps {
  decisionId: string;
  isExpanded: boolean;
  summary?: string;
  bullets?: Bullet[];
  sourceMessages?: SourceMessage[];
  integrationObjects?: IntegrationObject[];
  relatedDecisions?: RelatedDecision[];
}

const priorityBadgeColor: Record<string, string> = {
  high: "bg-red-500/10 text-red-400",
  medium: "bg-amber-500/10 text-amber-400",
  low: "bg-green-500/10 text-green-400",
};

const statusBadgeColor: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-400",
  "in-progress": "bg-amber-500/10 text-amber-400",
  closed: "bg-green-500/10 text-green-400",
  merged: "bg-purple-500/10 text-purple-400",
};

const outcomeBadgeColor: Record<string, string> = {
  approved: "bg-green-500/10 text-green-400",
  rejected: "bg-red-500/10 text-red-400",
  deferred: "bg-amber-500/10 text-amber-400",
  implemented: "bg-blue-500/10 text-blue-400",
};

const toggleButtonClass =
  "flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground";

export function DecisionContext({
  decisionId,
  isExpanded,
  summary,
  bullets,
  sourceMessages,
  integrationObjects,
  relatedDecisions,
}: DecisionContextProps) {
  const [level, setLevel] = useState(1);

  if (!isExpanded) return null;

  const hasSources =
    (sourceMessages && sourceMessages.length > 0) ||
    (integrationObjects && integrationObjects.length > 0);
  const hasDeepDive = relatedDecisions && relatedDecisions.length > 0;

  return (
    <div
      className="overflow-hidden transition-all duration-200"
      data-decision-id={decisionId}
    >
      {summary && (
        <p className="mb-2 text-xs text-muted-foreground">{summary}</p>
      )}

      {bullets && bullets.length > 0 && (
        <ul className="space-y-1">
          {bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span
                className={cn(
                  "mt-0.5 shrink-0 rounded px-1.5 py-px text-2xs font-medium",
                  priorityBadgeColor[bullet.priority] ??
                    "bg-white/10 text-muted-foreground",
                )}
              >
                {bullet.priority}
              </span>
              <span className="text-foreground/90">{bullet.text}</span>
            </li>
          ))}
        </ul>
      )}

      {level < 2 && hasSources && (
        <button
          onClick={() => setLevel(2)}
          className={cn("mt-2", toggleButtonClass)}
        >
          <ChevronDown className="h-3 w-3" />
          Show more
        </button>
      )}

      {level >= 2 && (
        <div className="mt-2 space-y-2 transition-all duration-200">
          {sourceMessages && sourceMessages.length > 0 && (
            <div className="space-y-1.5">
              {sourceMessages.map((msg, i) => (
                <div
                  key={i}
                  className="rounded-md bg-surface-2 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-medium text-foreground">
                      {msg.authorName}
                    </span>
                    <span className="text-2xs text-muted-foreground">
                      {formatRelativeTime(msg.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-foreground/80">
                    {msg.body}
                  </p>
                </div>
              ))}
            </div>
          )}

          {integrationObjects && integrationObjects.length > 0 && (
            <div className="space-y-1">
              {integrationObjects.map((obj, i) => (
                <a
                  key={i}
                  href={obj.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-1.5 transition-colors hover:bg-white/10"
                >
                  <CircleDot className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate text-xs text-foreground/90">
                    {obj.title}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-px text-2xs font-medium",
                      statusBadgeColor[obj.status] ??
                        "bg-white/10 text-muted-foreground",
                    )}
                  >
                    {obj.status}
                  </span>
                  <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </div>
          )}

          {level < 3 && (
            <button
              onClick={() => setLevel(1)}
              className={toggleButtonClass}
            >
              <ChevronUp className="h-3 w-3" />
              Show less
            </button>
          )}

          {level < 3 && hasDeepDive && (
            <button
              onClick={() => setLevel(3)}
              className={toggleButtonClass}
            >
              <ChevronDown className="h-3 w-3" />
              Deep dive
            </button>
          )}
        </div>
      )}

      {level >= 3 && (
        <div className="mt-2 space-y-2 transition-all duration-200">
          {relatedDecisions && relatedDecisions.length > 0 && (
            <div className="space-y-1">
              <span className="text-2xs font-medium text-muted-foreground">
                Related Decisions
              </span>
              {relatedDecisions.map((rd, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-1.5"
                >
                  <span className="truncate text-xs text-foreground/90">
                    {rd.title}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-px text-2xs font-medium",
                      outcomeBadgeColor[rd.outcome] ??
                        "bg-white/10 text-muted-foreground",
                    )}
                  >
                    {rd.outcome}
                  </span>
                  <span className="ml-auto text-2xs text-muted-foreground">
                    {formatRelativeTime(rd.decidedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-md border border-subtle bg-surface-2/50 px-3 py-2">
            <span className="text-2xs text-muted-foreground">
              Knowledge graph facts will appear here.
            </span>
          </div>

          <button
            onClick={() => setLevel(2)}
            className={toggleButtonClass}
          >
            <ChevronUp className="h-3 w-3" />
            Show less
          </button>
        </div>
      )}
    </div>
  );
}
