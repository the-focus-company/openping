"use client";

import { useState } from "react";
import { Search, GitBranch, Zap, MessageSquare, GitPullRequest, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";

interface GraphNode {
  id: string;
  type: "github" | "linear" | "chat" | "pr";
  label: string;
  count: number;
  x: number;
  y: number;
  color: string;
}

const NODES: GraphNode[] = [
  { id: "gh",  type: "github",  label: "GitHub",  count: 2847, x: 50,  y: 40,  color: "#E5E7EB" },
  { id: "lin", type: "linear",  label: "Linear",  count: 1203, x: 75,  y: 65,  color: "#5E6AD2" },
  { id: "ch",  type: "chat",    label: "Channels", count: 8912, x: 25,  y: 65,  color: "#22C55E" },
  { id: "pr",  type: "pr",      label: "PRs",      count: 47,   x: 60,  y: 80,  color: "#A855F7" },
  { id: "n1",  type: "github",  label: "auth-service", count: 142, x: 40,  y: 20,  color: "#6B7280" },
  { id: "n2",  type: "linear",  label: "ENG-441",  count: 0,    x: 80,  y: 25,  color: "#6B7280" },
  { id: "n3",  type: "chat",    label: "#engineering", count: 0, x: 15, y: 45,  color: "#6B7280" },
  { id: "n4",  type: "pr",      label: "PR #234",  count: 0,    x: 65,  y: 50,  color: "#6B7280" },
];

const EDGES = [
  ["gh", "n1"], ["gh", "n4"], ["lin", "n2"], ["ch", "n3"],
  ["n1", "n4"], ["n2", "n4"], ["n3", "n2"], ["n4", "lin"],
  ["n1", "n3"], ["gh", "lin"],
];

const STATS = [
  { label: "GitHub Events",    value: "2,847", color: "#E5E7EB", icon: GitBranch },
  { label: "Linear Tickets",   value: "1,203", color: "#5E6AD2", icon: Zap },
  { label: "Messages Indexed", value: "8,912", color: "#22C55E", icon: MessageSquare },
  { label: "PRs Tracked",      value: "47",    color: "#A855F7", icon: GitPullRequest },
];

const MOCK_RESULTS = [
  { entity: "auth-service",  type: "GitHub Repo",    connections: ["ENG-441", "PR #234", "#engineering"], updated: "2h ago" },
  { entity: "ENG-441",       type: "Linear Ticket",  connections: ["PR #234", "auth-service", "@sarah"], updated: "4h ago" },
  { entity: "PR #234",       type: "GitHub PR",      connections: ["ENG-441", "@alex", "#engineering"],  updated: "1h ago" },
];

export default function KnowledgeGraphPage() {
  const [query, setQuery] = useState("");
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const { toast } = useToast();

  return (
    <div className="mx-auto max-w-5xl animate-fade-in px-6 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-md font-semibold text-foreground">Knowledge Graph</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Visual map of your team&apos;s connected context across all integrations
          </p>
        </div>
        <button
          onClick={() => {
            setSyncing(true);
            setTimeout(() => {
              setSyncing(false);
              toast("Knowledge graph synced — 13,009 nodes updated", "success");
            }, 1500);
          }}
          className="flex items-center gap-1.5 rounded border border-subtle px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-white/10 hover:text-foreground"
        >
          <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
          {syncing ? "Syncing..." : "Sync now"}
        </button>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STATS.map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded border border-subtle bg-surface-1 px-3 py-2.5">
            <div className="flex items-center gap-1.5 pb-1">
              <Icon className="h-3 w-3" style={{ color }} />
              <span className="text-2xs text-muted-foreground">{label}</span>
            </div>
            <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearched(true)}
            placeholder="Search relationships... (e.g. 'auth refactor', 'ENG-441')"
            className="h-8 w-full rounded border border-subtle bg-surface-2 pl-8 pr-3 text-xs text-foreground placeholder:text-white/25 focus:border-white/15 focus:outline-none"
          />
        </div>
        <button
          onClick={() => setSearched(true)}
          className="rounded bg-ping-purple px-3 py-1.5 text-xs font-medium text-white hover:bg-ping-purple-hover"
        >
          Search
        </button>
      </div>

      {/* Graph visualization */}
      <div className="mb-4 overflow-hidden rounded border border-subtle bg-surface-1">
        <div className="relative h-72 w-full">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            {/* Edges */}
            {EDGES.map(([from, to]) => {
              const a = NODES.find((n) => n.id === from)!;
              const b = NODES.find((n) => n.id === to)!;
              return (
                <line
                  key={`${from}-${to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="0.3"
                />
              );
            })}

            {/* Nodes */}
            {NODES.map((node) => {
              const isHovered = hoveredNode === node.id;
              const isMain = ["gh", "lin", "ch", "pr"].includes(node.id);
              const r = isMain ? 4 : 2.5;

              return (
                <g
                  key={node.id}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r + (isHovered ? 1 : 0)}
                    fill={isHovered ? node.color : `${node.color}40`}
                    stroke={node.color}
                    strokeWidth="0.5"
                    style={{ transition: "r 150ms ease, fill 150ms ease" }}
                  />
                  {isMain && (
                    <text
                      x={node.x}
                      y={node.y + r + 2.5}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.4)"
                      fontSize="2.5"
                      fontFamily="sans-serif"
                    >
                      {node.label}
                    </text>
                  )}
                  {isHovered && (
                    <text
                      x={node.x}
                      y={node.y - r - 1.5}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.8)"
                      fontSize="2.5"
                      fontFamily="sans-serif"
                    >
                      {node.label}{node.count > 0 ? ` (${node.count.toLocaleString()})` : ""}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="border-t border-subtle px-4 py-2">
          <p className="text-2xs text-white/25">
            Hover nodes to inspect · Nodes represent entities in your knowledge graph · Lines show relationships
          </p>
        </div>
      </div>

      {/* Results table */}
      {(searched || query.length > 0) && (
        <div className="animate-fade-in">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              {MOCK_RESULTS.length} related entities
            </span>
            <span className="text-2xs text-muted-foreground">
              showing top matches for &quot;{query || "auth"}&quot;
            </span>
          </div>

          <div className="overflow-hidden rounded border border-subtle">
            <div className="grid grid-cols-[1fr_100px_1fr_60px] gap-4 border-b border-subtle bg-surface-1 px-4 py-2">
              {["Entity", "Type", "Connected To", "Updated"].map((h) => (
                <span key={h} className="text-2xs font-medium uppercase tracking-widest text-white/25">
                  {h}
                </span>
              ))}
            </div>
            {MOCK_RESULTS.map((result) => (
              <div key={result.entity}>
                <div
                  onClick={() => setExpandedRow(expandedRow === result.entity ? null : result.entity)}
                  className="grid cursor-pointer grid-cols-[1fr_100px_1fr_60px] items-center gap-4 border-b border-subtle px-4 py-2.5 transition-colors last:border-0 hover:bg-surface-2"
                >
                  <span className="font-mono text-xs text-foreground">{result.entity}</span>
                  <span className="text-2xs text-muted-foreground">{result.type}</span>
                  <div className="flex flex-wrap gap-1">
                    {result.connections.map((c) => (
                      <span key={c} className="rounded border border-subtle bg-surface-3 px-1 py-px text-2xs text-white/50">
                        {c}
                      </span>
                    ))}
                  </div>
                  <span className="text-2xs text-white/30">{result.updated}</span>
                </div>
                {expandedRow === result.entity && (
                  <div className="animate-fade-in border-b border-subtle bg-surface-2 px-4 py-3">
                    <p className="text-2xs font-medium uppercase tracking-widest text-white/25 mb-1.5">Details</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{result.entity}</span> ({result.type}) · {result.connections.length} connections · Last updated {result.updated}
                    </p>
                    <div className="mt-2 flex gap-1.5">
                      {result.connections.map((c) => (
                        <span key={c} className="rounded border border-ping-purple/30 bg-ping-purple/10 px-1.5 py-0.5 text-2xs text-ping-purple">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
