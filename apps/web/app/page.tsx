"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "convex/react";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { api } from "@convex/_generated/api";
import { navigateToWorkspace } from "@/lib/workspace-url";
import {
  Inbox,
  BotMessageSquare,
  Bell,
  MessagesSquare,
  ArrowRight,
  Github,
  Terminal,
  Shield,
  GitFork,
  Users,
  Zap,
  Code2,
  Server,
  Loader2,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/landing/CopyButton";
import { PromptBlock } from "@/components/landing/PromptBlock";
import { GridBackground } from "@/components/landing/GridBackground";

const SPRING_TRANSITION = { type: "spring" as const, damping: 20, stiffness: 250 };
const FADE_UP_INITIAL = { opacity: 0, y: 12 };

const DOCS_URL = "https://pingcompany.github.io/platform/";
const GITHUB_URL = "https://github.com/PingCompany/Platform";

const QUICKSTART_COMMANDS = `git clone https://github.com/PingCompany/Platform.git
cd Platform
pnpm install
pnpm dev`;

const features = [
  {
    icon: Inbox,
    title: "Eisenhower Matrix Inbox",
    description:
      "AI triages every message into four quadrants — urgent & important, important, urgent, and FYI. You always know what to tackle first.",
    accent: "from-red-500/20 to-orange-500/10",
    iconColor: "text-red-400",
    border: "group-hover:border-red-500/20",
  },
  {
    icon: BotMessageSquare,
    title: "mrPING",
    description:
      "An AI assistant grounded in your team's actual conversations and docs. Ask anything — it searches your workspace knowledge graph.",
    accent: "from-ping-purple/20 to-indigo-500/10",
    iconColor: "text-ping-purple",
    border: "group-hover:border-ping-purple/20",
  },
  {
    icon: Bell,
    title: "Proactive Alerts",
    description:
      "Detects blocked tasks, unanswered questions, and stale PRs. Nudges the right people before things fall through the cracks.",
    accent: "from-amber-500/20 to-yellow-500/10",
    iconColor: "text-amber-400",
    border: "group-hover:border-amber-500/20",
  },
  {
    icon: MessagesSquare,
    title: "Real-time Messaging",
    description:
      "Channels, DMs, threads, typing indicators. A modern messenger built on a real-time sync engine — feels instant.",
    accent: "from-blue-500/20 to-cyan-500/10",
    iconColor: "text-blue-400",
    border: "group-hover:border-blue-500/20",
  },
];

const personas = [
  {
    icon: GitFork,
    title: "Open Source Purists",
    tagline: "Own your stack",
    description:
      "MIT licensed. Self-host on your infra. Fork it, extend it, contribute back. No vendor lock-in, no telemetry, no surprises.",
    accent: "text-emerald-400",
    accentBg: "bg-emerald-500/10",
    highlights: ["MIT license", "Self-hostable", "No telemetry", "Fork-friendly"],
  },
  {
    icon: Users,
    title: "Engineering Leads",
    tagline: "See what's stuck before standup",
    description:
      "AI surfaces blocked tasks, stale reviews, and unanswered questions. Know your team's real status without chasing updates.",
    accent: "text-amber-400",
    accentBg: "bg-amber-500/10",
    highlights: ["Team visibility", "Blocker alerts", "Priority triage", "Zero noise"],
  },
  {
    icon: Zap,
    title: "AI-native Developers",
    tagline: "A messenger that gets code",
    description:
      "GitHub PRs, Linear tickets, and knowledge graph search — built in. Your workspace understands your codebase.",
    accent: "text-ping-purple",
    accentBg: "bg-ping-purple/10",
    highlights: ["GitHub sync", "Linear integration", "Knowledge graph", "Agent-ready"],
  },
];

const stats = [
  { value: "4x", label: "Faster triage" },
  { value: "60%", label: "Fewer missed messages" },
  { value: "0", label: "Context switches" },
];

const techStack = [
  { name: "Next.js 15", icon: Code2 },
  { name: "Convex", icon: Server },
  { name: "WorkOS", icon: Shield },
  { name: "OpenAI", icon: Zap },
];

function GlowCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn(
          "pointer-events-none absolute -inset-px transition-opacity",
          isHovered ? "opacity-100" : "opacity-0"
        )}
        style={{
          background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, rgba(94, 106, 210, 0.06), transparent 60%)`,
        }}
      />
      {children}
    </div>
  );
}

function WorkspaceRedirect() {
  const workspaces = useQuery(api.workspaceMembers.listMyWorkspaces);
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) return;
    if (workspaces === undefined || workspaces === null) return;
    if (workspaces.length === 1) {
      redirected.current = true;
      navigateToWorkspace(workspaces[0].slug);
    }
  }, [workspaces]);

  if (workspaces === undefined || workspaces === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-white/20" />
        <p className="text-sm text-muted-foreground">
          {workspaces === null ? "Setting up your workspace…" : "Loading…"}
        </p>
      </div>
    );
  }

  if (workspaces.length === 1) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-white/20" />
      </div>
    );
  }

  const lastSlug = typeof window !== "undefined" ? localStorage.getItem("lastWorkspace") : null;
  const sorted = lastSlug
    ? [...workspaces].sort((a, b) => (a.slug === lastSlug ? -1 : b.slug === lastSlug ? 1 : 0))
    : workspaces;

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-lg font-semibold text-foreground">Your Workspaces</h1>
        <p className="mt-1 text-xs text-muted-foreground">Choose a workspace to continue</p>
      </div>
      <div className="grid w-full max-w-sm gap-2">
        {sorted.map((ws) => (
          <button
            key={ws.workspaceId}
            onClick={() => {
              localStorage.setItem("lastWorkspace", ws.slug);
              navigateToWorkspace(ws.slug);
            }}
            className="flex items-center gap-3 rounded border border-subtle bg-surface-1 px-4 py-3 text-left transition-colors hover:bg-surface-2"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded bg-ping-purple text-xs font-bold text-white">
              {ws.name[0]?.toUpperCase() ?? "W"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{ws.name}</p>
              <p className="text-2xs text-muted-foreground">{ws.slug}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-0 text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-surface-0/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="group flex items-center gap-2.5">
            <Image src="/ping-logo-white.png" alt="PING" width={24} height={24} className="group-hover:scale-105 transition-transform" />
            <span className="text-sm font-semibold tracking-tight text-white">PING</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href={DOCS_URL}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-white"
            >
              Docs
            </Link>
            <Link
              href={GITHUB_URL}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-4 w-4" />
              GitHub
            </Link>
            <span className="mx-2 h-4 w-px bg-white/[0.08]" />
            <Link
              href="/sign-in"
              className="inline-flex h-8 items-center rounded-lg bg-white px-4 text-sm font-medium text-surface-0 transition-all hover:bg-white/90 active:scale-[0.98]"
            >
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <GridBackground />
        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-24 sm:pt-32">
          <div className="grid items-center gap-16 lg:grid-cols-[1fr,auto]">
            {/* Left — copy */}
            <div>
              {/* Badge */}
              <div
                className="hero-enter mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-surface-2/80 px-3.5 py-1.5 text-xs text-muted-foreground backdrop-blur-sm"
                style={{ "--delay": "0ms" } as React.CSSProperties}
              >
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Open source &middot; Self-hostable &middot; MIT
              </div>

              {/* Headline */}
              <motion.h1
                className="max-w-2xl text-[2.75rem] font-bold leading-[1.1] tracking-tight text-white sm:text-[3.5rem]"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } }
                }}
              >
                {["Stop", "drowning", "\n", "in", "messages."].map((word, i) =>
                  word === "\n" ? (
                    <br key={i} />
                  ) : (
                    <motion.span
                      key={i}
                      className="inline-block mr-[0.25em]"
                      variants={{
                        hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
                        visible: {
                          opacity: 1,
                          y: 0,
                          filter: "blur(0px)",
                          transition: SPRING_TRANSITION
                        }
                      }}
                    >
                      {word}
                    </motion.span>
                  )
                )}
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-[15px]"
                initial={FADE_UP_INITIAL}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING_TRANSITION, delay: 0.3 }}
              >
                PING is an open-source AI workspace that triages your team&rsquo;s
                conversations, surfaces blockers, and keeps everyone in context —
                on your own infrastructure.
              </motion.p>

              {/* CTAs */}
              <motion.div
                className="mt-8 flex flex-wrap items-center gap-3"
                initial={FADE_UP_INITIAL}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING_TRANSITION, delay: 0.35 }}
              >
                <Link
                  href={`${DOCS_URL}getting-started/quickstart/`}
                  className="group/btn inline-flex h-11 items-center gap-2 rounded-lg bg-ping-purple px-6 text-sm font-medium text-white transition-all hover:bg-ping-purple-hover active:scale-[0.98]"
                >
                  Self-host in 10 min
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/sign-in"
                  className="inline-flex h-11 items-center rounded-lg border border-white/[0.1] bg-white/[0.03] px-6 text-sm font-medium text-muted-foreground transition-all hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-white"
                >
                  Try hosted version
                </Link>
              </motion.div>

              {/* Tech stack pills */}
              <motion.div
                className="mt-8 flex flex-wrap items-center gap-2"
                initial={FADE_UP_INITIAL}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING_TRANSITION, delay: 0.4 }}
              >
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50 mr-1">
                  Built with
                </span>
                {techStack.map((tech) => (
                  <span
                    key={tech.name}
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-surface-2/50 px-2.5 py-1 text-[11px] text-muted-foreground"
                  >
                    <tech.icon className="h-3 w-3" />
                    {tech.name}
                  </span>
                ))}
              </motion.div>
            </div>

            {/* Right — prompt block */}
            <div
              className="hero-enter hidden lg:block"
              style={{ "--delay": "200ms" } as React.CSSProperties}
            >
              <PromptBlock />
            </div>
          </div>

          {/* Mobile prompt block */}
          <div
            className="hero-enter mt-12 lg:hidden"
            style={{ "--delay": "300ms" } as React.CSSProperties}
          >
            <PromptBlock />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/[0.06] bg-surface-1/50">
        <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-white/[0.06] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {stats.map((stat) => (
            <div key={stat.label} className="px-8 py-5 text-center">
              <div className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">{stat.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 py-28">
          <div className="mb-14 max-w-xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-ping-purple">
              Who it&rsquo;s for
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Built for teams that ship
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              Whether you care about owning your infra, unblocking your team, or
              building with AI — PING meets you where you are.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            {personas.map((persona) => (
              <GlowCard key={persona.title} className="rounded-2xl">
                <div className="group relative h-full overflow-hidden rounded-2xl border border-white/[0.06] bg-surface-1 p-6 transition-all hover:border-white/[0.1]">
                  <div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-xl ${persona.accentBg}`}>
                    <persona.icon className={`h-5 w-5 ${persona.accent}`} />
                  </div>
                  <h3 className="text-[15px] font-semibold text-white">{persona.title}</h3>
                  <p className={`mt-0.5 text-xs font-medium ${persona.accent}`}>
                    {persona.tagline}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {persona.description}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {persona.highlights.map((h) => (
                      <span
                        key={h}
                        className="rounded-md border border-white/[0.06] bg-surface-2/60 px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              </GlowCard>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-white/[0.06] bg-surface-1/30">
        <div className="mx-auto max-w-6xl px-6 py-28">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-ping-purple">
              Features
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Every feature reduces noise
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground">
              Not another notification firehose. Every feature is designed to surface
              what matters and mute what doesn&rsquo;t.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {features.map((feature) => (
              <GlowCard key={feature.title} className="rounded-2xl">
                <div className={`group relative h-full overflow-hidden rounded-2xl border border-white/[0.06] bg-surface-1 p-7 transition-all ${feature.border}`}>
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${feature.accent} opacity-0 transition-opacity group-hover:opacity-100`} />
                  <div className="relative">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 transition-all group-hover:bg-surface-3">
                      <feature.icon className={`h-5 w-5 ${feature.iconColor}`} />
                    </div>
                    <h3 className="text-[15px] font-semibold text-white">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </GlowCard>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-6 py-28">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-ping-purple">
              How it works
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Three steps. Zero overhead.
            </h2>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Your team chats",
                body: "Channels and DMs — real-time, searchable, threaded. Works exactly like you expect.",
              },
              {
                step: "02",
                title: "AI triages everything",
                body: "Every message is scored and sorted into your personal Eisenhower inbox. Urgent stays urgent.",
              },
              {
                step: "03",
                title: "Nothing slips through",
                body: "Proactive alerts catch blockers, stale PRs, and unanswered questions before they become incidents.",
              },
            ].map((item) => (
              <div key={item.step} className="group relative">
                <div className="mb-5 font-mono text-3xl font-bold text-white/[0.06] transition-colors group-hover:text-ping-purple/20">
                  {item.step}
                </div>
                <h3 className="text-[15px] font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Self-host quickstart */}
      <section className="border-t border-white/[0.06] bg-surface-1/30">
        <div className="mx-auto max-w-6xl px-6 py-28">
          <div className="mb-10 max-w-xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-ping-purple">
              Quickstart
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Four commands. That&rsquo;s it.
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              Clone, install, and go. No vendor lock-in, no black boxes — your data
              stays where you put it.
            </p>
          </div>

          {/* Terminal block */}
          <div className="max-w-2xl overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-1 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-mono text-muted-foreground">terminal</span>
              </div>
              <CopyButton text={QUICKSTART_COMMANDS} />
            </div>
            <div className="p-5 font-mono text-sm leading-7">
              {QUICKSTART_COMMANDS.split("\n").map((line, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-px select-none text-ping-purple/60">$</span>
                  <span className="text-foreground/90">{line}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
            <Link
              href={`${DOCS_URL}getting-started/quickstart/`}
              className="group flex items-center gap-1.5 text-muted-foreground hover:text-white"
            >
              Full quickstart guide
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <span className="text-white/10">&middot;</span>
            <Link
              href={`${DOCS_URL}getting-started/installation/`}
              className="group flex items-center gap-1.5 text-muted-foreground hover:text-white"
            >
              Environment variables
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <span className="text-white/10">&middot;</span>
            <Link
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-1.5 text-muted-foreground hover:text-white"
            >
              <Github className="h-3.5 w-3.5" />
              View source
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-white/[0.06]">
        <div className="relative mx-auto max-w-6xl px-6 py-28 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to take back your focus?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-muted-foreground">
            Open source. Host it yourself or use our cloud.
            <br />
            Either way, it&rsquo;s yours.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`${DOCS_URL}getting-started/quickstart/`}
              className="group/cta inline-flex h-11 items-center gap-2 rounded-lg bg-ping-purple px-7 text-sm font-medium text-white transition-all hover:bg-ping-purple-hover active:scale-[0.98]"
            >
              Self-host for free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-7 text-sm font-medium text-muted-foreground transition-all hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-white"
            >
              <Github className="h-4 w-4" />
              Star on GitHub
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-surface-0">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-ping-purple/80 font-mono text-[9px] font-bold text-white">
              P
            </div>
            <span className="text-xs text-muted-foreground">
              &copy; 2026 Ping &middot; MIT License
            </span>
          </div>
          <div className="flex gap-5">
            <Link href={DOCS_URL} className="text-xs text-muted-foreground hover:text-white">
              Docs
            </Link>
            <Link
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-white"
            >
              GitHub
            </Link>
            <Link href="/privacy" className="text-xs text-muted-foreground hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="text-xs text-muted-foreground hover:text-white">
              Terms
            </Link>
            <Link href="/sign-in" className="text-xs text-muted-foreground hover:text-white">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <AuthLoading>
        <div className="flex h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ping-purple border-t-transparent" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <LandingPage />
      </Unauthenticated>
      <Authenticated>
        <WorkspaceRedirect />
      </Authenticated>
    </>
  );
}
