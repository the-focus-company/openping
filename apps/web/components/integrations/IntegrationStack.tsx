"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, Layers, GitPullRequest } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinearIcon } from "@/components/icons/LinearIcon";
import type { Message } from "@/components/channel/MessageList";
import {
  parseIntegrationBody,
  describeChange,
} from "./IntegrationMessageCard";

interface IntegrationStackProps {
  messages: Message[];
  onToggle?: () => void;
}

function getIdentifier(msg: Message): string | undefined {
  return msg.integrationObject?.identifier ?? parseIntegrationBody(msg.content)?.identifier;
}

function getTitle(msg: Message): string {
  return msg.integrationObject?.title ?? parseIntegrationBody(msg.content)?.title ?? "Untitled";
}

function getStatus(msg: Message): string | undefined {
  return msg.integrationObject?.status ?? parseIntegrationBody(msg.content)?.status;
}

function isGitHub(msg: Message): boolean {
  return msg.integrationObject?.type === "github_pr" || parseIntegrationBody(msg.content)?.provider === "github";
}

function statusColor(status?: string): string {
  if (!status) return "text-foreground/40";
  const s = status.toLowerCase();
  if (s === "done" || s === "merged") return "text-green-400";
  if (s === "in progress" || s === "open") return "text-amber-400";
  if (s === "cancelled" || s === "closed") return "text-red-400";
  return "text-foreground/40";
}

/** Build a one-line collapsed summary with ticket IDs. */
function buildSummary(messages: Message[]): string {
  // Check if all messages relate to the same integration object
  const uniqueObjects = new Set(
    messages.map((m) => m.integrationObjectId).filter(Boolean),
  );

  if (uniqueObjects.size === 1) {
    // Same issue — lead with identifier
    const id = getIdentifier(messages[0]);
    const title = getTitle(messages[0]);
    const latestStatus = getStatus(messages[messages.length - 1]);
    const prefix = id ? `${id} — ` : "";
    return `${prefix}${title} — ${latestStatus ?? "updated"} · ${messages.length} updates`;
  }

  // Multiple issues — list unique identifiers
  const ids = [...new Set(messages.map(getIdentifier).filter(Boolean))];
  const idList = ids.length > 0 ? ids.join(", ") : "";

  const linearCount = messages.filter((m) => !isGitHub(m)).length;
  const githubCount = messages.filter((m) => isGitHub(m)).length;
  const typeParts: string[] = [];
  if (linearCount > 0) typeParts.push(`${linearCount} ticket${linearCount !== 1 ? "s" : ""}`);
  if (githubCount > 0) typeParts.push(`${githubCount} PR${githubCount !== 1 ? "s" : ""}`);

  const summary = `${messages.length} updates — ${typeParts.join(", ")}`;
  return idList ? `${summary} (${idList})` : summary;
}

function ExpandedRow({ msg, prev }: { msg: Message; prev?: Message }) {
  const parsed = parseIntegrationBody(msg.content);
  const prevParsed = prev ? parseIntegrationBody(prev.content) : null;
  const change = describeChange(prevParsed, parsed);

  const identifier = getIdentifier(msg);
  const title = getTitle(msg);
  const status = getStatus(msg);
  const github = isGitHub(msg);
  const url = msg.integrationObject?.url ?? parsed?.url;

  const Wrapper = url ? "a" : "div";
  const wrapperProps = url
    ? { href: url, target: "_blank" as const, rel: "noopener noreferrer" as const }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="flex items-center gap-2 rounded px-2.5 py-1.5 text-2xs transition-colors hover:bg-surface-2"
    >
      {github ? (
        <GitPullRequest className="h-3 w-3 shrink-0 text-foreground/30" />
      ) : (
        <LinearIcon className="h-3 w-3 shrink-0 text-foreground/30" />
      )}

      {identifier && (
        <span className="shrink-0 font-mono text-muted-foreground">
          {github && !identifier.startsWith("#") ? `#${identifier}` : identifier}
        </span>
      )}

      <span className="min-w-0 truncate text-foreground/70">{title}</span>

      <span className={cn("shrink-0", statusColor(status))}>{status}</span>

      <span className="shrink-0 text-foreground/25">{change}</span>
    </Wrapper>
  );
}

export function IntegrationStack({ messages, onToggle }: IntegrationStackProps) {
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onToggle?.();
    if (expanded && listRef.current) {
      listRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [expanded, onToggle]);

  if (messages.length === 0) return null;

  const summary = buildSummary(messages);

  return (
    <div className="my-1 px-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded border border-subtle bg-surface-1 px-3 py-2 text-left transition-colors hover:bg-surface-2"
      >
        <Layers className="h-3.5 w-3.5 shrink-0 text-foreground/30" />
        <span className="flex-1 text-xs text-foreground">{summary}</span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-foreground/30" />
        ) : (
          <ChevronRight className="h-3 w-3 text-foreground/30" />
        )}
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-150 ease-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
        onTransitionEnd={() => onToggle?.()}
      >
        <div className="overflow-hidden">
          <div
            ref={listRef}
            className="mt-1 rounded border border-subtle bg-surface-1 divide-y divide-subtle"
          >
            {messages.map((msg, i) => (
              <ExpandedRow
                key={msg.id}
                msg={msg}
                prev={i > 0 ? messages[i - 1] : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
