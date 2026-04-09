import { motion } from "framer-motion";
import { useEffect, useState, useRef, useCallback } from "react";
import { Radio, Cog, Search, Target, CheckCircle, Sun, Moon, ArrowRight, Zap, Brain, Route, Eye, ShieldCheck } from "lucide-react";

/* ── Neural Context Graph Background ── */
const SLIDE_PALETTES: Record<string, { idle: number[]; active: number[]; idleEdge: number[]; activeEdge: number[] }> = {
  // cover, founders, contact - indigo/violet
  default: { idle: [45, 75, 130], active: [139, 92, 246], idleEdge: [30, 58, 138], activeEdge: [139, 92, 246] },
  // red group - problem, cost
  rose: { idle: [80, 30, 50], active: [225, 29, 72], idleEdge: [60, 25, 45], activeEdge: [225, 29, 72] },
  // blue group - solution, how
  indigo: { idle: [45, 55, 130], active: [99, 102, 241], idleEdge: [35, 45, 120], activeEdge: [99, 102, 241] },
  // yellow group - vs slack, business model
  amber: { idle: [90, 65, 20], active: [245, 158, 11], idleEdge: [70, 50, 15], activeEdge: [245, 158, 11] },
  // green group - market, gtm
  emerald: { idle: [15, 70, 55], active: [16, 185, 129], idleEdge: [12, 55, 45], activeEdge: [16, 185, 129] },
};
const SLIDE_PALETTES_LIGHT: Record<string, { idle: number[]; active: number[]; idleEdge: number[]; activeEdge: number[] }> = {
  default: { idle: [148, 163, 184], active: [124, 58, 237], idleEdge: [203, 213, 225], activeEdge: [124, 58, 237] },
  rose: { idle: [180, 140, 150], active: [225, 29, 72], idleEdge: [210, 170, 180], activeEdge: [225, 29, 72] },
  indigo: { idle: [148, 153, 194], active: [79, 70, 229], idleEdge: [183, 188, 215], activeEdge: [79, 70, 229] },
  amber: { idle: [190, 165, 120], active: [217, 119, 6], idleEdge: [210, 190, 150], activeEdge: [217, 119, 6] },
  emerald: { idle: [130, 180, 160], active: [5, 150, 105], idleEdge: [170, 210, 195], activeEdge: [5, 150, 105] },
};
const SLIDE_COLOR_MAP: Record<number, string> = { 0: "default", 1: "default", 2: "rose", 3: "rose", 4: "indigo", 5: "indigo", 6: "amber", 7: "amber", 8: "emerald", 9: "emerald", 10: "default" };
// Centered slides show animation on edges; others show it in bottom-right
const CENTERED_SLIDES = new Set([0, 1, 10]);

function NeuralBackground({ activeSlide, theme }: { activeSlide: number; theme: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    neurons: { x: number; y: number; vx: number; vy: number; radius: number; baseRadius: number; activation: number }[];
    mouseActivity: number; lastMouseX: number; lastMouseY: number; lastMouseTime: number;
    lastFrameTime: number; timeSinceLastPulse: number; animId: number;
    palette: { idle: number[]; active: number[]; idleEdge: number[]; activeEdge: number[] };
    width: number; height: number;
  } | null>(null);

  const getVignette = useCallback(() => {
    const isCentered = CENTERED_SLIDES.has(activeSlide);
    const bgRgb = theme === "light" ? "248,250,252" : "0,0,0";
    if (isCentered) {
      // Center strongly masked, animation visible on edges/corners
      return `radial-gradient(ellipse 60% 50% at 50% 50%, rgba(${bgRgb},0.95) 0%, rgba(${bgRgb},0.8) 40%, rgba(${bgRgb},0.3) 75%, rgba(${bgRgb},0) 100%)`;
    }
    // Diagonal: top-left masked, bottom-right visible
    return `linear-gradient(135deg, rgba(${bgRgb},0.95) 0%, rgba(${bgRgb},0.85) 30%, rgba(${bgRgb},0.5) 60%, rgba(${bgRgb},0.1) 100%)`;
  }, [activeSlide, theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const PARTICLE_COUNT = 100;
    const MAX_DIST = 160;
    const MAX_DIST_SQ = MAX_DIST * MAX_DIST;
    const BASE_SPEED = 0.15;

    let width = window.innerWidth;
    let height = window.innerHeight;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.scale(dpr, dpr);
      if (stateRef.current) { stateRef.current.width = width; stateRef.current.height = height; }
    }
    resize();
    window.addEventListener("resize", resize);

    const neurons: { x: number; y: number; vx: number; vy: number; radius: number; baseRadius: number; activation: number }[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const r = Math.random() * 1.5 + 1;
      neurons.push({ x: Math.random() * width, y: Math.random() * height, vx: (Math.random() - 0.5) * BASE_SPEED, vy: (Math.random() - 0.5) * BASE_SPEED, radius: r, baseRadius: r, activation: 0 });
    }

    const palette = SLIDE_PALETTES.default;

    stateRef.current = { neurons, mouseActivity: 0, lastMouseX: 0, lastMouseY: 0, lastMouseTime: 0, lastFrameTime: performance.now(), timeSinceLastPulse: 0, animId: 0, palette, width, height };
    const state = stateRef.current;

    function triggerPulse() {
      const idle = state.neurons.filter(n => n.activation < 0.2);
      if (idle.length === 0) return;
      const start = idle[Math.floor(Math.random() * idle.length)];
      start.activation = 1;
      setTimeout(() => {
        for (const n of state.neurons) {
          if (n !== start && n.activation < 0.5) {
            const dx = start.x - n.x, dy = start.y - n.y;
            if (dx * dx + dy * dy < MAX_DIST_SQ) n.activation = 0.8;
          }
        }
      }, 800);
    }
    triggerPulse();

    function onMouseMove(e: MouseEvent) {
      const now = performance.now();
      if (state.lastMouseTime > 0) {
        const dt = now - state.lastMouseTime;
        const dx = e.clientX - state.lastMouseX, dy = e.clientY - state.lastMouseY;
        const speed = Math.sqrt(dx * dx + dy * dy) / Math.max(1, dt);
        state.mouseActivity = Math.min(1, state.mouseActivity + (speed / 5) * 0.4);
      }
      state.lastMouseX = e.clientX; state.lastMouseY = e.clientY; state.lastMouseTime = now;
    }
    window.addEventListener("mousemove", onMouseMove);

    function animate() {
      const now = performance.now();
      const dt = now - state.lastFrameTime;
      state.lastFrameTime = now;
      ctx!.clearRect(0, 0, state.width, state.height);

      if (state.mouseActivity > 0) { state.mouseActivity -= dt / 1000; if (state.mouseActivity < 0) state.mouseActivity = 0; }

      const pulseInterval = 3000 - state.mouseActivity * 2950;
      state.timeSinceLastPulse += dt;
      if (state.timeSinceLastPulse >= pulseInterval) { triggerPulse(); state.timeSinceLastPulse = 0; }

      const p = state.palette;
      const decay = 0.005 + state.mouseActivity * 0.015;

      for (const n of state.neurons) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -50) n.vx += 0.01; if (n.x > state.width + 50) n.vx -= 0.01;
        if (n.y < -50) n.vy += 0.01; if (n.y > state.height + 50) n.vy -= 0.01;
        if (n.activation > 0) { n.activation -= decay; if (n.activation < 0) n.activation = 0; }
        n.radius = n.baseRadius + n.activation * 2;
      }

      // Edges
      for (let i = 0; i < neurons.length; i++) {
        const n1 = neurons[i];
        for (let j = i + 1; j < neurons.length; j++) {
          const n2 = neurons[j];
          const dx = n1.x - n2.x, dy = n1.y - n2.y, dSq = dx * dx + dy * dy;
          if (dSq < MAX_DIST_SQ) {
            const dist = Math.sqrt(dSq);
            const dAlpha = 1 - dist / MAX_DIST;
            const maxAct = Math.max(n1.activation, n2.activation);
            ctx!.beginPath(); ctx!.moveTo(n1.x, n1.y); ctx!.lineTo(n2.x, n2.y);
            if (maxAct > 0.1) {
              const r = ~~(p.idleEdge[0] + (p.activeEdge[0] - p.idleEdge[0]) * maxAct);
              const g = ~~(p.idleEdge[1] + (p.activeEdge[1] - p.idleEdge[1]) * maxAct);
              const b = ~~(p.idleEdge[2] + (p.activeEdge[2] - p.idleEdge[2]) * maxAct);
              ctx!.strokeStyle = `rgba(${r},${g},${b},${dAlpha * (0.2 + maxAct * 0.6)})`;
              ctx!.lineWidth = 1 + maxAct * 1.5;
            } else {
              ctx!.strokeStyle = `rgba(${p.idleEdge[0]},${p.idleEdge[1]},${p.idleEdge[2]},${dAlpha * 0.25})`;
              ctx!.lineWidth = 1;
            }
            ctx!.stroke();
          }
        }
      }

      // Nodes
      for (const n of neurons) {
        if (n.activation > 0.1) {
          ctx!.beginPath(); ctx!.arc(n.x, n.y, n.radius + 6 * n.activation, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(${p.active[0]},${p.active[1]},${p.active[2]},${n.activation * 0.25})`;
          ctx!.fill();
        }
        const r = ~~(p.idle[0] + (p.active[0] - p.idle[0]) * n.activation);
        const g = ~~(p.idle[1] + (p.active[1] - p.idle[1]) * n.activation);
        const b = ~~(p.idle[2] + (p.active[2] - p.idle[2]) * n.activation);
        ctx!.beginPath(); ctx!.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${r},${g},${b},${0.4 + n.activation * 0.6})`;
        ctx!.fill();
      }

      state.animId = requestAnimationFrame(animate);
    }
    state.animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(state.animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update palette on slide/theme change without re-init
  useEffect(() => {
    if (!stateRef.current) return;
    const colorKey = SLIDE_COLOR_MAP[activeSlide] ?? "default";
    const palettes = theme === "light" ? SLIDE_PALETTES_LIGHT : SLIDE_PALETTES;
    stateRef.current.palette = palettes[colorKey] ?? palettes.default;
  }, [activeSlide, theme]);

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute inset-0" style={{ background: getVignette(), transition: "background 1s ease" }} />
    </div>
  );
}

/* ── Shared shimmering logo ── */
function ShimmerLogo() {
  return (
    <motion.div
      className="relative inline-block mb-8"
      animate={{ filter: [
        "drop-shadow(0 0 8px rgba(99,102,241,0.3))",
        "drop-shadow(0 0 20px rgba(139,92,246,0.5))",
        "drop-shadow(0 0 12px rgba(168,85,247,0.3))",
        "drop-shadow(0 0 8px rgba(99,102,241,0.3))",
      ]}}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      <img src="/bw_logotype_onbalck_padding.png" alt="OpenPing" className="h-10 md:h-14 w-auto mx-auto deck-logo" />
    </motion.div>
  );
}

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
  return <span className={`inline-block font-semibold tracking-[0.14em] text-xs uppercase border px-3.5 py-1.5 rounded-full ${c[color]}`}>{children}</span>;
}

function S({ id, idx, children, wide = false, center = false }: { id: string; idx: number; children: React.ReactNode; wide?: boolean; center?: boolean }) {
  return (
    <section id={id} data-idx={idx} className={`snap-start snap-always h-[100dvh] flex flex-col items-center px-4 md:px-8 relative ${center ? "justify-center" : "justify-between"} py-10 md:py-14`}>
      <div className={`w-full ${wide ? "max-w-7xl" : "max-w-5xl"} flex flex-col ${center ? "" : "h-full"}`}>{children}</div>
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

function ThemeToggle({ theme, toggle }: { theme: string; toggle: () => void }) {
  return (
    <button
      onClick={toggle}
      className="fixed top-4 right-4 md:top-6 md:right-6 z-50 p-2.5 rounded-full border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 transition-colors"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="w-4 h-4 text-neutral-400" /> : <Moon className="w-4 h-4 text-neutral-400" />}
    </button>
  );
}

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
    <S id="s0" idx={0} center>
      <div className="relative text-center">
        <FadeUp delay={0}>
          <ShimmerLogo />
        </FadeUp>
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
          <p className="text-neutral-400 text-lg md:text-2xl max-w-2xl mx-auto leading-relaxed">
            OpenPing removes coordination overhead so delivery teams handle more clients, close decisions faster, and grow without adding operations headcount.
          </p>
        </FadeUp>
        <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
          className="mt-14 md:mt-16 flex flex-col items-center gap-1.5 text-neutral-700">
          <span className="text-xs tracking-[0.2em] uppercase">scroll</span>
          <div className="w-px h-6 bg-gradient-to-b from-neutral-700 to-transparent" />
        </motion.div>
      </div>
    </S>
  );
}

/* ── Company wordmark logos ── */
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
      logos: [<LogoRemitly key="r" />, <LogoMARS key="m" />, <LogoKPMG key="k" />, <LogoBCG key="b" />],
      highlights: [
        "Lived the problem: coordination collapsed across 5 time zones at Remitly",
        "Shipped AI-first products from zero (ppmlx, Halpy.me)",
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
        <h2 className="mt-4 text-[2.4rem] md:text-[3.5rem] lg:text-[4.5rem] font-semibold tracking-tight leading-[1.02] text-white">
          We lived the problem.<br /><span className="text-indigo-400">Now we're building the models to fix it.</span>
        </h2>
      </FadeUp>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 max-w-4xl mx-auto mb-6 flex-1 content-start">
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
          <p className="text-base text-neutral-400 leading-relaxed">
            Serial entrepreneurs. Both from Lodz, Poland.{" "}
            We don&apos;t just use AI tools - we build entire products with AI as a co-creator.{" "}
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
      <FadeUp>
        <Tag color="rose">The Coordination Problem</Tag>
        <h2 className="mt-4 text-[2.6rem] md:text-[3.5rem] lg:text-[4.5rem] font-semibold tracking-tight leading-[1.02] text-white mb-2">
          Coordination is a tax on growth.
        </h2>
        <p className="text-neutral-400 text-lg md:text-xl leading-relaxed max-w-4xl mb-2">
          Knowledge workers spend more time moving information than executing decisions. Every tool adds a channel. Every channel adds overhead. The bottleneck is always a person.
        </p>
      </FadeUp>
      <FadeUp delay={0.15} className="flex-1 flex items-center -ml-8 md:-ml-14">
        <img
          src="/coordination-tax.svg"
          alt="Coordination spaghetti: sources flow through a human bottleneck to delayed outcomes"
          className="w-[115%] max-w-none h-auto deck-svg-dark"
        />
      </FadeUp>
    </S>
  );
}

/* ══ SLIDE 3 - LOST REVENUE AND HIDDEN COSTS ══ */
function LostRevenue() {
  const stats = [
    { metric: "$180k+", label: "Cost of 1 coordination FTE", pct: 45, color: "bg-rose-500", textColor: "text-rose-400" },
    { metric: "1 in 3", label: "Senior hours lost to coordination", pct: 33, color: "bg-amber-500", textColor: "text-amber-400" },
    { metric: "74% vs 22%", label: "Individual vs org-level AI gains", pct: 74, color: "bg-orange-500", textColor: "text-orange-400" },
    { metric: "~40%", label: "Revenue capacity gap", pct: 40, color: "bg-red-500", textColor: "text-red-400" },
  ];
  return (
    <S id="s3" idx={3} wide>
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute bottom-0 left-[-20%] w-[800px] h-[800px] bg-[radial-gradient(ellipse_at_center,rgba(225,29,72,0.05),transparent_60%)]" />
      </div>
      <FadeUp className="mb-8">
        <Tag color="rose">Lost Revenue and Hidden Costs</Tag>
        <h2 className="mt-4 text-[2.2rem] md:text-[3.2rem] lg:text-[4rem] font-semibold tracking-tight leading-[1.02] text-white">
          The real cost isn&apos;t ops headcount.<br /><span className="text-rose-400">It&apos;s the revenue you can&apos;t reach.</span>
        </h2>
      </FadeUp>
      <div className="flex-1 flex flex-col justify-center gap-6 max-w-4xl">
        {stats.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: i * 0.12 }} viewport={{ once: false, amount: 0.3 }}>
            <div className="flex items-baseline justify-between mb-2">
              <div className="flex items-baseline gap-4">
                <span className={`text-3xl md:text-4xl font-bold ${s.textColor}`}>{s.metric}</span>
                <span className="text-base text-neutral-400">{s.label}</span>
              </div>
            </div>
            <div className="h-3 rounded-full bg-neutral-900 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${s.pct}%` }}
                transition={{ duration: 1.2, delay: 0.3 + i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                viewport={{ once: false, amount: 0.3 }}
                className={`h-full rounded-full ${s.color} opacity-70`}
              />
            </div>
          </motion.div>
        ))}
      </div>
      <FadeUp delay={0.5}>
        <div className="p-4 md:p-5 rounded-xl border border-rose-900/30 bg-rose-950/10 mt-6">
          <p className="text-base text-neutral-400 leading-relaxed">
            We saw this at our companies, at our clients, and heard the same from colleagues running agencies, consultancies, and software houses.{" "}
            AI makes individuals faster - but it can&apos;t close decisions, follow through on commitments, or route the right question to the right person.{" "}
            <span className="text-white font-medium">Senior people absorb the gap. Growth stalls.</span>
          </p>
        </div>
      </FadeUp>
    </S>
  );
}

/* ══ SLIDE 4 - WHAT OPENPING DOES ══ */
function WhatWeDo() {
  const steps = [
    { icon: <Radio className="w-6 h-6" />, title: "Listens", desc: "Connects to all communication - Slack, Teams, email, docs, tickets. Reads everything in real-time.", color: "text-indigo-400", border: "border-indigo-800/40", bg: "bg-indigo-950/15" },
    { icon: <Brain className="w-6 h-6" />, title: "Understands", desc: "Extracts decisions, commitments, blockers. Classifies signals with actor and confidence.", color: "text-violet-400", border: "border-violet-800/40", bg: "bg-violet-950/15" },
    { icon: <Route className="w-6 h-6" />, title: "Routes", desc: "Missing context? One precise question to the right person. No thread pollution, no group pings.", color: "text-purple-400", border: "border-purple-800/40", bg: "bg-purple-950/15" },
    { icon: <Eye className="w-6 h-6" />, title: "Surfaces", desc: "Delivery leads see only what needs human judgment. Everything else is handled.", color: "text-indigo-400", border: "border-indigo-800/40", bg: "bg-indigo-950/15" },
    { icon: <CheckCircle className="w-6 h-6" />, title: "Closes", desc: "Commitments tracked to resolution. Slips surfaced before the client notices.", color: "text-emerald-400", border: "border-emerald-800/40", bg: "bg-emerald-950/15" },
  ];
  return (
    <S id="s4" idx={4} wide>
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[20%] right-[-10%] w-[700px] h-[700px] bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.05),transparent_60%)]" />
      </div>
      <FadeUp className="mb-8">
        <Tag color="indigo">What OpenPing Does</Tag>
        <h2 className="mt-4 text-[2.2rem] md:text-[3.2rem] lg:text-[4rem] font-semibold tracking-tight leading-[1.02] text-white">
          From noise to decisions.<br /><span className="text-indigo-400">Five steps, fully automated.</span>
        </h2>
      </FadeUp>
      <div className="flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-2">
          {steps.map((step, i) => (
            <FadeUp key={i} delay={i * 0.08}>
              <div className={`rounded-2xl border ${step.border} ${step.bg} p-5 md:p-4 h-full flex flex-col items-center md:items-center text-center relative`}>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute right-[-12px] top-1/2 -translate-y-1/2 z-10">
                    <ArrowRight className="w-4 h-4 text-neutral-700" />
                  </div>
                )}
                <div className={`p-3 rounded-xl bg-neutral-900 border border-neutral-800 mb-3 ${step.color}`}>
                  {step.icon}
                </div>
                <p className={`text-lg font-bold mb-2 ${step.color}`}>{step.title}</p>
                <p className="text-sm text-neutral-500 leading-relaxed">{step.desc}</p>
              </div>
            </FadeUp>
          ))}
        </div>
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
      points: ["All inputs embedded continuously, under 80ms p95", "Hybrid dense/sparse retrieval, per-org namespace", "Streaming incremental - no batch reprocessing"] },
    { title: "Open Data Model", badge: "BUILT", badgeColor: "text-emerald-400", accent: "border-emerald-700/50 bg-emerald-950/10",
      points: ["Open schema, no storage-layer lock-in", "Full export, external query, third-party integration", "Air-gapped deployments supported"] },
    { title: "Offline-First Mobile App", badge: "IN PROGRESS", badgeColor: "text-amber-400", accent: "border-amber-700/50 bg-amber-950/10",
      points: ["Native mobile with full offline support via ppmlx", "Personal temporal context graphs built on-device", "CRDT sync - works with intermittent connectivity"] },
    { title: "Pre-Formalization Signal Layer", badge: "IN PROGRESS", badgeColor: "text-amber-400", accent: "border-amber-700/50 bg-amber-950/10",
      points: ["Captures signals before formalization occurs", "Distinguishes commitment, intent, blocker, complaint", "Per-org classifier fine-tuning"] },
  ];
  return (
    <S id="s5" idx={5} wide>
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute bottom-[-10%] left-[10%] w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.06),transparent_60%)]" />
      </div>
      <FadeUp className="mb-6">
        <Tag color="indigo">How We Deliver</Tag>
        <h2 className="mt-4 text-[2.2rem] md:text-[3.2rem] lg:text-[4rem] font-semibold tracking-tight leading-[1.02] text-white">
          Purpose-built infrastructure<br /><span className="text-indigo-400">for coordination intelligence.</span>
        </h2>
      </FadeUp>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 flex-1 content-start">
        {engines.map((e, i) => (
          <FadeUp key={i} delay={i * 0.05}>
            <div className={`rounded-2xl border p-4 md:p-5 h-full ${e.accent}`}>
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-semibold text-white pr-2">{e.title}</h3>
                <span className={`text-[9px] font-bold tracking-widest border border-current rounded-full px-2 py-0.5 shrink-0 opacity-60 ${e.badgeColor}`}>{e.badge}</span>
              </div>
              <ul className="space-y-1.5">
                {e.points.map((p, j) => (
                  <li key={j} className="text-sm text-neutral-500 flex gap-2 leading-relaxed">
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
    { dim: "AI role", slack: "Reactive feature", ping: "Proactive orchestrator" },
    { dim: "Follow-through", slack: "Manual (falls on you)", ping: "Autonomous" },
    { dim: "Success metric", slack: "Messages summarized", ping: "Decisions closed" },
  ];
  return (
    <S id="s6" idx={6} wide>
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[30%] left-[50%] -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.04),transparent_60%)]" />
      </div>
      <FadeUp>
        <Tag color="amber">Why Not Slack + AI?</Tag>
        <h2 className="mt-4 text-[2.2rem] md:text-[3.2rem] lg:text-[4rem] font-semibold tracking-tight leading-[1.02] text-white mb-4">
          Slack is a copilot.<br /><span className="text-amber-400">OpenPing is the autopilot.</span>
        </h2>
        <p className="text-base text-neutral-400 leading-relaxed max-w-4xl mb-8">
          Copilots help individuals go faster. Autopilots close decisions, route context, and follow through without human overhead.{" "}
          <span className="text-white font-medium">No product owns the coordination control plane.</span> That's the gap.
        </p>
      </FadeUp>
      <FadeUp delay={0.12} className="flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 h-full">
          {/* Slack column - muted */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 md:p-8 flex flex-col">
            <div className="mb-6">
              <p className="text-xs text-neutral-600 uppercase tracking-widest font-medium mb-2">Copilot</p>
              <p className="text-2xl md:text-3xl font-bold text-neutral-500">Slack + AI</p>
            </div>
            <div className="space-y-4 flex-1">
              {dims.map((row, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-xs text-neutral-700 uppercase tracking-wide font-medium mb-1">{row.dim}</span>
                  <span className="text-base text-neutral-500">{row.slack}</span>
                </div>
              ))}
            </div>
          </div>
          {/* OpenPing column - dominant */}
          <div className="rounded-2xl border border-amber-700/40 bg-amber-950/10 ring-1 ring-amber-500/20 p-6 md:p-8 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.1),transparent_70%)]" />
            <div className="mb-6 relative">
              <p className="text-xs text-amber-500 uppercase tracking-widest font-medium mb-2">Autopilot</p>
              <p className="text-2xl md:text-3xl font-bold text-amber-400">OpenPing</p>
            </div>
            <div className="space-y-4 flex-1 relative">
              {dims.map((row, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-xs text-neutral-600 uppercase tracking-wide font-medium mb-1">{row.dim}</span>
                  <span className="text-lg text-white font-semibold">{row.ping}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </FadeUp>
    </S>
  );
}

/* ══ SLIDE 7 - BUSINESS MODEL ══ */
function Pricing() {
  return (
    <S id="s7" idx={7} wide>
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 right-0 w-[600px] h-[800px] bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.05),transparent_60%)]" />
      </div>
      <FadeUp className="mb-6">
        <Tag color="amber">Business Model</Tag>
        <h2 className="mt-4 text-[2.2rem] md:text-[3.2rem] lg:text-[4rem] font-semibold tracking-tight leading-[1.02] text-white">
          Three revenue engines.<br /><span className="text-amber-400">Open core. Success-based. Proprietary data.</span>
        </h2>
        <p className="mt-3 text-neutral-500 text-base max-w-3xl leading-relaxed">
          We don't sell seats. We capture value at every layer - from free adoption to outcomes customers pay to keep.
        </p>
      </FadeUp>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-5 flex-1 content-start">
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
            icon: <Zap className="w-6 h-6 text-amber-400" />,
            features: [
              "Priced on outcomes, not seats",
              "Coordination control suite - decisions tracked to resolution",
              "Customers pay because it works, not because they're locked in",
              "Compared against headcount ($180k+), not software ($12/seat)",
            ],
            accent: "border-amber-700/60", highlight: true },
          { tier: "Proprietary Data", label: "Moat engine",
            icon: <ShieldCheck className="w-6 h-6 text-emerald-400" />,
            features: [
              "Every conversation builds the org knowledge graph",
              "Classifiers improve with usage - proprietary training data",
              "ppmlx on-device inference cuts cost 4-6x vs API",
              "Data compounds into an unforkable moat",
            ],
            accent: "border-emerald-700/60", highlight: false },
        ].map((t, i) => (
          <FadeUp key={i} delay={i * 0.08}>
            <div className={`rounded-2xl border p-5 md:p-6 h-full flex flex-col ${t.accent} ${t.highlight ? "bg-amber-950/10 ring-1 ring-amber-600/20" : "bg-neutral-950"}`}>
              <div className="mb-4">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-xs text-neutral-600 uppercase tracking-widest font-medium mb-1">{t.label}</p>
                  <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 shrink-0">{t.icon}</div>
                </div>
                <span className="text-xl md:text-2xl font-bold text-white">{t.tier}</span>
              </div>
              <ul className="space-y-1.5 flex-1 mt-2">
                {t.features.map((f, j) => (
                  <li key={j} className="text-sm text-neutral-500 flex gap-2 items-start"><span className="text-emerald-600 shrink-0 mt-0.5">+</span><span className="leading-snug">{f}</span></li>
                ))}
              </ul>
            </div>
          </FadeUp>
        ))}
      </div>
      <FadeUp delay={0.28}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950">
            <p className="text-base font-semibold text-white mb-1.5">Services are the new software</p>
            <p className="text-sm text-neutral-500 leading-relaxed">AI lets us deliver outcomes directly - not tools for professionals to use. PING replaces coordination labor, not just coordination software.</p>
          </div>
          <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950">
            <p className="text-base font-semibold text-white mb-1.5">Path to software margins</p>
            <p className="text-sm text-neutral-500 leading-relaxed">Start with high-touch onboarding (services revenue). As the model learns each org, automation increases and margins converge to 70%+ software margins at scale.</p>
          </div>
        </div>
      </FadeUp>
    </S>
  );
}

/* ══ SLIDE 8 - MARKET ══ */
function Market() {
  return (
    <S id="s8" idx={8} wide>
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute bottom-0 left-[20%] w-[700px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.04),transparent_60%)]" />
      </div>

      <FadeUp>
        <Tag color="emerald">Market</Tag>
        <h2 className="mt-4 text-[2.2rem] md:text-[3.2rem] lg:text-[4rem] font-semibold tracking-tight leading-[1.02] text-white mb-2">
          We don't compete for the SaaS budget.
        </h2>
        <h2 className="text-[2.2rem] md:text-[3.2rem] lg:text-[4rem] font-semibold tracking-tight leading-[1.02] mb-6">
          <span className="text-emerald-400">We compete for the headcount budget.</span>
        </h2>
      </FadeUp>

      {/* ── Budget comparison ── */}
      <FadeUp delay={0.08} className="mb-6">
        <div className="flex items-center gap-4 md:gap-8">
          <div className="flex-1 p-4 rounded-xl border border-neutral-800/60 bg-neutral-950/60 text-center">
            <p className="text-neutral-600 text-xs uppercase tracking-widest mb-1">SaaS seat</p>
            <p className="text-2xl md:text-3xl font-bold text-neutral-600 line-through decoration-neutral-700">$12/mo</p>
          </div>
          <ArrowRight className="w-6 h-6 text-emerald-500 shrink-0" />
          <div className="flex-1 p-4 rounded-xl border border-emerald-700/40 bg-emerald-950/15 ring-1 ring-emerald-500/20 text-center">
            <p className="text-emerald-500 text-xs uppercase tracking-widest mb-1">Coordination FTE</p>
            <p className="text-2xl md:text-3xl font-bold text-emerald-400">$180k+/yr</p>
          </div>
        </div>
      </FadeUp>

      {/* ── Main content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-6 flex-1 content-start">

        {/* Left: ICP cards */}
        <FadeUp delay={0.12}>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "ICP", icon: Target, line: "Founder / COO / Head of Delivery", sub: "50-300 people, multi-client" },
              { label: "Beachhead", icon: Radio, line: "~50k US agencies", sub: "Software houses & consultancies" },
              { label: "ACV", icon: Zap, line: "$24k - $150k", sub: "vs headcount, not SaaS" },
              { label: "Verticals", icon: Route, line: "Agencies · SW houses", sub: "Consultancies · Managed svc" },
            ].map((c, i) => {
              const Icon = c.icon;
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.08 * i }} viewport={{ once: false, amount: 0.3 }}
                  className="rounded-xl border border-neutral-800/60 bg-neutral-950/60 p-3.5 flex flex-col gap-1.5 hover:border-emerald-800/40 transition-colors">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-emerald-500/70" />
                    <span className="text-[0.6rem] text-emerald-500/80 uppercase tracking-[0.16em] font-bold">{c.label}</span>
                  </div>
                  <p className="text-sm font-semibold text-white leading-snug">{c.line}</p>
                  <p className="text-xs text-neutral-500 leading-snug">{c.sub}</p>
                </motion.div>
              );
            })}
          </div>
        </FadeUp>

        {/* Right: TAM + penetration */}
        <FadeUp delay={0.2}>
          <div className="space-y-4">
            {[
              { label: "Beachhead (US)", value: "$1.2B", pct: 12, color: "bg-emerald-600", text: "text-emerald-400" },
              { label: "5-Year SAM", value: "$12-15B", pct: 40, color: "bg-emerald-500", text: "text-emerald-300" },
              { label: "Platform TAM", value: "$100B+", pct: 100, color: "bg-emerald-400", text: "text-emerald-300", highlight: true },
            ].map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.12 }} viewport={{ once: false, amount: 0.4 }}>
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className={`text-base font-semibold ${m.highlight ? "text-emerald-400" : "text-white"}`}>{m.label}</span>
                  <span className={`text-xl md:text-2xl font-bold ${m.text}`}>{m.value}</span>
                </div>
                <div className="h-4 rounded-full bg-neutral-900 overflow-hidden">
                  <motion.div initial={{ width: 0 }} whileInView={{ width: `${m.pct}%` }}
                    transition={{ duration: 1.2, delay: 0.3 + i * 0.15, ease: [0.22, 1, 0.36, 1] }} viewport={{ once: false, amount: 0.5 }}
                    className={`h-full rounded-full ${m.color} opacity-70`} />
                </div>
                {m.highlight && (
                  <p className="text-xs text-emerald-500/60 mt-1">Coordination headcount budget across all professional services</p>
                )}
              </motion.div>
            ))}

            <div className="p-4 rounded-xl border border-emerald-900/30 bg-emerald-950/20">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-2xl md:text-3xl font-bold text-emerald-400">$12M</span>
                  <p className="text-xs text-neutral-500 mt-0.5">ARR at 1% beachhead</p>
                </div>
                <div>
                  <span className="text-2xl md:text-3xl font-bold text-emerald-300">$60M</span>
                  <p className="text-xs text-neutral-500 mt-0.5">ARR at 5% penetration</p>
                </div>
              </div>
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
      body: "Deploying hands-on with 3-5 agencies. Sitting alongside delivery leads, iterating weekly. Proving coordination saves senior time measurably.",
      status: "Active", statusColor: "text-emerald-400 border-emerald-800" },
    { n: "02", title: "Open-source + community (Q3 2026)",
      body: "Open-source workspace drives developer adoption. Self-hosted free tier creates awareness. Teams hit the coordination ceiling and convert to paid.",
      status: "Next", statusColor: "text-amber-400 border-amber-800" },
    { n: "03", title: "Founder-led sales (Q4 2026)",
      body: "Design partner results become case studies. Direct outreach to Heads of Delivery and COOs at 50-300 person agencies. Founders close every deal.",
      status: "Planned", statusColor: "text-neutral-500 border-neutral-700" },
    { n: "04", title: "Channel partnerships (2027)",
      body: "Consultancy networks and implementation partners become distribution. Every deployment generates referral signal from adjacent firms.",
      status: "Planned", statusColor: "text-neutral-500 border-neutral-700" },
  ];
  return (
    <S id="s9" idx={9} wide>
      <FadeUp className="mb-6">
        <Tag color="emerald">Planned GTM Motion</Tag>
        <h2 className="mt-4 text-[2.2rem] md:text-[3.2rem] lg:text-[4rem] font-semibold tracking-tight leading-[1.02] text-white">
          Earn trust with 5 teams.<br /><span className="text-emerald-400">Then let results compound.</span>
        </h2>
      </FadeUp>
      <div className="space-y-3 w-full flex-1">
        {phases.map((f, i) => (
          <FadeUp key={i} delay={i * 0.08}>
            <div className="grid grid-cols-1 lg:grid-cols-[70px_1fr_100px] gap-4 md:gap-8 p-5 md:p-6 rounded-2xl border border-neutral-800 bg-neutral-950/80 backdrop-blur-sm items-center hover:bg-neutral-900/80 transition-colors">
              <div className="text-4xl md:text-5xl font-light text-neutral-800 tracking-tighter hidden lg:block">{f.n}</div>
              <div className="flex flex-col">
                <div className="flex items-center gap-3 mb-2 lg:hidden">
                  <span className="text-lg font-bold text-neutral-700">{f.n}</span>
                </div>
                <h3 className="text-lg font-medium text-white mb-1 leading-snug">{f.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{f.body}</p>
              </div>
              <div className="flex lg:flex-col justify-between lg:justify-center items-center gap-3 lg:gap-1.5 w-full mt-3 lg:mt-0">
                <span className={`text-xs font-bold tracking-widest border rounded-full px-3 py-1 ${f.statusColor}`}>{f.status}</span>
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
    <S id="s10" idx={10} center>
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.04),transparent)]" />
      <div className="flex flex-col items-center justify-center text-center w-full max-w-4xl mx-auto">
        <FadeUp delay={0}>
          <ShimmerLogo />
        </FadeUp>
        <FadeUp delay={0.1}>
          <h2 className="text-[2.6rem] md:text-[3.5rem] lg:text-[4.5rem] font-semibold text-white tracking-tight leading-[1.05] mb-4">
            A new decision layer is forming.
          </h2>
          <h2 className="text-[2.6rem] md:text-[3.5rem] lg:text-[4.5rem] font-semibold tracking-tight leading-[1.05] mb-8">
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">OpenPing is the foundation.</span>
          </h2>
        </FadeUp>

        <FadeUp delay={0.2}>
          <p className="text-lg md:text-xl text-neutral-500 leading-relaxed mb-12 max-w-3xl">
            The product that controls context and coordination data for professional services will be infrastructure for how expert work gets delivered at scale.
          </p>
        </FadeUp>

        <FadeUp delay={0.3} className="w-full flex justify-center mb-12">
          <a href="mailto:rafal@openping.app"
            className="px-8 py-4 rounded-full bg-white text-black text-base font-semibold hover:bg-neutral-200 transition-colors text-center shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            rafal@openping.app
          </a>
        </FadeUp>

        <FadeUp delay={0.4} className="flex justify-center">
          <div className="flex items-center gap-8 text-center">
            {[
              { label: "Founded", value: "2026" },
              { label: "Stage", value: "Pre-seed" },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="text-xs text-neutral-600 uppercase tracking-widest font-medium mb-1.5">{item.label}</div>
                <div className="text-base text-neutral-300 font-medium">{item.value}</div>
              </div>
            ))}
          </div>
        </FadeUp>
      </div>
    </S>
  );
}

/* ══ ROOT ══ */
export default function PitchDeck() {
  const [active, setActive] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };
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
      <div id="deck-bg" className="fixed inset-0 bg-black pointer-events-none" style={{ zIndex: -1 }} />
      <NeuralBackground activeSlide={active} theme={theme} />
      <ThemeToggle theme={theme} toggle={toggleTheme} />
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
