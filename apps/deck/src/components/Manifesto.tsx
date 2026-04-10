import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { Sun, Moon } from "lucide-react";

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
    const N = 70, MD = 140, MD2 = MD * MD;
    let w = window.innerWidth, h = window.innerHeight;
    function resize() {
      w = window.innerWidth; h = window.innerHeight;
      const d = window.devicePixelRatio || 1;
      canvas!.width = w * d; canvas!.height = h * d; ctx!.scale(d, d);
      if (stateRef.current) { stateRef.current.w = w; stateRef.current.h = h; }
    }
    resize(); window.addEventListener("resize", resize);
    const ns: any[] = [];
    for (let i = 0; i < N; i++) { const r = Math.random() * 1.5 + 1; ns.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .1, vy: (Math.random() - .5) * .1, r, br: r, a: 0 }); }
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
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 45% 35% at 50% 50%, rgba(${bg},.85) 0%, rgba(${bg},.4) 55%, rgba(${bg},0) 100%)` }} />
    </div>
  );
}

/* ── Theme helper ── */
function c(dark: boolean) {
  return {
    text: { color: dark ? "#fff" : "#0a0a0a" },
    muted: { color: dark ? "#a3a3a3" : "#525252" },
    faint: { color: dark ? "#525252" : "#a3a3a3" },
    pillarNum: { color: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.06)" },
    bg: { background: dark ? "#000" : "#fafafa" },
    navBg: { background: dark ? "rgba(0,0,0,.7)" : "rgba(255,255,255,.7)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` },
    sidebar: { borderLeft: `2px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}` },
    scrollLine: { background: dark ? "linear-gradient(to bottom, rgba(255,255,255,.2), transparent)" : "linear-gradient(to bottom, rgba(0,0,0,.2), transparent)" },
    footerBorder: { borderTop: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` },
  };
}

export default function Manifesto() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const toggle = () => { const n = theme === "dark" ? "light" : "dark"; setTheme(n); document.documentElement.setAttribute("data-theme", n); };
  const dark = theme === "dark";
  const s = c(dark);

  const body: React.CSSProperties = { fontSize: "clamp(1rem, 1.8vw, 1.125rem)", lineHeight: 1.85, marginBottom: 20, ...s.muted };
  const wrap: React.CSSProperties = { maxWidth: "42rem", margin: "0 auto", padding: "0 24px" };

  return (
    <div style={{ minHeight: "100vh", ...s.bg, fontFamily: "'Outfit', system-ui, sans-serif", WebkitFontSmoothing: "antialiased" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: -1, ...s.bg }} />
      <NeuralBg theme={theme} />

      {/* Nav */}
      <nav style={{ position: "fixed", top: 0, zIndex: 50, width: "100%", ...s.navBg }}>
        <div style={{ maxWidth: "56rem", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, padding: "0 24px" }}>
          <a href="/deck" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <motion.div style={{ display: "inline-block" }} animate={{ filter: ["drop-shadow(0 0 6px rgba(99,102,241,.3))","drop-shadow(0 0 14px rgba(139,92,246,.4))","drop-shadow(0 0 8px rgba(168,85,247,.3))","drop-shadow(0 0 6px rgba(99,102,241,.3))"] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
              <img src="/bw_logotype_onbalck_padding.png" alt="OpenPing" style={{ height: 28, width: "auto", filter: dark ? "none" : "invert(1)" }} />
            </motion.div>
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 500, ...s.faint }}>Manifesto</span>
            <button onClick={toggle} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", border: "none", background: "none", cursor: "pointer", ...s.faint }}>
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main style={{ position: "relative", zIndex: 10, paddingTop: 56 }}>

        {/* Header */}
        <div style={{ ...wrap, paddingTop: 64, paddingBottom: 48 }}>
          <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 500, marginBottom: 16, ...s.faint }}>Manifesto</p>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: 24, ...s.text }}>
            Decision-first workspace
          </h1>
          <p style={{ fontSize: "clamp(1.1rem, 2.2vw, 1.35rem)", lineHeight: 1.7, ...s.muted }}>
            Work tools obsess over three actions: search, send, receive.{" "}
            <span style={{ fontWeight: 500, ...s.text }}>We are building for the one that actually matters - decide.</span>
          </p>
        </div>

        {/* The problem */}
        <div style={{ ...wrap, paddingBottom: 80 }}>
          <p style={body}>
            Today's collaboration software was designed for a world where humans had to do everything manually: notice a message, interpret its urgency, find the missing context, search across tools, summarize for others, and finally - decide what to do.
          </p>
          <p style={body}>
            That model turns capable people into routers of information, collectors of context, and bottlenecks in decision chains.
          </p>
          <p style={{ ...body, fontWeight: 500, ...s.text }}>
            The value is not created when information moves. It is created when <em>the right person makes the right call with the right context at the right time.</em> That is the job. Not chatting. Not scrolling. Decision-making.
          </p>
        </div>

        {/* Human + AI */}
        <div style={{ ...wrap, paddingBottom: 80, paddingLeft: 48, ...s.sidebar }}>
          <p style={body}>
            Context - gathered, synthesized, ranked, traced - can increasingly be handled by AI.
          </p>
          <p style={body}>
            Judgment, accountability, taste, strategic intuition, the principled risk - those still belong to people.
          </p>
          <p style={{ fontSize: "clamp(1.05rem, 2vw, 1.25rem)", lineHeight: 1.75, fontWeight: 500, ...s.text }}>
            OpenPing is built on a simple idea: let AI do the assembly. Let humans do the deciding.
          </p>
        </div>

        {/* Three pillars */}
        <div style={{ ...wrap, paddingBottom: 80 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            {[
              { n: "01", title: "Surfaces the right decisions", body: "Not everything deserves attention. OpenPing identifies what actually needs a human call - nothing more, nothing less." },
              { n: "02", title: "Prepares them with the right context", body: "Not too much. Not too little. Enough to move with confidence, with depth available on demand." },
              { n: "03", title: "Turns decisions into motion", body: "A decision should not die in a thread. It triggers coordination, delegation, reminders, and execution immediately." },
            ].map((p, i) => (
              <div key={i} style={{ display: "flex", gap: 20 }}>
                <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", flexShrink: 0, fontVariantNumeric: "tabular-nums", ...s.pillarNum }}>{p.n}</span>
                <div>
                  <p style={{ fontWeight: 500, marginBottom: 4, fontSize: "clamp(1rem, 1.8vw, 1.125rem)", ...s.text }}>{p.title}</p>
                  <p style={{ fontSize: "clamp(0.95rem, 1.6vw, 1.05rem)", lineHeight: 1.85, ...s.muted }}>{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Beliefs */}
        <div style={{ ...wrap, paddingBottom: 80 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              "Work software should respect attention.",
              "The message feed is the wrong center of gravity for modern teams.",
              "AI should prepare better decisions, not just answer questions.",
              "Context should come to the decision-maker - not the other way around.",
              "The best systems reduce noise without reducing nuance.",
              "Important decisions should be explainable, traceable, and actionable.",
              "Once a human makes the call, software should help execute it immediately.",
              "The future of collaboration is not more conversation.",
            ].map((b, i) => (
              <p key={i} style={{ fontSize: "clamp(1.05rem, 2vw, 1.25rem)", lineHeight: 1.75, ...s.muted }}>{b}</p>
            ))}
          </div>
        </div>

        {/* Closing */}
        <div style={{ ...wrap, paddingBottom: 120, textAlign: "center" }}>
          <p style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", fontWeight: 700, letterSpacing: "-0.02em", ...s.text }}>
            Clearer judgment. Faster coordinated action.
          </p>
          <p style={{ marginTop: 16, fontSize: "clamp(1.05rem, 2vw, 1.25rem)", ...s.muted }}>
            That is what OpenPing is here to build.
          </p>
        </div>

        {/* Footer */}
        <footer style={{ padding: "32px 0", textAlign: "center", ...s.footerBorder }}>
          <a href="/deck" style={{ fontSize: 14, textDecoration: "none", ...s.faint }}>
            &larr; Back to deck
          </a>
        </footer>
      </main>
    </div>
  );
}
