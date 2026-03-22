"use client";

import { useState, useRef, useEffect } from "react";
import { GitPullRequest, ChevronDown, ChevronRight, History } from "lucide-react";

import { LinearIcon } from "@/components/icons/LinearIcon";

export interface IntegrationObjectData {
  identifier?: string;
  type?: string;
  title?: string;
  status?: string;
  url?: string;
  author?: string;
}

export interface ParsedIntegration {
  provider: "github" | "linear";
  action: "created" | "updated";
  title: string;
  url: string;
  status?: string;
  author?: string;
  priority?: string;
  repo?: string;
  identifier?: string;
}

/** Parse the markdown body produced by `buildIntegrationMessageBody`. */
export function parseIntegrationBody(body: string): ParsedIntegration | null {
  const headerMatch = body.match(
    /^\*\*\[(\w+)\s+(?:PR|ticket)\s+(created|updated)]\*\*\s+\[([^\]]+)]\(([^)]+)\)/,
  );
  if (!headerMatch) return null;

  const provider = headerMatch[1].toLowerCase() as "github" | "linear";
  const action = headerMatch[2] as "created" | "updated";
  const linkText = headerMatch[3];
  const url = headerMatch[4];

  let identifier: string | undefined;
  let title: string;

  if (provider === "github") {
    const prMatch = linkText.match(/^#(\d+)\s+(.+)/);
    if (prMatch) {
      identifier = prMatch[1];
      title = prMatch[2];
    } else {
      title = linkText;
    }
  } else {
    const ticketMatch = linkText.match(/^([A-Z]+-\d+)\s+(.+)/);
    if (ticketMatch) {
      identifier = ticketMatch[1];
      title = ticketMatch[2];
    } else {
      title = linkText;
    }
  }

  const lines = body.split("\n").filter(Boolean);
  const metaLine = lines.find((l) => l.includes("Author:") || l.includes("Status:")) ?? "";
  const statusMatch = metaLine.match(/Status:\s*([^|\n]+)/);
  const authorMatch = metaLine.match(/Author:\s*([^|\n]+)/);
  const priorityMatch = metaLine.match(/Priority:\s*([^|\n]+)/);
  const repoMatch = lines
    .find((l) => l.startsWith("Repository:"))
    ?.replace("Repository: ", "")
    .replace(/`/g, "");

  return {
    provider,
    action,
    title,
    url,
    status: statusMatch?.[1]?.trim(),
    author: authorMatch?.[1]?.trim(),
    priority: priorityMatch?.[1]?.trim(),
    repo: repoMatch?.trim(),
    identifier,
  };
}

/** Describe what changed between two parsed states. */
export function describeChange(
  prev: ParsedIntegration | null,
  curr: ParsedIntegration | null,
): string {
  if (!curr) return "Updated";
  if (!prev) return curr.action === "created" ? "Created" : "Updated";
  const parts: string[] = [];
  if (prev.status !== curr.status) parts.push(`${prev.status} → ${curr.status}`);
  if (prev.author !== curr.author && curr.author) parts.push(`assigned to ${curr.author}`);
  if (prev.priority !== curr.priority && curr.priority) parts.push(`priority → ${curr.priority}`);
  return parts.length > 0 ? parts.join(", ") : "Updated";
}

function statusColor(status?: string): string {
  if (!status) return "text-foreground/40";
  const s = status.toLowerCase();
  if (s === "done" || s === "merged") return "text-green-400";
  if (s === "in progress" || s === "open") return "text-amber-400";
  if (s === "cancelled" || s === "closed") return "text-red-400";
  return "text-foreground/40";
}

interface IntegrationMessageCardProps {
  body: string;
  history?: Array<{ body: string; timestamp: number }>;
  /** Resolved integration object from backend — authoritative source for identifier/title/status */
  integrationObject?: IntegrationObjectData;
}

function HistoryEntry({
  body,
  timestamp,
  prev,
  fallbackIdentifier,
}: {
  body: string;
  timestamp: number;
  prev?: string;
  fallbackIdentifier?: string;
}) {
  const parsed = parseIntegrationBody(body);
  const prevParsed = prev ? parseIntegrationBody(prev) : null;
  const change = describeChange(prevParsed, parsed);
  const time = new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const id = parsed?.identifier ?? fallbackIdentifier;

  return (
    <div className="flex items-baseline gap-2 py-1 text-2xs text-muted-foreground">
      <span className="shrink-0 font-mono text-foreground/25">{time}</span>
      {id && (
        <span className="shrink-0 font-mono text-foreground/40">{id}</span>
      )}
      {parsed ? (
        <span>
          <span className={statusColor(parsed.status)}>{parsed.status}</span>
          <span className="text-foreground/20">{" · "}</span>
          {change}
        </span>
      ) : (
        <span className="truncate">{body.slice(0, 80)}</span>
      )}
    </div>
  );
}

export function IntegrationMessageCard({
  body,
  history,
  integrationObject,
}: IntegrationMessageCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const parsed = parseIntegrationBody(body);

  useEffect(() => {
    if (showHistory && historyRef.current) {
      historyRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [showHistory]);

  // Merge parsed body with integration object data (object is authoritative)
  const identifier =
    integrationObject?.identifier ?? parsed?.identifier;
  const title = integrationObject?.title ?? parsed?.title ?? body.slice(0, 60);
  const status = integrationObject?.status ?? parsed?.status;
  const url = integrationObject?.url ?? parsed?.url;
  const objAuthor = integrationObject?.author ?? parsed?.author;
  const priority = parsed?.priority;
  const repo = parsed?.repo;
  const isGitHub =
    integrationObject?.type === "github_pr" || parsed?.provider === "github";
  const updateCount = history?.length ?? 0;

  // If we have neither parsed nor object data, show raw text
  if (!parsed && !integrationObject) {
    return <p className="text-sm leading-relaxed text-foreground/90">{body}</p>;
  }

  return (
    <div className="my-0.5 max-w-md">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-2 rounded border border-subtle p-2 transition-colors hover:bg-surface-2"
      >
        {isGitHub ? (
          <GitPullRequest className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/40" />
        ) : (
          <LinearIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/40" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {identifier && (
              <span className="shrink-0 text-2xs text-muted-foreground">
                {isGitHub && !identifier.startsWith("#")
                  ? `#${identifier}`
                  : identifier}
              </span>
            )}
            <span className="truncate text-xs font-medium text-foreground">
              {title}
            </span>
          </div>

          <div className="mt-0.5 flex items-center gap-2 text-2xs text-muted-foreground">
            {status && (
              <span className={statusColor(status)}>{status}</span>
            )}
            {objAuthor && objAuthor !== "Unassigned" && (
              <>
                <span className="text-foreground/20">·</span>
                <span>{objAuthor}</span>
              </>
            )}
            {priority && priority !== "No priority" && (
              <>
                <span className="text-foreground/20">·</span>
                <span>{priority}</span>
              </>
            )}
            {repo && (
              <>
                <span className="text-foreground/20">·</span>
                <span className="font-mono text-foreground/40">{repo}</span>
              </>
            )}
            {updateCount > 0 && (
              <>
                <span className="text-foreground/20">·</span>
                <span className="text-foreground/30">
                  {updateCount} update{updateCount !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        </div>
      </a>

      {/* Update history toggle */}
      {updateCount > 0 && (
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="mt-1 flex items-center gap-1 px-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <History className="h-3 w-3" />
          <span>
            {showHistory ? "Hide" : "Show"} history
          </span>
          {showHistory ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
      )}

      {showHistory && history && (
        <div ref={historyRef} className="ml-1 mt-1 border-l border-subtle pl-2">
          {history.map((entry, i) => (
            <HistoryEntry
              key={i}
              body={entry.body}
              timestamp={entry.timestamp}
              prev={i > 0 ? history[i - 1].body : undefined}
              fallbackIdentifier={identifier}
            />
          ))}
        </div>
      )}
    </div>
  );
}
