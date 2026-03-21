"use client";

import { useMemo, useState } from "react";
import {
  Search,
  GitBranch,
  Zap,
  MessageSquare,
  GitPullRequest,
  Link2,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/hooks/useAuth";

interface GraphNode {
  id: string;
  type: "github_pr" | "linear_ticket";
  label: string;
  x: number;
  y: number;
  color: string;
}

interface GraphEdge {
  from: string;
  to: string;
}

const TYPE_META = {
  github_pr: { label: "GitHub PR", icon: GitPullRequest, color: "#A855F7" },
  linear_ticket: { label: "Linear Ticket", icon: Zap, color: "#5E6AD2" },
} as const;

/** Deterministic grid layout with index-based jitter to avoid perfect alignment. */
function layoutNodes(
  objects: Array<{
    _id: string;
    type: "github_pr" | "linear_ticket";
    title: string;
    author: string;
  }>,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (objects.length === 0) return { nodes: [], edges: [] };

  const cols = Math.max(3, Math.ceil(Math.sqrt(objects.length)));
  const nodes: GraphNode[] = objects.map((obj, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const jitterX = ((i * 17) % 11) - 5;
    const jitterY = ((i * 13) % 9) - 4;
    const x = Math.min(90, Math.max(10, 15 + col * (70 / Math.max(cols - 1, 1)) + jitterX));
    const y = Math.min(90, Math.max(10, 20 + row * 25 + jitterY));

    return {
      id: obj._id,
      type: obj.type,
      label: obj.title.length > 30 ? obj.title.slice(0, 27) + "..." : obj.title,
      x,
      y,
      color: TYPE_META[obj.type].color,
    };
  });

  // Create edges between objects that share the same author
  const edges: GraphEdge[] = [];
  const authorGroups = new Map<string, string[]>();
  for (const obj of objects) {
    const group = authorGroups.get(obj.author) ?? [];
    group.push(obj._id);
    authorGroups.set(obj.author, group);
  }
  for (const ids of authorGroups.values()) {
    for (let i = 0; i < ids.length - 1 && i < 4; i++) {
      edges.push({ from: ids[i], to: ids[i + 1] });
    }
  }

  return { nodes, edges };
}

export default function KnowledgeGraphPage() {
  const [query, setQuery] = useState("");
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { workspaceId } = useAuth();

  const integrationObjects = useQuery(
    api.integrations.listByWorkspace,
    workspaceId ? { workspaceId } : "skip",
  );

  const isLoading = integrationObjects === undefined;
  const objects = useMemo(() => integrationObjects ?? [], [integrationObjects]);

  const stats = useMemo(() => {
    let prCount = 0;
    let ticketCount = 0;
    const authors = new Set<string>();
    for (const o of objects) {
      if (o.type === "github_pr") prCount++;
      else if (o.type === "linear_ticket") ticketCount++;
      authors.add(o.author);
    }
    return [
      { label: "GitHub PRs", value: prCount, color: "#A855F7", icon: GitPullRequest },
      { label: "Linear Tickets", value: ticketCount, color: "#5E6AD2", icon: Zap },
      { label: "Total Objects", value: objects.length, color: "#22C55E", icon: Link2 },
      { label: "Unique Authors", value: authors.size, color: "#E5E7EB", icon: GitBranch },
    ];
  }, [objects]);

  const { nodes, edges } = useMemo(() => layoutNodes(objects), [objects]);

  const filteredResults = useMemo(() => {
    if (!searched && query.length === 0) return [];
    const q = query.toLowerCase();
    if (q.length === 0) return objects.slice(0, 20);
    return objects
      .filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.author.toLowerCase().includes(q) ||
          o.externalId.toLowerCase().includes(q) ||
          o.status.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [objects, query, searched]);

  if (!isLoading && objects.length === 0) {
    return (
      <div className="mx-auto max-w-5xl animate-fade-in px-6 py-6">
        <div className="mb-6">
          <h1 className="text-md font-semibold text-foreground">Knowledge Graph</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Visual map of your team&apos;s connected context across all integrations
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded border border-subtle bg-surface-1 px-6 py-16 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="text-sm font-medium text-foreground">No integrations connected yet</h2>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Connect GitHub or Linear to see your knowledge graph. Integration objects will appear here
            as your team works across tools.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-in px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-md font-semibold text-foreground">Knowledge Graph</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Visual map of your team&apos;s connected context across all integrations
        </p>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded border border-subtle bg-surface-1 px-3 py-2.5">
            <div className="flex items-center gap-1.5 pb-1">
              <Icon className="h-3 w-3" style={{ color }} />
              <span className="text-2xs text-muted-foreground">{label}</span>
            </div>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {isLoading ? "-" : value.toLocaleString()}
            </p>
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
            placeholder="Search integrations... (e.g. 'auth refactor', 'ENG-441')"
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
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <span className="text-xs text-muted-foreground">Loading graph...</span>
            </div>
          ) : (
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Edges */}
              {edges.map(({ from, to }) => {
                const a = nodes.find((n) => n.id === from);
                const b = nodes.find((n) => n.id === to);
                if (!a || !b) return null;
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
              {nodes.map((node) => {
                const isHovered = hoveredNode === node.id;
                const r = 2.5;

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
                    {isHovered && (
                      <text
                        x={node.x}
                        y={node.y - r - 1.5}
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.8)"
                        fontSize="2.5"
                        fontFamily="sans-serif"
                      >
                        {node.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        <div className="border-t border-subtle px-4 py-2">
          <p className="text-2xs text-white/25">
            Hover nodes to inspect · Nodes represent integration objects · Lines connect items by
            the same author
          </p>
        </div>
      </div>

      {/* Results table */}
      {filteredResults.length > 0 && (
        <div className="animate-fade-in">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              {filteredResults.length} integration object{filteredResults.length !== 1 ? "s" : ""}
            </span>
            {query.length > 0 && (
              <span className="text-2xs text-muted-foreground">
                showing matches for &quot;{query}&quot;
              </span>
            )}
          </div>

          <div className="overflow-hidden rounded border border-subtle">
            <div className="grid grid-cols-[1fr_100px_80px_1fr] gap-4 border-b border-subtle bg-surface-1 px-4 py-2">
              {["Title", "Type", "Status", "Author"].map((h) => (
                <span
                  key={h}
                  className="text-2xs font-medium uppercase tracking-widest text-white/25"
                >
                  {h}
                </span>
              ))}
            </div>
            {filteredResults.map((result) => (
              <div key={result._id}>
                <div
                  onClick={() =>
                    setExpandedRow(expandedRow === result._id ? null : result._id)
                  }
                  className="grid cursor-pointer grid-cols-[1fr_100px_80px_1fr] items-center gap-4 border-b border-subtle px-4 py-2.5 transition-colors last:border-0 hover:bg-surface-2"
                >
                  <span className="truncate font-mono text-xs text-foreground">
                    {result.title}
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    {TYPE_META[result.type].label}
                  </span>
                  <span className="text-2xs text-muted-foreground">{result.status}</span>
                  <span className="truncate text-2xs text-white/50">{result.author}</span>
                </div>
                {expandedRow === result._id && (
                  <div className="animate-fade-in border-b border-subtle bg-surface-2 px-4 py-3">
                    <p className="mb-1.5 text-2xs font-medium uppercase tracking-widest text-white/25">
                      Details
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{result.title}</span> (
                      {TYPE_META[result.type].label}) · {result.status} · by {result.author}
                    </p>
                    {result.url && (
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-2xs text-ping-purple hover:underline"
                      >
                        <Link2 className="h-3 w-3" />
                        View in {result.type === "github_pr" ? "GitHub" : "Linear"}
                      </a>
                    )}
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
