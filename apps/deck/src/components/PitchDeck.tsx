import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Radio, Cog, Search, Target, CheckCircle, RefreshCw, Puzzle, Calendar } from "lucide-react";

/* --- PRIMITIVES --- */
function Tag({ children, color = "indigo" }: { children: React.ReactNode; color?: string }) {
  const c: Record<string, string> = {
    indigo: "text-indigo-400 border-indigo-500/25 bg-indigo-500/8",
    emerald: "text-emerald-400 border-emerald-500/25 bg-emerald-500/8",
    amber: "text-amber-400 border-amber-500/25 bg-amber-500/8",
    rose: "text-rose-400 border-rose-500/25 bg-rose-500/8",
    violet: "text-violet-400 border-violet-500/25 bg-violet-500/8",
    sky: "text-sky-400 border-sky-500/25 bg-sky-500/8",
  };
  return <span className={`inline-block font-semibold tracking-[0.14em] text-[11px] uppercase border px-3 py-1 rounded-full ${c[color]}`}>{children}</span>;
}

function S({ id, idx, children, wide = false, stretch = false }: { id: string; idx: number; children: React.ReactNode; wide?: boolean; stretch?: boolean }) {
  return (
    <section id={id} data-idx={idx} className={`snap-start snap-always h-[100dvh] flex flex-col items-center px-4 md:px-8 relative ${stretch ? "justify-between py-10 md:py-14" : "justify-center py-8 md:py-10"}`}>
      <div className={`w-full ${wide ? "max-w-7xl" : "max-w-5xl"} ${stretch ? "flex flex-col h-full" : ""}`}>{children}</div>
    </section>
  );
}

function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ type: "spring", stiffness: 70, damping: 18, delay }}
      viewport={{ once: false, amount: 0.2 }}
      className={className}>
      {children}
    </motion.div>
  );
}

const NAV = ["Cover","Founders","Problem","Cost","Solution","How","vs. Slack","Business Model","Market","GTM","Connect"];

function Nav({ idx }: { idx: number }) {
  return (
    <nav className="fixed right-3 md:right-5 top-1/2 -translate-y-1/2 z-50 flex-col gap-2 hidden md:flex" aria-label="Slides">
      {NAV.map((label, i) => (
        <button key={i} title={label}
          onClick={() => document.getElementById(`s${i}`)?.scrollIntoView({ behavior: "smooth" })}
          className={`rounded-full transition-all duration-300 ${i === idx ? "w-1.5 h-5 bg-white" : "w-1.5 h-1.5 bg-neutral-700 hover:bg-neutral-500"}`}
        />
      ))}
    </nav>
  );
}

/* ══ SLIDE 0 - COVER ══ */
function Cover() {
  return (
    <S id="s0" idx={0}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.15, 1], x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.18) 0%, transparent 70%)" }}
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], x: [0, -50, 30, 0], y: [0, 40, -20, 0] }}
          transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(139,92,246,0.14) 0%, transparent 70%)" }}
        />
        <motion.svg
          animate={{ rotate: 360 }}
          transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[640px] opacity-[0.07]"
          viewBox="0 0 200 200">
          {[0,1,2,3,4,5,6,7].map(i => {
            const a = (i / 8) * Math.PI * 2;
            const x = 100 + 85 * Math.cos(a);
            const y = 100 + 85 * Math.sin(a);
            const nx = 100 + 85 * Math.cos(a + Math.PI * 2 / 8);
            const ny = 100 + 85 * Math.sin(a + Math.PI * 2 / 8);
            return <g key={i}>
              <circle cx={x} cy={y} r="4" fill="#818cf8"/>
              <line x1={x} y1={y} x2={nx} y2={ny} stroke="#4f46e5" strokeWidth="0.5"/>
              <line x1={x} y1={y} x2="100" y2="100" stroke="#4f46e5" strokeWidth="0.3"/>
            </g>;
          })}
          <circle cx="100" cy="100" r="6" fill="#6366f1"/>
        </motion.svg>
      </div>
      <div className="relative text-center">
        <FadeUp delay={0.05}>
          <motion.h1
            className="text-[2.6rem] md:text-[4.5rem] lg:text-[6.5rem] font-semibold tracking-tight leading-[0.92] mb-5 md:mb-7"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.01 }}>
            <motion.span
              className="text-white inline-block"
              initial={{ clipPath: "inset(0 100% 0 0)" }}
              animate={{ clipPath: "inset(0 0% 0 0)" }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}>
              Service firms don&apos;t
            </motion.span>
            <br />
            <motion.span
              className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent inline-block"
              initial={{ clipPath: "inset(0 100% 0 0)" }}
              animate={{ clipPath: "inset(0 0% 0 0)" }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.55 }}>
              scale decisions.
            </motion.span>
          </motion.h1>
        </FadeUp>
        <FadeUp delay={0.9}>
          <p className="text-neutral-400 text-base md:text-xl max-w-xl mx-auto leading-relaxed">
            OpenPing removes coordination overhead so delivery teams handle more clients, close decisions faster, and grow without adding operations headcount.
          </p>
        </FadeUp>
        <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
          className="mt-14 md:mt-16 flex flex-col items-center gap-1.5 text-neutral-700">
          <span className="text-[10px] tracking-[0.2em] uppercase">scroll</span>
          <div className="w-px h-6 bg-gradient-to-b from-neutral-700 to-transparent" />
        </motion.div>
      </div>
    </S>
  );
}

/* ── Company wordmark logos (inline SVG, grayscale) ── */
function CompanyLogo({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className="h-7 w-auto opacity-70 hover:opacity-100 transition-opacity"
      loading="lazy"
    />
  );
}
function LogoKPMG() { return <CompanyLogo src="/logos/kpmg.png" alt="KPMG" />; }
function LogoBCG() { return <CompanyLogo src="/logos/bcg.png" alt="BCG" />; }
function LogoMARS() { return <CompanyLogo src="/logos/mars.png" alt="MARS" />; }
function LogoRemitly() { return <CompanyLogo src="/logos/remitly.png" alt="Remitly" />; }
function LogoPrintify() { return <CompanyLogo src="/logos/printify.png" alt="Printify" />; }
function Logo8lines() { return <CompanyLogo src="/logos/8lines.png" alt="8lines" />; }

/* ══ SLIDE 1 - FOUNDERS ══ */
function Founders() {
  const founders = [
    {
      initials: "RW",
      name: "Rafal Wyderka",
      role: "CEO / Product",
      photo: "/photos/rafal.jpg",
      color: "from-indigo-500 to-violet-500",
      logos: [<LogoRemitly key="r" />, <LogoKPMG key="k" />, <LogoBCG key="b" />, <LogoMARS key="m" />],
      highlights: [
        "Lived the problem: coordination collapsed across 5 time zones at Remitly",
        "Shipped AI-first products from zero (ppmlx, Halpy.me)",
        "Ops DNA from KPMG, BCG, MARS - knows how teams work at scale",
      ],
    },
    {
      initials: "KA",
      name: "Konrad Alfaro",
      role: "CTO / Engineering",
      photo: "/photos/konrad.jpg",
      color: "from-emerald-500 to-sky-500",
      logos: [<LogoPrintify key="p" />, <Logo8lines key="8" />],
      highlights: [
        "Scaled infra at Printify (millions of merchants)",
        "Founded 8lines: AI-driven agency shipping real systems",
        "Open-source contributor & conference speaker - ships fast",
      ],
    },
  ];
  return (
    <S id="s1" idx={1} wide>
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.06),transparent_60%)]" />
      </div>
      <FadeUp className="mb-8 text-center">
        <Tag color="indigo">Founders</Tag>
        <h2 className="mt-4 text-[2rem] md:text-[3rem] lg:text-[3.8rem] font-semibold tracking-tight leading-[1.02] text-white">
          We lived the problem.<br /><span className="text-indigo-400">Now we're building the models to fix it.</span>
        </h2>
      </FadeUp>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 max-w-4xl mx-auto mb-6">
        {founders.map((f, i) => (
          <FadeUp key={i} delay={i * 0.1}>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5 md:p-7 h-full flex flex-col">
              <div className="flex items-center gap-4 mb-4">
                {f.photo ? (
                  <img src={f.photo} alt={f.name} className="w-14 h-14 rounded-full object-cover shrink-0" />
                ) : (
                  <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${f.color} flex items-center justify-center text-white text-lg font-bold shrink-0`}>
                    {f.initials}
                  </div>
                )}
                <div>
                  <p className="text-lg font-semibold text-white">{f.name}</p>
                  <p className="text-sm text-neutral-500">{f.role}</p>
                </div>
              </div>
              {/* Company logos strip */}
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-neutral-800/60 flex-wrap">
                {f.logos}
              </div>
              <ul className="space-y-2.5 flex-1">
                {f.highlights.map((h, j) => (
                  <li key={j} className="text-sm text-neutral-400 flex gap-2.5 leading-relaxed">
                    <span className="text-neutral-700 shrink-0 mt-0.5">-</span>{h}
                  </li>
                ))}
              </ul>
            </div>
          </FadeUp>
        ))}
      </div>
      <FadeUp delay={0.25}>
        <div className="max-w-3xl mx-auto p-4 rounded-xl border border-indigo-900/30 bg-indigo-950/10 text-center">
          <p className="text-sm text-neutral-400 leading-relaxed">
            Serial entrepreneurs. Both from Łódź, Poland.{" "}
            We don&apos;t just use AI tools — we build entire products with AI as a co-creator.{" "}
            <span className="text-indigo-300">OpenPing is built the way software will be built: small team, AI-native from day one, shipping 10x faster than legacy approaches.</span>
          </p>
        </div>
      </FadeUp>
    </S>
  );
}

/* ══ SLIDE 2 - THE COORDINATION PROBLEM ══ */
function CoordProblem() {
  return (
    <S id="s2" idx={2} wide>
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(225,29,72,0.06),transparent_60%)]" />
      </div>
      <FadeUp>
        <Tag color="rose">The Coordination Problem</Tag>
        <h2 className="mt-4 text-[2.4rem] md:text-[3.2rem] lg:text-[4.2rem] font-semibold tracking-tight leading-[1.02] text-white mb-5">
          Senior people spend their days<br /><span className="text-rose-400">moving information</span><br />instead of using it.
        </h2>
        <p className="text-neutral-400 text-base md:text-lg leading-relaxed max-w-3xl mb-8">
          Every service firm hits the same wall: the more clients you take on, the more time your best people spend chasing status, reconstructing context, and sitting in alignment meetings that should have been decisions. This overhead grows faster than revenue — and it&apos;s invisible on a P&L.
        </p>
      </FadeUp>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl">
        {[
          { icon: "🔄", title: "Status chasing", body: "Delivery leads spend hours every day asking 'where are we on X?' across Slack, email, and meetings. The answer exists — it's just scattered." },
          { icon: "🧩", title: "Context loss", body: "Every handoff, every new person on a thread, every project switch — context evaporates. Rebuilding it is the real cost of multitasking." },
          { icon: "📅", title: "Meeting overhead", body: "Most alignment meetings exist because no one trusts the async channel to produce a decision. The meeting becomes the decision tool of last resort." },
        ].map((item, i) => (
          <FadeUp key={i} delay={0.1 + i * 0.08}>
            <div className="p-5 rounded-2xl border border-neutral-800 bg-neutral-950 h-full">
              <div className="text-2xl mb-3">{item.icon}</div>
              <p className="text-sm font-semibold text-white mb-2">{item.title}</p>
              <p className="text-xs text-neutral-500 leading-relaxed">{item.body}</p>
            </div>
          </FadeUp>
        ))}
      </div>
    </S>
  );
}

/* ══ SLIDE 3 - LOST REVENUE AND HIDDEN COSTS ══ */
function LostRevenue() {
  return (
    <S id="s3" idx={3} wide stretch>
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute bottom-0 left-[-20%] w-[800px] h-[800px] bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.05),transparent_60%)]" />
      </div>
      <FadeUp className="mb-6">
        <Tag color="amber">Lost Revenue and Hidden Costs</Tag>
        <h2 className="mt-4 text-[2rem] md:text-[2.8rem] lg:text-[3.2rem] font-semibold tracking-tight leading-[1.02] text-white">
          The real cost isn&apos;t ops headcount.<br /><span className="text-amber-400">It&apos;s the revenue you can&apos;t reach.</span>
        </h2>
      </FadeUp>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5">
        {[
          { metric: "$180k+", label: "Cost of 1 coordination FTE", sub: "Loaded salary + management overhead for a single ops coordinator", color: "text-rose-400" },
          { metric: "1 in 3", label: "Senior hours lost", sub: "Not on delivery — on tracking, chasing, and re-assembling context across disconnected tools", color: "text-amber-400" },
          { metric: "74% / 22%", label: "The AI productivity gap", sub: "74% of workers say AI helps individually. Only 22% of firms see org-level gains. Coordination absorbs the rest.", color: "text-orange-400" },
          { metric: "~40%", label: "Revenue capacity gap", sub: "Delivery leads bottlenecked by coordination handle fewer accounts. That latent capacity is the real loss.", color: "text-red-400" },
        ].map((c, i) => (
          <FadeUp key={i} delay={i * 0.08}>
            <div className="p-4 md:p-6 rounded-2xl border border-neutral-800 bg-neutral-950 h-full flex flex-col">
              <div className={`text-2xl md:text-3xl lg:text-4xl font-bold mb-2 ${c.color}`}>{c.metric}</div>
              <p className="text-xs md:text-sm font-semibold text-white mb-1.5">{c.label}</p>
              <p className="text-xs text-neutral-600 leading-relaxed mt-auto hidden md:block">{c.sub}</p>
            </div>
          </FadeUp>
        ))}
      </div>
      <FadeUp delay={0.35}>
        <div className="p-4 md:p-5 rounded-xl border border-amber-900/30 bg-amber-950/10">
          <p className="text-sm text-neutral-400 leading-relaxed">
            We saw this at Remitly and heard the same from colleagues running agencies, consultancies, and software houses.{" "}
            AI makes individuals faster — but it can&apos;t close decisions, follow through on commitments, or route the right question to the right person.{" "}
            <span className="text-white font-medium">Senior people absorb the gap. Growth stalls.</span>
          </p>
        </div>
        <p className="text-[11px] text-neutral-700 tracking-wide mt-3 font-light">Sources: BLS Occupational Employment and Wage Statistics, 2025 — McKinsey &quot;The State of AI in 2025&quot; — our direct experience across delivery teams</p>
      </FadeUp>
    </S>
  );
}

/* ══ SLIDE 4 - WHAT OPENPING DOES ══ */
function WhatWeDo() {
  return (
    <S id="s4" idx={4} wide stretch>
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[20%] right-[-10%] w-[700px] h-[700px] bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.05),transparent_60%)]" />
      </div>
      <FadeUp className="mb-5">
        <Tag color="emerald">What OpenPing Does</Tag>
        <h2 className="mt-4 text-[2rem] md:text-[2.8rem] lg:text-[3.2rem] font-semibold tracking-tight leading-[1.02] text-white">
          Reads all communication.<br />Extracts what matters.<br /><span className="text-emerald-400">Closes the loop.</span>
        </h2>
      </FadeUp>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {[
          { head: "Works with existing tools — best in ours", body: "Connects to Slack, Teams, email. Full coordination intelligence activates in OpenPing's native workspace." },
          { head: "Every ask reaches the right person", body: "Delivery leads make decisions. The system handles routing, context retrieval, and follow-through." },
          { head: "Messages, files, and connected data", body: "Not just chat. OpenPing reads documents, ticket systems, and data sources to build a complete picture." },
        ].map((c, i) => (
          <FadeUp key={i} delay={0.05 + i * 0.06}>
            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950 h-full">
              <p className="text-sm font-semibold text-white mb-1.5">{c.head}</p>
              <p className="text-xs text-neutral-600 leading-relaxed">{c.body}</p>
            </div>
          </FadeUp>
        ))}
      </div>
      <div className="hidden lg:grid grid-cols-5 gap-0 relative">
        <div className="absolute top-[48px] left-[10%] right-[10%] h-px bg-gradient-to-r from-indigo-600/30 via-violet-600/30 to-emerald-600/30 z-0" />
        {[
          { n: "01", title: "Signal Detection", detail: "Every message and data source scanned for coordination signals.", icon: "📡", color: "border-indigo-800/50 bg-indigo-950/20" },
          { n: "02", title: "Decision Extraction", detail: "Commitments, blockers, decisions classified with actor and confidence.", icon: "⚙", color: "border-violet-800/50 bg-violet-950/20" },
          { n: "03", title: "Gap Detection", detail: "Missing context identified. One precise question routed to the right person.", icon: "🔍", color: "border-purple-800/50 bg-purple-950/20" },
          { n: "04", title: "Judgment Surface", detail: "Delivery leads see only what needs human judgment.", icon: "🎯", color: "border-emerald-800/50 bg-emerald-950/20" },
          { n: "05", title: "Follow-Through", detail: "Commitments tracked. Slips surfaced before the client notices.", icon: "✅", color: "border-emerald-700/50 bg-emerald-900/10" },
        ].map((step, i) => (
          <FadeUp key={i} delay={i * 0.07}>
            <div className={`relative z-10 flex flex-col items-center text-center p-3 rounded-xl border ${step.color} mx-1 h-full`}>
              <div className="w-10 h-10 rounded-full border border-neutral-800 bg-neutral-950 flex items-center justify-center text-lg mb-2">{step.icon}</div>
              <span className="text-[10px] text-neutral-700 font-mono mb-1">{step.n}</span>
              <p className="text-xs font-semibold text-white mb-1.5 leading-snug">{step.title}</p>
              <p className="text-[11px] text-neutral-500 leading-relaxed">{step.detail}</p>
            </div>
          </FadeUp>
        ))}
      </div>
    </S>
  );
}

/* ══ SLIDE 5 - HOW WE DELIVER ══ */
function HowWeDeliver() {
  const engines = [
    { title: "Temporal Decision Graph", badge: "BUILT", badgeColor: "text-emerald-400", accent: "border-emerald-700/50 bg-emerald-950/10",
      points: ["Directed temporal hypergraph of decision units", "Causal, dependency, precedence edges over time", "Replay and attribution built-in"] },
    { title: "Decision Control System", badge: "BUILT", badgeColor: "text-emerald-400", accent: "border-emerald-700/50 bg-emerald-950/10",
      points: ["Four primitives: Reply, Rewind, Improve, Train", "Patch any decision, re-evaluate downstream", "Outcomes feed labeled training data"] },
    { title: "On-the-Fly Embedding Pipeline", badge: "BUILT", badgeColor: "text-emerald-400", accent: "border-emerald-700/50 bg-emerald-950/10",
      points: ["All inputs embedded continuously, under 80ms p95", "Hybrid dense/sparse retrieval, per-org namespace", "Streaming incremental — no batch reprocessing"] },
    { title: "Open Data Model", badge: "BUILT", badgeColor: "text-emerald-400", accent: "border-emerald-700/50 bg-emerald-950/10",
      points: ["Open schema, no storage-layer lock-in", "Full export, external query, third-party integration", "Air-gapped deployments supported"] },
    { title: "Offline Inference — ppmlx", badge: "IN PROGRESS", badgeColor: "text-amber-400", accent: "border-amber-700/50 bg-amber-950/10",
      points: ["TurboQuant compression, speculative decoding", "On-device inference for air-gapped environments", "CRDT sync for intermittent connectivity"] },
    { title: "Pre-Formalization Signal Layer", badge: "IN PROGRESS", badgeColor: "text-amber-400", accent: "border-amber-700/50 bg-amber-950/10",
      points: ["Captures signals before formalization occurs", "Distinguishes commitment, intent, blocker, complaint", "Per-org classifier fine-tuning"] },
  ];
  return (
    <S id="s5" idx={5} wide stretch>
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute bottom-[-10%] left-[10%] w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.06),transparent_60%)]" />
      </div>
      <FadeUp className="mb-6">
        <Tag color="violet">How We Deliver</Tag>
        <h2 className="mt-4 text-[2rem] md:text-[2.8rem] lg:text-[3.2rem] font-semibold tracking-tight leading-[1.02] text-white">
          Purpose-built infrastructure<br /><span className="text-violet-400">for coordination intelligence.</span>
        </h2>
      </FadeUp>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {engines.map((e, i) => (
          <FadeUp key={i} delay={i * 0.05}>
            <div className={`rounded-2xl border p-4 md:p-5 h-full ${e.accent}`}>
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-semibold text-white pr-2">{e.title}</h3>
                <span className={`text-[9px] font-bold tracking-widest border border-current rounded-full px-2 py-0.5 shrink-0 opacity-60 ${e.badgeColor}`}>{e.badge}</span>
              </div>
              <ul className="space-y-1.5">
                {e.points.map((p, j) => (
                  <li key={j} className="text-xs text-neutral-500 flex gap-2 leading-relaxed">
                    <span className="text-neutral-700 shrink-0 mt-0.5">-</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          </FadeUp>
        ))}
      </div>
    </S>
  );
}

/* ══ SLIDE 6 - VS SLACK + AI ══ */
function VsStatusQuo() {
  const dims = [
    { dim: "Core unit", slack: "Message", ping: "Decision" },
    { dim: "AI role", slack: "Feature (reactive)", ping: "Structural layer (proactive)" },
    { dim: "Data model", slack: "Messages / threads", ping: "Decisions / commitments" },
    { dim: "Follow-through", slack: "Manual — falls on PM", ping: "Orchestrated automatically" },
    { dim: "Context on handoff", slack: "Lost after every handoff", ping: "Captured at source" },
    { dim: "Success metric", slack: "Messages sent", ping: "Decisions resolved" },
  ];
  return (
    <S id="s6" idx={6} wide stretch>
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[30%] left-[50%] -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.04),transparent_60%)]" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-end flex-1">
        <FadeUp>
          <Tag color="amber">Why Not Slack + AI?</Tag>
          <h2 className="mt-4 text-[2rem] md:text-[2.8rem] lg:text-[3.2rem] font-semibold tracking-tight leading-[1.02] text-white mb-4">
            Slack helps teams communicate.<br />OpenPing helps them<br /><span className="text-amber-400">coordinate outcomes.</span>
          </h2>
          <div className="p-4 md:p-5 rounded-xl border border-neutral-800 bg-neutral-950">
            <p className="text-sm text-neutral-300 leading-relaxed mb-3">
              Today&apos;s &quot;Slack + AI&quot; solutions are wrappers — tools like <span className="text-white font-medium">OpenClaw</span> or <span className="text-white font-medium">GetViktor</span> bolt AI onto existing chat.
              They summarize threads, answer questions about history. Useful, but they don&apos;t change the structure.
            </p>
            <p className="text-sm text-neutral-300 leading-relaxed">
              <span className="text-white font-medium">No product owns the decision and follow-through layer.</span>{" "}
              That gap is the control plane OpenPing occupies.
            </p>
          </div>
        </FadeUp>
        <FadeUp delay={0.12}>
          <div className="overflow-x-auto rounded-2xl border border-neutral-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left p-3 text-neutral-700 font-medium uppercase tracking-widest text-[10px]">Dimension</th>
                  <th className="text-left p-3 text-neutral-600 font-medium">Slack + AI</th>
                  <th className="text-left p-3 text-emerald-600 font-medium">OpenPing</th>
                </tr>
              </thead>
              <tbody>
                {dims.map((row, i) => (
                  <tr key={i} className="border-b border-neutral-900 last:border-b-0">
                    <td className="p-3 text-neutral-600 text-[10px] uppercase tracking-wide font-medium">{row.dim}</td>
                    <td className="p-3 text-neutral-500">{row.slack}</td>
                    <td className="p-3 text-emerald-400 font-medium">{row.ping}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeUp>
      </div>
    </S>
  );
}

/* ══ SLIDE 7 - BUSINESS MODEL ══ */
function Pricing() {
  return (
    <S id="s7" idx={7} wide stretch>
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 right-0 w-[600px] h-[800px] bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.05),transparent_60%)]" />
      </div>
      <FadeUp className="mb-6">
        <Tag color="sky">Business Model</Tag>
        <h2 className="mt-4 text-[2rem] md:text-[2.8rem] lg:text-[3.2rem] font-semibold tracking-tight leading-[1.02] text-white">
          Three revenue engines.<br /><span className="text-sky-400">Open core. Success-based. Proprietary data.</span>
        </h2>
        <p className="mt-3 text-neutral-500 text-sm max-w-2xl leading-relaxed">
          We don't sell seats. We capture value at every layer - from free adoption to outcomes customers pay to keep.
        </p>
      </FadeUp>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-5">
        {[
          { tier: "Open Core", label: "Adoption engine",
            icon: <svg className="w-6 h-6 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>,
            features: [
              "Open-source workspace interface - free forever",
              "Community-driven adoption, zero CAC",
              "Users own their data, no lock-in fear",
              "Conversion trigger: teams hit coordination limits",
            ],
            accent: "border-neutral-700", highlight: false },
          { tier: "Success-Based", label: "Revenue engine",
            icon: <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>,
            features: [
              "Priced on outcomes, not seats",
              "Coordination control suite - decisions tracked to resolution",
              "Customers pay because it works, not because they're locked in",
              "Compared against headcount ($180k+), not software ($12/seat)",
            ],
            accent: "border-indigo-700/60", highlight: true },
          { tier: "Proprietary Data", label: "Moat engine",
            icon: <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>,
            features: [
              "Every conversation builds the org knowledge graph",
              "Classifiers improve with usage - proprietary training data",
              "ppmlx on-device inference cuts cost 4-6x vs API",
              "Data compounds into an unforkable moat",
            ],
            accent: "border-emerald-700/60", highlight: false },
        ].map((t, i) => (
          <FadeUp key={i} delay={i * 0.08}>
            <div className={`rounded-2xl border p-5 md:p-6 h-full flex flex-col ${t.accent} ${t.highlight ? "bg-indigo-950/15 ring-1 ring-indigo-600/20" : "bg-neutral-950"}`}>
              <div className="mb-4">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-[10px] text-neutral-600 uppercase tracking-widest font-medium mb-1">{t.label}</p>
                  <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 shrink-0">{t.icon}</div>
                </div>
                <span className="text-xl md:text-2xl font-bold text-white">{t.tier}</span>
              </div>
              <ul className="space-y-1.5 flex-1 mt-2">
                {t.features.map((f, j) => (
                  <li key={j} className="text-xs text-neutral-500 flex gap-2 items-start"><span className="text-emerald-600 shrink-0 mt-0.5">+</span><span className="leading-snug">{f}</span></li>
                ))}
              </ul>
            </div>
          </FadeUp>
        ))}
      </div>
      <FadeUp delay={0.28}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950">
            <p className="text-sm font-semibold text-white mb-1.5">Services are the new software</p>
            <p className="text-xs text-neutral-500 leading-relaxed">AI lets us deliver outcomes directly - not tools for professionals to use. PING replaces coordination labor, not just coordination software.</p>
          </div>
          <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950">
            <p className="text-sm font-semibold text-white mb-1.5">Path to software margins</p>
            <p className="text-xs text-neutral-500 leading-relaxed">Start with high-touch onboarding (services revenue). As the model learns each org, automation increases and margins converge to 70%+ software margins at scale.</p>
          </div>
        </div>
      </FadeUp>
    </S>
  );
}

/* ══ SLIDE 8 - MARKET ══ */
function Market() {
  return (
    <S id="s8" idx={8} wide stretch>
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute bottom-0 left-[20%] w-[700px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.04),transparent_60%)]" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-end flex-1">
        <FadeUp>
          <Tag color="amber">Market</Tag>
          <h2 className="mt-4 text-[2rem] md:text-[2.8rem] lg:text-[3.2rem] font-semibold tracking-tight leading-[1.02] text-white mb-4">
            <span className="text-amber-400 drop-shadow-md">$6 of services</span><br />per every <span className="text-emerald-400 drop-shadow-md">$1 of software.</span>
          </h2>
          <p className="text-neutral-500 text-sm leading-relaxed mb-6">
            OpenPing competes for the headcount budget that exists solely to coordinate delivery. That budget is 10x larger than any software line — and has no incumbent.
          </p>
          <div className="space-y-3">
            {[
              { label: "ICP", bullets: ["Founder, COO, Head of Delivery","50-300 person headcount","Multiple clients sharing experts"] },
              { label: "Beachhead", bullets: ["~50,000 US agencies & consultancies","Software houses in 50-300 range"] },
              { label: "ACV", bullets: ["$24k-$150k starting range","Priced against coordination headcount"] },
              { label: "Verticals", bullets: ["Digital agencies & Consultancies","Software houses & Implementation partners","Managed services"] },
            ].map((r, i) => (
              <div key={i} className="flex gap-4 py-3 border-b border-neutral-900/50 last:border-b-0">
                <span className="text-[10px] text-amber-500/80 uppercase tracking-widest font-bold w-16 shrink-0 pt-0.5">{r.label}</span>
                <ul className="space-y-1">
                  {r.bullets.map((b, j) => (
                    <li key={j} className="text-xs text-neutral-400 flex items-start gap-2">
                      <span className="text-amber-800 shrink-0 mt-[3px]">•</span>
                      <span className="leading-snug">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-neutral-700 tracking-wide mt-3 font-light">Source: US Census Bureau — Business Formation Statistics 2024</p>
        </FadeUp>
        <FadeUp delay={0.15}>
          <div className="space-y-3 md:space-y-4">
            {[
              { label: "Beachhead — US only", sub: "~50k agencies + consultancies, 50-300 people. $24k ACV floor.", value: "$1.2B", pct: 15, color: "bg-amber-600", textColor: "text-amber-400" },
              { label: "5-Year SAM", sub: "All delivery-heavy professional services globally.", value: "$12-15B", pct: 45, color: "bg-amber-500", textColor: "text-amber-300" },
              { label: "Platform TAM", sub: "Coordination headcount budget across all professional services.", value: "$100B+", pct: 100, color: "bg-yellow-400", textColor: "text-yellow-300" },
            ].map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }} viewport={{ once: false, amount: 0.4 }}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-sm font-semibold text-white">{m.label}</span>
                  <span className={`text-base md:text-lg font-bold ${m.textColor}`}>{m.value}</span>
                </div>
                <p className="text-xs text-neutral-600 mb-2 leading-snug">{m.sub}</p>
                <div className="h-5 rounded-full bg-neutral-900 overflow-hidden">
                  <motion.div initial={{ width: 0 }} whileInView={{ width: `${m.pct}%` }}
                    transition={{ duration: 1, delay: 0.2 + i * 0.15, ease: "easeOut" }} viewport={{ once: false, amount: 0.5 }}
                    className={`h-full rounded-full ${m.color} opacity-70`} />
                </div>
              </motion.div>
            ))}
            <div className="mt-4 p-4 rounded-xl border border-neutral-800 bg-neutral-950">
              <p className="text-xs text-neutral-500 leading-relaxed">At <strong className="text-white">1% penetration</strong> of the US beachhead: <strong className="text-white">$12M ARR</strong>. At 5%: $60M. The market is underpenetrated and the buyer is motivated.</p>
            </div>
          </div>
        </FadeUp>
      </div>
    </S>
  );
}

/* ══ SLIDE 9 - PLANNED GTM MOTION ══ */
function PlannedGTM() {
  const phases = [
    { n: "01", title: "Design Partners (now)",
      body: "3-5 agencies and consultancies using OpenPing hands-on. We deploy, sit alongside their delivery leads, and iterate weekly. Goal: prove the coordination layer saves senior time measurably.",
      status: "Active", statusColor: "text-emerald-400 border-emerald-800", color: "bg-emerald-500" },
    { n: "02", title: "Founder-led sales (Q3 2026)",
      body: "Convert design partners to paying customers. Use their results as case studies. Direct outreach to Heads of Delivery and COOs at 50-300 person agencies. No SDRs — founders close every deal.",
      status: "Next", statusColor: "text-amber-400 border-amber-800", color: "bg-amber-500" },
    { n: "03", title: "Community + open-source traction (Q4 2026)",
      body: "Open-source workspace drives developer adoption. Self-hosted free tier creates awareness. Best teams hit the coordination ceiling and convert to paid.",
      status: "Planned", statusColor: "text-neutral-500 border-neutral-700", color: "bg-neutral-600" },
    { n: "04", title: "Channel partnerships (2027)",
      body: "Consultancy networks, agency alliances, and implementation partners become distribution. Every deployment generates referral signal from adjacent firms.",
      status: "Planned", statusColor: "text-neutral-500 border-neutral-700", color: "bg-neutral-600" },
  ];
  return (
    <S id="s9" idx={9} wide>
      <FadeUp className="mb-6">
        <Tag color="emerald">Planned GTM Motion</Tag>
        <h2 className="mt-4 text-[2rem] md:text-[2.8rem] lg:text-[3.2rem] font-semibold tracking-tight leading-[1.02] text-white">
          Founder-led. Then<br /><span className="text-emerald-400">product-led. Then partner-led.</span>
        </h2>
      </FadeUp>
      <div className="space-y-4 max-w-4xl mx-auto w-full">
        {phases.map((f, i) => (
          <FadeUp key={i} delay={i * 0.08}>
            <div className="grid grid-cols-1 lg:grid-cols-[70px_1fr_100px] gap-4 md:gap-8 p-5 md:p-7 rounded-3xl border border-neutral-800 bg-neutral-950/80 backdrop-blur-sm items-center hover:bg-neutral-900/80 transition-colors">
              <div className="text-4xl md:text-5xl font-light text-neutral-800 tracking-tighter hidden lg:block">{f.n}</div>
              <div className="flex flex-col">
                <div className="flex items-center gap-3 mb-2 lg:hidden">
                  <span className="text-lg font-bold text-neutral-700">{f.n}</span>
                </div>
                <h3 className="text-lg md:text-xl font-medium text-white mb-2 leading-snug">{f.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{f.body}</p>
              </div>
              <div className="flex lg:flex-col justify-between lg:justify-center items-center gap-3 lg:gap-1.5 w-full mt-3 lg:mt-0">
                <span className={`text-[10px] font-bold tracking-widest border rounded-full px-3 py-1 ${f.statusColor}`}>{f.status}</span>
              </div>
            </div>
          </FadeUp>
        ))}
      </div>
    </S>
  );
}

/* ══ SLIDE 10 - CONTACT ══ */
function Contact() {
  return (
    <S id="s10" idx={10}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.03),transparent)]" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, type: "spring", stiffness: 50 }} viewport={{ once: false, amount: 0.4 }} className="w-full max-w-3xl flex flex-col items-center justify-center min-h-[50vh]">

        <FadeUp delay={0.1}>
          <h2 className="text-[2.2rem] md:text-[3rem] lg:text-[4rem] font-semibold text-white tracking-tight leading-[1.05] text-center mb-6">
            A new infrastructure<br />layer is forming.<br />
            <span className="bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent">OpenPing is the foundation.</span>
          </h2>
        </FadeUp>

        <FadeUp delay={0.2}>
          <p className="text-base md:text-lg text-neutral-500 text-center leading-relaxed mb-12">
            The firm that controls coordination data for professional services will be infrastructure for how expert work gets delivered at scale.
          </p>
        </FadeUp>

        <FadeUp delay={0.3} className="w-full flex justify-center mb-16">
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <a href="mailto:rafal@openping.app"
              className="px-8 py-4 rounded-full bg-white text-black text-sm font-semibold hover:bg-neutral-200 transition-colors w-full sm:w-auto text-center shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              rafal@openping.app
            </a>
            <a href="https://openping.app" target="_blank" rel="noopener noreferrer"
              className="px-8 py-4 rounded-full border border-neutral-700 bg-neutral-900/50 text-neutral-300 text-sm font-medium hover:border-neutral-500 hover:text-white transition-colors w-full sm:w-auto text-center flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              openping.app
            </a>
          </div>
        </FadeUp>

        <FadeUp delay={0.4}>
          <div className="flex flex-col items-center gap-6 text-center">
            {[
              { label: "Founded", value: "2026" },
              { label: "Stage", value: "Pre-seed — Design partners" },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center justify-center">
                <div className="text-[10px] text-neutral-600 uppercase tracking-widest font-medium mb-1.5">{item.label}</div>
                <div className="text-base text-neutral-300 font-medium">{item.value}</div>
              </div>
            ))}
          </div>
        </FadeUp>
      </motion.div>
    </S>
  );
}

/* ══ ROOT ══ */
export default function PitchDeck() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const container = document.getElementById("deck");
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => { for (const e of entries) { if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.idx ?? 0)); } },
      { root: container, threshold: 0.5 }
    );
    container.querySelectorAll("[data-idx]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <div className="fixed inset-0 bg-black pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_0%,rgba(99,102,241,0.07),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_30%_at_50%_100%,rgba(16,185,129,0.04),transparent)]" />
      </div>
      <Nav idx={active} />
      <main id="deck" className="relative h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory bg-transparent text-white antialiased" style={{ scrollbarWidth: "none" }}>
        <Cover />
        <Founders />
        <CoordProblem />
        <LostRevenue />
        <WhatWeDo />
        <HowWeDeliver />
        <VsStatusQuo />
        <Pricing />
        <Market />
        <PlannedGTM />
        <Contact />
      </main>
    </>
  );
}
