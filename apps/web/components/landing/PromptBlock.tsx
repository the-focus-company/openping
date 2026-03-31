"use client";
import { useState } from "react";
import { Copy, Check, Sparkles } from "lucide-react";

const AGENT_PROMPT = `Help me deploy PING — an open-source AI team messenger (Slack replacement with AI triage).

1. Clone github.com/the-focus-company/openping
2. Follow the quickstart at the-focus-company.github.io/openping/getting-started/quickstart/
3. Set up Convex (backend), WorkOS (auth), and OpenAI (AI features)
4. Run \`pnpm dev\` to start locally

Read CLAUDE.md in the repo root for project conventions.`;

export function PromptBlock() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(AGENT_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="group/prompt relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-1 shadow-2xl shadow-black/40">
      {/* Glow effect on hover */}
      <div className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 group-hover/prompt:opacity-100 bg-[conic-gradient(from_230deg,#5E6AD2_0%,transparent_20%,transparent_80%,#5E6AD2_100%)] blur-sm" />
      <div className="relative rounded-2xl bg-surface-1">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-ping-purple/15">
              <Sparkles className="h-3.5 w-3.5 text-ping-purple" />
            </div>
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Paste into your AI coding agent
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:bg-white/[0.06] hover:text-white active:scale-95"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy prompt
              </>
            )}
          </button>
        </div>
        {/* Body */}
        <div className="p-5">
          <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-foreground/80 selection:bg-ping-purple/30">
            {AGENT_PROMPT}
          </pre>
        </div>
        {/* Footer hint */}
        <div className="border-t border-white/[0.04] px-5 py-2.5">
          <p className="text-[11px] text-muted-foreground/60">
            Works with Claude Code, Cursor, Windsurf, Copilot, and other AI coding agents
          </p>
        </div>
      </div>
    </div>
  );
}
