"use client";

import { useState } from "react";
import { Terminal, Github, Copy, Check, ArrowRight } from "lucide-react";
import { QUICKSTART_COMMANDS, DOCS_URL, GITHUB_URL } from "./constants";
import { Section, SectionHeader, Reveal } from "./primitives";
import Link from "next/link";

export function DeveloperSection() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(QUICKSTART_COMMANDS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <Section className="border-t border-white/[0.04]">
      <SectionHeader
        eyebrow="Open source"
        title="Four commands. Full control."
        description="MIT licensed. Self-host on your own infrastructure. Fork it, extend it, contribute back. No vendor lock-in, no telemetry, no surprises."
        align="left"
      />

      <Reveal>
        <div className="max-w-2xl overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0b14] shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="font-mono text-[11px] text-muted-foreground/50">
                terminal
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-all hover:bg-white/[0.06] hover:text-white"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
          <div className="p-5 font-mono text-[13px] leading-7">
            {QUICKSTART_COMMANDS.split("\n").map((line, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="mt-px select-none text-white/15">$</span>
                <span className="text-foreground/85">{line}</span>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
          <Link
            href={`${DOCS_URL}getting-started/quickstart/`}
            className="group flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-white"
          >
            Full quickstart guide
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <span className="text-white/10">&middot;</span>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-white"
          >
            <Github className="h-3.5 w-3.5" />
            View source
          </a>
        </div>
      </Reveal>
    </Section>
  );
}
