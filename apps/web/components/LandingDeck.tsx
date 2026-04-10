"use client";

import { motion, useInView } from "motion/react";
import { useEffect, useState, useRef } from "react";
import { Sun, Moon, Github, Terminal, Copy, Check, ArrowRight, X as XIcon } from "lucide-react";
import Link from "next/link";

const DOCS_URL = "https://docs.openping.app/";
const GITHUB_URL = "https://github.com/the-focus-company/openping";
const QUICKSTART = "git clone https://github.com/the-focus-company/openping.git\ncd openping\npnpm install\npnpm dev";

/* ── Neural Background ── */
const DARK_P = { idle: [45, 75, 130], active: [139, 92, 246], idleEdge: [30, 58, 138], activeEdge: [139, 92, 246] };
const LIGHT_P = { idle: [148, 163, 184], active: [124, 58, 237], idleEdge: [203, 213, 225], activeEdge: [124, 58, 237] };

function NeuralBg({ theme }: { theme: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<any>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const N = 80, MD = 150, MD2 = MD * MD;
    let w = window.innerWidth, h = document.documentElement.scrollHeight;
    function resize() {
      w = window.innerWidth; h = document.documentElement.scrollHeight;
      const d = window.devicePixelRatio || 1;
      canvas!.width = w * d; canvas!.height = h * d; ctx!.scale(d, d);
      if (stateRef.current) { stateRef.current.w = w; stateRef.current.h = h; }
    }
    resize(); window.addEventListener("resize", resize);
    const ns: any[] = [];
    for (let i = 0; i < N; i++) { const r = Math.random() * 1.5 + 1; ns.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .12, vy: (Math.random() - .5) * .12, r, br: r, a: 0 }); }
    stateRef.current = { ns, p: DARK_P, ma: 0, mx: 0, my: 0, mt: 0, lf: performance.now(), pt: 0, aid: 0, w, h };
    const s = stateRef.current;
    function pulse() { const idle = s.ns.filter((n: any) => n.a < .2); if (!idle.length) return; const st = idle[~~(Math.random() * idle.length)]; st.a = 1; setTimeout(() => { for (const n of s.ns) if (n !== st && n.a < .5) { const dx = st.x - n.x, dy = st.y - n.y; if (dx * dx + dy * dy < MD2) n.a = .8; } }, 800); }
    pulse();
    function mm(e: MouseEvent) { const now = performance.now(); if (s.mt > 0) { const dt = now - s.mt, dx = e.clientX - s.mx, dy = e.clientY - s.my; s.ma = Math.min(1, s.ma + Math.sqrt(dx * dx + dy * dy) / Math.max(1, dt) / 5 * .4); } s.mx = e.clientX; s.my = e.clientY; s.mt = now; }
    window.addEventListener("mousemove", mm);
    function anim() {
      const now = performance.now(), dt = now - s.lf; s.lf = now;
      ctx!.clearRect(0, 0, s.w, s.h);
      if (s.ma > 0) { s.ma -= dt / 1000; if (s.ma < 0) s.ma = 0; }
      s.pt += dt; if (s.pt >= 3500 - s.ma * 3400) { pulse(); s.pt = 0; }
      const p = s.p, dc = .004 + s.ma * .012;
      for (const n of s.ns) { n.x += n.vx; n.y += n.vy; if (n.x < -40) n.vx += .008; if (n.x > s.w + 40) n.vx -= .008; if (n.y < -40) n.vy += .008; if (n.y > s.h + 40) n.vy -= .008; if (n.a > 0) { n.a -= dc; if (n.a < 0) n.a = 0; } n.r = n.br + n.a * 2; }
      for (let i = 0; i < ns.length; i++) { const a = ns[i]; for (let j = i + 1; j < ns.length; j++) { const b = ns[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy; if (d2 < MD2) { const dist = Math.sqrt(d2), da = 1 - dist / MD, ma = Math.max(a.a, b.a); ctx!.beginPath(); ctx!.moveTo(a.x, a.y); ctx!.lineTo(b.x, b.y); if (ma > .1) { const r = ~~(p.idleEdge[0] + (p.activeEdge[0] - p.idleEdge[0]) * ma), g = ~~(p.idleEdge[1] + (p.activeEdge[1] - p.idleEdge[1]) * ma), bl = ~~(p.idleEdge[2] + (p.activeEdge[2] - p.idleEdge[2]) * ma); ctx!.strokeStyle = `rgba(${r},${g},${bl},${da * (.15 + ma * .5)})`; ctx!.lineWidth = 1 + ma; } else { ctx!.strokeStyle = `rgba(${p.idleEdge[0]},${p.idleEdge[1]},${p.idleEdge[2]},${da * .15})`; ctx!.lineWidth = .8; } ctx!.stroke(); } } }
      for (const n of ns) { if (n.a > .1) { ctx!.beginPath(); ctx!.arc(n.x, n.y, n.r + 5 * n.a, 0, Math.PI * 2); ctx!.fillStyle = `rgba(${p.active[0]},${p.active[1]},${p.active[2]},${n.a * .2})`; ctx!.fill(); } const r = ~~(p.idle[0] + (p.active[0] - p.idle[0]) * n.a), g = ~~(p.idle[1] + (p.active[1] - p.idle[1]) * n.a), bl = ~~(p.idle[2] + (p.active[2] - p.idle[2]) * n.a); ctx!.beginPath(); ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx!.fillStyle = `rgba(${r},${g},${bl},${.35 + n.a * .5})`; ctx!.fill(); }
      s.aid = requestAnimationFrame(anim);
    }
    s.aid = requestAnimationFrame(anim);
    return () => { cancelAnimationFrame(s.aid); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", mm); };
  }, []);
  useEffect(() => { if (stateRef.current) stateRef.current.p = theme === "light" ? LIGHT_P : DARK_P; }, [theme]);
  const bg = theme === "light" ? "248,250,252" : "0,0,0";
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 50% 30% at 50% 0%, rgba(${bg},.9) 0%, rgba(${bg},.5) 50%, rgba(${bg},.2) 100%)` }} />
    </div>
  );
}

/* ── Scroll reveal ── */
const SPRING = { type: "spring" as const, damping: 22, stiffness: 200 };

function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px 0px" });
  return (
    <motion.div ref={ref} style={style} initial={{ opacity: 0, y: 28 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ ...SPRING, delay }}>
      {children}
    </motion.div>
  );
}

/* ── Theme colors ── */
function c(dark: boolean) {
  return {
    text: { color: dark ? "#fff" : "#0a0a0a" },
    muted: { color: dark ? "#a3a3a3" : "#525252" },
    faint: { color: dark ? "#525252" : "#a3a3a3" },
    accent: { color: "#5E6AD2" },
    bg: { background: dark ? "#000" : "#fafafa" },
    navBg: {
      background: dark ? "rgba(0,0,0,.7)" : "rgba(255,255,255,.7)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      borderBottom: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`,
    },
    card: {
      background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)",
      border: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`,
      borderRadius: 16,
    },
    cardHover: {
      background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)",
    },
    accentCard: {
      background: dark ? "rgba(94,106,210,.06)" : "rgba(94,106,210,.04)",
      border: `1px solid ${dark ? "rgba(94,106,210,.2)" : "rgba(94,106,210,.15)"}`,
      borderRadius: 16,
    },
    dangerCard: {
      background: dark ? "rgba(239,68,68,.04)" : "rgba(239,68,68,.03)",
      border: `1px solid ${dark ? "rgba(239,68,68,.15)" : "rgba(239,68,68,.1)"}`,
      borderRadius: 16,
    },
    divider: { borderTop: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` },
    pillarNum: { color: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.06)" },
    terminal: {
      background: dark ? "#0a0b14" : "#1a1b2e",
      border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.06)"}`,
      borderRadius: 16,
    },
  };
}

/* ── Data ── */
const PAIN_STATS = [
  { stat: "62%", label: "of expert time lost to coordination", detail: "Chasing context, relaying status, attending alignment meetings" },
  { stat: "3.2h", label: "per day in manual context assembly", detail: "Searching Slack, checking tickets, re-reading threads" },
  { stat: "47%", label: "of decisions delayed by missing info", detail: "The right person has the answer but nobody knows who" },
];

const STEPS = [
  { n: "01", title: "Context assembled", body: "OpenPing gathers relevant messages, tickets, PRs, and prior decisions. Your experts get ranked, ready-to-act context instead of raw chat noise." },
  { n: "02", title: "Decisions traced", body: "Every decision is linked to its discussion, supporting evidence, and the person who made the call. No more reconstructing history." },
  { n: "03", title: "Action orchestrated", body: "Once a human decides, OpenPing triggers follow-ups: notify the right people, create tickets, update stakeholders. Deciding becomes doing." },
];

const COMPARISON = [
  { label: "Message triage", slack: "Manual or basic AI", openping: "AI-ranked Eisenhower inbox" },
  { label: "Context for decisions", slack: "Search threads yourself", openping: "Auto-assembled with sources" },
  { label: "Decision tracking", slack: "Lost in chat history", openping: "Traced with full evidence trail" },
  { label: "Post-decision action", slack: "Manual follow-up", openping: "Orchestrated: notify, create tasks, update" },
  { label: "Expert interruptions", slack: "DMs and @mentions", openping: "Routed context, fewer pings" },
  { label: "Client access", slack: "Slack Connect (paid per seat)", openping: "Guest roles, scoped by default" },
  { label: "Pricing", slack: "Per seat, scales with headcount", openping: "Value-led, scales with capacity" },
];

const TIERS = [
  { label: "Self-hosted", price: "Free", detail: "MIT license. Your infra, your data. Full control." },
  { label: "Cloud", price: "Early access", detail: "Hosted by us. Start with one team. Scale when ready." },
  { label: "Enterprise", price: "Custom", detail: "SSO, compliance, dedicated support. White-glove onboarding." },
];

/* ── Main Component ── */
export default function LandingDeck() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [copied, setCopied] = useState(false);
  const toggle = () => {
    const n = theme === "dark" ? "light" : "dark";
    setTheme(n);
    document.documentElement.setAttribute("data-theme", n);
  };
  const dark = theme === "dark";
  const s = c(dark);

  useEffect(() => {
    if (!document.querySelector('link[href*="Outfit"]')) {
      const link = document.createElement("link");
      link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
  }, []);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(QUICKSTART); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {}
  };

  const wrap: React.CSSProperties = { maxWidth: "64rem", margin: "0 auto", padding: "0 24px" };
  const sectionPad: React.CSSProperties = { paddingTop: 96, paddingBottom: 96 };
  const body: React.CSSProperties = { fontSize: "clamp(1rem, 1.8vw, 1.125rem)", lineHeight: 1.85, ...s.muted };
  const h2Style: React.CSSProperties = { fontSize: "clamp(1.8rem, 4vw, 2.75rem)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 20, ...s.text };
  const eyebrow: React.CSSProperties = { fontSize: 12, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 600, marginBottom: 16, color: "#5E6AD2" };

  return (
    <div style={{ minHeight: "100vh", position: "relative", ...s.bg, fontFamily: "'Outfit', system-ui, sans-serif", WebkitFontSmoothing: "antialiased" }}>
      {/* Background layer */}
      <div style={{ position: "fixed", inset: 0, zIndex: -1, ...s.bg }} />
      <NeuralBg theme={theme} />

      {/* ── Nav ── */}
      <nav style={{ position: "fixed", top: 0, zIndex: 50, width: "100%", ...s.navBg }}>
        <div style={{ ...wrap, maxWidth: "72rem", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <motion.div style={{ display: "inline-block" }} animate={{ filter: ["drop-shadow(0 0 6px rgba(99,102,241,.3))", "drop-shadow(0 0 14px rgba(139,92,246,.4))", "drop-shadow(0 0 8px rgba(168,85,247,.3))", "drop-shadow(0 0 6px rgba(99,102,241,.3))"] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/bw_logotype_onbalck_padding.png" alt="OpenPing" style={{ height: 28, width: "auto", filter: dark ? "none" : "invert(1)" }} />
            </motion.div>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Link href="/manifesto" style={{ padding: "6px 12px", fontSize: 14, textDecoration: "none", borderRadius: 6, ...s.muted }}>Manifesto</Link>
            <a href={DOCS_URL} style={{ padding: "6px 12px", fontSize: 14, textDecoration: "none", borderRadius: 6, ...s.muted }}>Docs</a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 14, textDecoration: "none", borderRadius: 6, ...s.muted }}>
              <Github size={16} /> <span>GitHub</span>
            </a>
            <span style={{ width: 1, height: 16, margin: "0 8px", background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)" }} />
            <Link href="/sign-in" style={{ display: "inline-flex", alignItems: "center", height: 32, padding: "0 16px", fontSize: 14, fontWeight: 500, borderRadius: 8, border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)"}`, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", textDecoration: "none", ...s.text }}>
              Sign in
            </Link>
            <button onClick={toggle} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", border: "none", background: "none", cursor: "pointer", marginLeft: 4, ...s.faint }}>
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Content ── */}
      <main style={{ position: "relative", zIndex: 10, paddingTop: 56 }}>

        {/* ── Hero ── */}
        <div style={{ ...wrap, paddingTop: 80, paddingBottom: 64 }}>
          <motion.div
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 999, border: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.02)", marginBottom: 28 }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.05 }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5E6AD2" }} />
            <span style={{ fontSize: 12, fontWeight: 500, ...s.muted }}>Open source &middot; MIT license &middot; Self-hostable</span>
          </motion.div>

          <motion.h1
            style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, maxWidth: "42rem", ...s.text }}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.1 }}
          >
            Decision-first workspace
          </motion.h1>

          <motion.p
            style={{ marginTop: 24, maxWidth: "36rem", fontSize: "clamp(1.05rem, 2vw, 1.25rem)", lineHeight: 1.7, ...s.muted }}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.2 }}
          >
            OpenPing is an AI communication layer that replaces coordination overhead with orchestrated flow. Context assembled. Decisions traced. Action executed.
          </motion.p>

          <motion.div
            style={{ marginTop: 32, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.3 }}
          >
            <Link href="/sign-in" style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 44, padding: "0 24px", borderRadius: 10, background: "#5E6AD2", color: "#fff", fontSize: 15, fontWeight: 500, textDecoration: "none" }}>
              Start a pilot <ArrowRight size={16} />
            </Link>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 44, padding: "0 24px", borderRadius: 10, border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.02)", fontSize: 15, fontWeight: 500, textDecoration: "none", ...s.muted }}>
              <Github size={16} /> Star on GitHub
            </a>
          </motion.div>

          <motion.p
            style={{ marginTop: 24, fontSize: 12, ...s.faint }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          >
            No vendor lock-in &middot; No telemetry &middot; Your data stays yours
          </motion.p>
        </div>

        {/* ── Problem ── */}
        <div style={{ ...s.divider }}>
          <div style={{ ...wrap, ...sectionPad }}>
            <Reveal>
              <p style={eyebrow}>The problem</p>
              <h2 style={h2Style}>Coordination tax is eating your margin</h2>
              <p style={{ ...body, maxWidth: "38rem", marginBottom: 48 }}>
                Your best people spend more time chasing context, relaying status, and sitting in alignment meetings than doing the expert work you hired them for.
              </p>
            </Reveal>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              {PAIN_STATS.map((p, i) => (
                <Reveal key={p.stat} delay={i * 0.08}>
                  <div style={{ padding: 24, ...s.card }}>
                    <div style={{ fontSize: "clamp(2rem, 4vw, 2.75rem)", fontWeight: 700, letterSpacing: "-0.02em", ...s.text }}>{p.stat}</div>
                    <p style={{ marginTop: 8, fontSize: 14, fontWeight: 500, ...s.text, opacity: 0.8 }}>{p.label}</p>
                    <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, ...s.faint }}>{p.detail}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.2} style={{ marginTop: 48 }}>
              <div style={{ padding: "28px 32px", ...s.card, maxWidth: "42rem" }}>
                <p style={{ fontSize: 15, lineHeight: 1.8, ...s.muted }}>
                  Every day, your delivery leads chase people for answers. Your experts get pulled from deep work for status updates. The result: <span style={{ fontWeight: 500, ...s.text }}>you hire coordinators to manage coordination</span> instead of delivering more value.
                </p>
              </div>
            </Reveal>
          </div>
        </div>

        {/* ── Solution ── */}
        <div style={{ ...s.divider }}>
          <div style={{ ...wrap, ...sectionPad }} id="how-it-works">
            <Reveal>
              <p style={eyebrow}>How it works</p>
              <h2 style={h2Style}>Replace coordination overhead with orchestrated flow</h2>
              <p style={{ ...body, maxWidth: "38rem", marginBottom: 48 }}>
                OpenPing sits between your team's communication and their work. It assembles context, helps decisions happen faster, and makes sure action follows.
              </p>
            </Reveal>

            <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
              {STEPS.map((step, i) => (
                <Reveal key={step.n} delay={i * 0.1}>
                  <div style={{ display: "flex", gap: 20 }}>
                    <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", flexShrink: 0, fontVariantNumeric: "tabular-nums", ...s.pillarNum }}>{step.n}</span>
                    <div>
                      <p style={{ fontWeight: 600, marginBottom: 6, fontSize: "clamp(1rem, 1.8vw, 1.2rem)", ...s.text }}>{step.title}</p>
                      <p style={{ fontSize: "clamp(0.95rem, 1.6vw, 1.05rem)", lineHeight: 1.85, ...s.muted }}>{step.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Before / After */}
            <Reveal delay={0.15} style={{ marginTop: 64 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                {/* Before */}
                <div style={{ padding: 24, ...s.dangerCard }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(239,68,68,.6)" }} />
                    <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(239,68,68,.7)" }}>Without OpenPing</span>
                  </div>
                  {["DM Sarah for context on the Acme issue", "Check Slack threads for prior decisions", "Search Linear for related tickets", "Compile update for the client call", "Follow up with 3 people who haven't responded", "Schedule a sync to align on next steps"].map(item => (
                    <p key={item} style={{ fontSize: 13, lineHeight: 1.8, ...s.muted, display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ marginTop: 10, width: 4, height: 4, borderRadius: "50%", background: "rgba(239,68,68,.4)", flexShrink: 0 }} />
                      {item}
                    </p>
                  ))}
                  <p style={{ marginTop: 16, fontSize: 12, fontWeight: 500, color: "rgba(239,68,68,.5)" }}>~45 minutes of coordination per decision</p>
                </div>
                {/* After */}
                <div style={{ padding: 24, ...s.accentCard }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#5E6AD2" }} />
                    <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(94,106,210,.8)" }}>With OpenPing</span>
                  </div>
                  {["Open inbox: Acme issue ranked as urgent + important", "Context assembled: 3 threads, 2 PRs, prior decision linked", "Make the call. Action orchestrated automatically."].map(item => (
                    <p key={item} style={{ fontSize: 13, lineHeight: 1.8, color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.6)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ marginTop: 10, width: 4, height: 4, borderRadius: "50%", background: "#5E6AD2", flexShrink: 0 }} />
                      {item}
                    </p>
                  ))}
                  <p style={{ marginTop: 16, fontSize: 12, fontWeight: 500, color: "rgba(94,106,210,.7)" }}>~3 minutes from question to action</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* ── Comparison ── */}
        <div style={{ ...s.divider }}>
          <div style={{ ...wrap, ...sectionPad }}>
            <Reveal>
              <p style={eyebrow}>Comparison</p>
              <h2 style={h2Style}>What coordination looks like with and without</h2>
              <p style={{ ...body, maxWidth: "38rem", marginBottom: 48 }}>
                Slack + PM tools patch the symptoms. OpenPing eliminates the underlying coordination tax.
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              <div style={{ overflowX: "auto", ...s.card, padding: 0 }}>
                <table style={{ width: "100%", minWidth: 600, borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.01)" }}>
                      <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 12, fontWeight: 500, width: 200, ...s.faint }} />
                      <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 12, fontWeight: 500, ...s.faint }}>Slack + PM tools</th>
                      <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#5E6AD2" }}>OpenPing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map(row => (
                      <tr key={row.label} style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}` }}>
                        <td style={{ padding: "12px 20px", fontSize: 13, fontWeight: 500, ...s.text, opacity: 0.7 }}>{row.label}</td>
                        <td style={{ padding: "12px 20px" }}>
                          <span style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <XIcon size={14} style={{ color: "rgba(239,68,68,.5)", marginTop: 3, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, ...s.faint }}>{row.slack}</span>
                          </span>
                        </td>
                        <td style={{ padding: "12px 20px" }}>
                          <span style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <Check size={14} style={{ color: "#10b981", marginTop: 3, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, ...s.text, opacity: 0.7 }}>{row.openping}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </div>
        </div>

        {/* ── Pricing ── */}
        <div style={{ ...s.divider }}>
          <div style={{ ...wrap, ...sectionPad, textAlign: "center" }}>
            <Reveal>
              <p style={eyebrow}>Pricing</p>
              <h2 style={{ ...h2Style }}>Pay for capacity, not seats</h2>
              <p style={{ ...body, maxWidth: "34rem", margin: "0 auto 48px", textAlign: "center" }}>
                Traditional tools charge per seat. OpenPing prices by the value it unlocks: more projects, better margins, fewer coordinators.
              </p>
            </Reveal>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, maxWidth: "48rem", margin: "0 auto" }}>
              {TIERS.map((tier, i) => (
                <Reveal key={tier.label} delay={i * 0.08}>
                  <div style={{ padding: 24, textAlign: "left", ...(i === 1 ? s.accentCard : s.card) }}>
                    <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.15em", ...s.faint }}>{tier.label}</p>
                    <p style={{ marginTop: 10, fontSize: "clamp(1.4rem, 3vw, 1.75rem)", fontWeight: 700, ...s.text }}>{tier.price}</p>
                    <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, ...s.faint }}>{tier.detail}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>

        {/* ── Open Source ── */}
        <div style={{ ...s.divider }}>
          <div style={{ ...wrap, ...sectionPad }}>
            <Reveal>
              <p style={eyebrow}>Open source</p>
              <h2 style={h2Style}>Four commands. Full control.</h2>
              <p style={{ ...body, maxWidth: "38rem", marginBottom: 40 }}>
                MIT licensed. Self-host on your own infrastructure. Fork it, extend it, contribute back. No vendor lock-in, no telemetry, no surprises.
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              <div style={{ maxWidth: "36rem", overflow: "hidden", ...s.terminal, boxShadow: "0 25px 50px -12px rgba(0,0,0,.4)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.04)"}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Terminal size={14} style={{ color: "rgba(255,255,255,.4)" }} />
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,.4)" }}>terminal</span>
                  </div>
                  <button onClick={handleCopy} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 8, border: "none", background: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, color: copied ? "#10b981" : "rgba(255,255,255,.5)" }}>
                    {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                  </button>
                </div>
                <div style={{ padding: 20, fontFamily: "'Geist Mono', 'JetBrains Mono', monospace", fontSize: 13, lineHeight: 2 }}>
                  {QUICKSTART.split("\n").map((line, i) => (
                    <div key={i} style={{ display: "flex", gap: 12 }}>
                      <span style={{ color: "rgba(255,255,255,.15)", userSelect: "none" }}>$</span>
                      <span style={{ color: "rgba(255,255,255,.85)" }}>{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.15} style={{ marginTop: 24, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20 }}>
              <a href={`${DOCS_URL}getting-started/quickstart/`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, textDecoration: "none", ...s.muted }}>
                Full quickstart guide <ArrowRight size={14} />
              </a>
              <span style={{ width: 4, height: 4, borderRadius: "50%", ...s.faint, background: dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.15)" }} />
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, textDecoration: "none", ...s.muted }}>
                <Github size={14} /> View source
              </a>
            </Reveal>
          </div>
        </div>

        {/* ── Final CTA ── */}
        <div style={{ ...s.divider }}>
          <div style={{ ...wrap, ...sectionPad, textAlign: "center" }}>
            <Reveal>
              <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.75rem)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, ...s.text }}>
                Start with one team.<br />See the margin difference.
              </h2>
              <p style={{ marginTop: 20, fontSize: "clamp(1rem, 1.8vw, 1.15rem)", lineHeight: 1.7, ...s.muted, maxWidth: "32rem", margin: "20px auto 0" }}>
                Pick your highest-coordination team. Run OpenPing for two weeks. Measure the time saved. The numbers speak.
              </p>
            </Reveal>

            <Reveal delay={0.15} style={{ marginTop: 40, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
              <Link href="/sign-in" style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 48, padding: "0 32px", borderRadius: 10, background: "#5E6AD2", color: "#fff", fontSize: 15, fontWeight: 500, textDecoration: "none" }}>
                Start a pilot <ArrowRight size={16} />
              </Link>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 48, padding: "0 32px", borderRadius: 10, border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.02)", fontSize: 15, fontWeight: 500, textDecoration: "none", ...s.muted }}>
                <Github size={16} /> Star on GitHub
              </a>
            </Reveal>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer style={{ padding: "32px 0", textAlign: "center", ...s.divider }}>
          <div style={{ ...wrap, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/bw_logotype_onbalck_padding.png" alt="OpenPing" style={{ height: 16, width: "auto", opacity: 0.4, filter: dark ? "none" : "invert(1)" }} />
              <span style={{ fontSize: 11, ...s.faint }}>&copy; 2026 &middot; MIT License</span>
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
              {[
                { href: "/manifesto", label: "Manifesto", ext: false },
                { href: DOCS_URL, label: "Docs", ext: true },
                { href: GITHUB_URL, label: "GitHub", ext: true },
                { href: "/privacy", label: "Privacy", ext: false },
                { href: "/terms", label: "Terms", ext: false },
                { href: "/sign-in", label: "Sign in", ext: false },
              ].map(link => link.ext ? (
                <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, textDecoration: "none", ...s.faint }}>{link.label}</a>
              ) : (
                <Link key={link.label} href={link.href} style={{ fontSize: 11, textDecoration: "none", ...s.faint }}>{link.label}</Link>
              ))}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
