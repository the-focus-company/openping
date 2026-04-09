import { motion } from "framer-motion";
import { useEffect, useState, useRef, useCallback } from "react";
import { Sun, Moon } from "lucide-react";

/* ── Neural Background (simplified - single palette) ── */
const DARK_PALETTE = { idle: [45, 75, 130], active: [139, 92, 246], idleEdge: [30, 58, 138], activeEdge: [139, 92, 246] };
const LIGHT_PALETTE = { idle: [148, 163, 184], active: [124, 58, 237], idleEdge: [203, 213, 225], activeEdge: [124, 58, 237] };

function NeuralBg({ theme }: { theme: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<any>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const COUNT = 80;
    const MAX_D = 150;
    const MAX_D_SQ = MAX_D * MAX_D;
    let w = window.innerWidth, h = window.innerHeight;
    function resize() {
      w = window.innerWidth; h = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = w * dpr; canvas!.height = h * dpr;
      ctx!.scale(dpr, dpr);
      if (stateRef.current) { stateRef.current.w = w; stateRef.current.h = h; }
    }
    resize();
    window.addEventListener("resize", resize);
    const neurons: any[] = [];
    for (let i = 0; i < COUNT; i++) {
      const r = Math.random() * 1.5 + 1;
      neurons.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.12, vy: (Math.random() - 0.5) * 0.12, radius: r, baseRadius: r, activation: 0 });
    }
    const palette = theme === "light" ? LIGHT_PALETTE : DARK_PALETTE;
    stateRef.current = { neurons, palette, mouseAct: 0, lastMX: 0, lastMY: 0, lastMT: 0, lastFrame: performance.now(), pulseT: 0, animId: 0, w, h };
    const s = stateRef.current;
    function pulse() {
      const idle = s.neurons.filter((n: any) => n.activation < 0.2);
      if (!idle.length) return;
      const start = idle[~~(Math.random() * idle.length)];
      start.activation = 1;
      setTimeout(() => { for (const n of s.neurons) if (n !== start && n.activation < 0.5) { const dx = start.x - n.x, dy = start.y - n.y; if (dx * dx + dy * dy < MAX_D_SQ) n.activation = 0.8; } }, 800);
    }
    pulse();
    function onMM(e: MouseEvent) {
      const now = performance.now();
      if (s.lastMT > 0) { const dt = now - s.lastMT, dx = e.clientX - s.lastMX, dy = e.clientY - s.lastMY; s.mouseAct = Math.min(1, s.mouseAct + Math.sqrt(dx * dx + dy * dy) / Math.max(1, dt) / 5 * 0.4); }
      s.lastMX = e.clientX; s.lastMY = e.clientY; s.lastMT = now;
    }
    window.addEventListener("mousemove", onMM);
    function anim() {
      const now = performance.now(), dt = now - s.lastFrame; s.lastFrame = now;
      ctx!.clearRect(0, 0, s.w, s.h);
      if (s.mouseAct > 0) { s.mouseAct -= dt / 1000; if (s.mouseAct < 0) s.mouseAct = 0; }
      s.pulseT += dt; if (s.pulseT >= 3000 - s.mouseAct * 2950) { pulse(); s.pulseT = 0; }
      const p = s.palette, decay = 0.005 + s.mouseAct * 0.015;
      for (const n of s.neurons) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -50) n.vx += 0.01; if (n.x > s.w + 50) n.vx -= 0.01;
        if (n.y < -50) n.vy += 0.01; if (n.y > s.h + 50) n.vy -= 0.01;
        if (n.activation > 0) { n.activation -= decay; if (n.activation < 0) n.activation = 0; }
        n.radius = n.baseRadius + n.activation * 2;
      }
      for (let i = 0; i < neurons.length; i++) {
        const n1 = neurons[i];
        for (let j = i + 1; j < neurons.length; j++) {
          const n2 = neurons[j]; const dx = n1.x - n2.x, dy = n1.y - n2.y, dSq = dx * dx + dy * dy;
          if (dSq < MAX_D_SQ) {
            const dist = Math.sqrt(dSq), dA = 1 - dist / MAX_D, mA = Math.max(n1.activation, n2.activation);
            ctx!.beginPath(); ctx!.moveTo(n1.x, n1.y); ctx!.lineTo(n2.x, n2.y);
            if (mA > 0.1) { const r = ~~(p.idleEdge[0] + (p.activeEdge[0] - p.idleEdge[0]) * mA), g = ~~(p.idleEdge[1] + (p.activeEdge[1] - p.idleEdge[1]) * mA), b = ~~(p.idleEdge[2] + (p.activeEdge[2] - p.idleEdge[2]) * mA); ctx!.strokeStyle = `rgba(${r},${g},${b},${dA * (0.2 + mA * 0.6)})`; ctx!.lineWidth = 1 + mA * 1.5; }
            else { ctx!.strokeStyle = `rgba(${p.idleEdge[0]},${p.idleEdge[1]},${p.idleEdge[2]},${dA * 0.2})`; ctx!.lineWidth = 1; }
            ctx!.stroke();
          }
        }
      }
      for (const n of neurons) {
        if (n.activation > 0.1) { ctx!.beginPath(); ctx!.arc(n.x, n.y, n.radius + 6 * n.activation, 0, Math.PI * 2); ctx!.fillStyle = `rgba(${p.active[0]},${p.active[1]},${p.active[2]},${n.activation * 0.25})`; ctx!.fill(); }
        const r = ~~(p.idle[0] + (p.active[0] - p.idle[0]) * n.activation), g = ~~(p.idle[1] + (p.active[1] - p.idle[1]) * n.activation), b = ~~(p.idle[2] + (p.active[2] - p.idle[2]) * n.activation);
        ctx!.beginPath(); ctx!.arc(n.x, n.y, n.radius, 0, Math.PI * 2); ctx!.fillStyle = `rgba(${r},${g},${b},${0.4 + n.activation * 0.6})`; ctx!.fill();
      }
      s.animId = requestAnimationFrame(anim);
    }
    s.animId = requestAnimationFrame(anim);
    return () => { cancelAnimationFrame(s.animId); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", onMM); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (stateRef.current) stateRef.current.palette = theme === "light" ? LIGHT_PALETTE : DARK_PALETTE; }, [theme]);

  const bgRgb = theme === "light" ? "248,250,252" : "0,0,0";
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 60% 50% at 50% 50%, rgba(${bgRgb},0.92) 0%, rgba(${bgRgb},0.7) 50%, rgba(${bgRgb},0.2) 100%)` }} />
    </div>
  );
}

/* ── Primitives ── */
function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 60, damping: 18, delay }} viewport={{ once: true, amount: 0.2 }} className={className}>
      {children}
    </motion.div>
  );
}

function ShimmerLogo({ invert }: { invert?: boolean }) {
  return (
    <motion.div className="inline-block" animate={{ filter: ["drop-shadow(0 0 8px rgba(99,102,241,0.3))","drop-shadow(0 0 20px rgba(139,92,246,0.5))","drop-shadow(0 0 12px rgba(168,85,247,0.3))","drop-shadow(0 0 8px rgba(99,102,241,0.3))"] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
      <img src="/bw_logotype_onbalck_padding.png" alt="OpenPing" className={`h-8 md:h-10 w-auto ${invert ? "invert" : ""}`} />
    </motion.div>
  );
}

/* ── Manifesto ── */
export default function Manifesto() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const isDark = theme === "dark";
  const txt = isDark ? "text-white" : "text-neutral-900";
  const txtMuted = isDark ? "text-neutral-400" : "text-neutral-600";
  const txtFaint = isDark ? "text-neutral-600" : "text-neutral-400";
  const border = isDark ? "border-neutral-800" : "border-neutral-200";
  const bgCard = isDark ? "bg-neutral-950/80" : "bg-white/80";

  return (
    <>
      <div className={`fixed inset-0 ${isDark ? "bg-black" : "bg-[#fafafa]"} pointer-events-none`} style={{ zIndex: -1 }} />
      <NeuralBg theme={theme} />

      {/* Nav */}
      <nav className={`fixed top-0 z-50 w-full backdrop-blur-xl ${isDark ? "bg-black/60 border-b border-neutral-800/50" : "bg-white/60 border-b border-neutral-200/50"}`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between h-14 px-6">
          <a href="/deck" className="flex items-center gap-2">
            <ShimmerLogo invert={!isDark} />
          </a>
          <div className="flex items-center gap-4">
            <span className={`text-xs uppercase tracking-[0.2em] font-medium ${txtFaint}`}>Manifesto</span>
            <button onClick={toggle} className={`p-2 rounded-full ${isDark ? "hover:bg-neutral-800" : "hover:bg-neutral-100"} transition-colors`}>
              {isDark ? <Sun className="w-4 h-4 text-neutral-500" /> : <Moon className="w-4 h-4 text-neutral-500" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="relative z-10 min-h-screen pt-14" style={{ scrollbarWidth: "none" }}>

        {/* Hero */}
        <section className="h-[100dvh] flex flex-col items-center justify-center text-center px-6">
          <FadeUp>
            <h1 className={`text-[3rem] md:text-[5rem] lg:text-[7rem] font-bold tracking-tight leading-[0.9] ${txt}`}>
              OpenPing
            </h1>
            <p className={`mt-4 text-sm uppercase tracking-[0.3em] ${txtFaint}`}>Decision-first workspace</p>
          </FadeUp>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }} className={`mt-20 flex flex-col items-center gap-1.5 ${txtFaint}`}>
            <span className="text-xs tracking-[0.2em] uppercase">scroll</span>
            <div className={`w-px h-6 ${isDark ? "bg-gradient-to-b from-neutral-700 to-transparent" : "bg-gradient-to-b from-neutral-300 to-transparent"}`} />
          </motion.div>
        </section>

        {/* Opening thesis */}
        <section className="max-w-3xl mx-auto px-6 py-24 md:py-32">
          <FadeUp>
            <p className={`text-center text-xl md:text-2xl leading-relaxed ${txtMuted}`}>
              Work tools obsess over three actions: search, send, receive.
              <br />
              <span className={`font-medium ${txt}`}>We are building for the one that actually matters - decide.</span>
            </p>
          </FadeUp>
        </section>

        {/* The problem */}
        <section className="max-w-3xl mx-auto px-6 pb-24">
          <FadeUp>
            <p className={`text-base md:text-lg leading-[1.8] ${txtMuted} mb-5`}>
              Today's collaboration software was designed for a world where humans had to do everything manually: notice a message, interpret its urgency, find the missing context, search across tools, summarize for others, and finally - decide what to do.
            </p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className={`text-base md:text-lg leading-[1.8] ${txtMuted} mb-5`}>
              That model turns capable people into routers of information, collectors of context, and bottlenecks in decision chains.
            </p>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p className={`text-base md:text-lg leading-[1.8] font-medium ${txt}`}>
              The value is not created when information moves. It is created when <em>the right person makes the right call with the right context at the right time.</em> That is the job. Not chatting. Not scrolling. Decision-making.
            </p>
          </FadeUp>
        </section>

        {/* Human + AI */}
        <section className={`max-w-3xl mx-auto px-6 pb-24 pl-10 md:pl-14 border-l-2 ${isDark ? "border-neutral-800" : "border-neutral-200"}`}>
          <FadeUp>
            <p className={`text-base md:text-lg leading-[1.8] ${txtMuted} mb-4`}>
              Context - gathered, synthesized, ranked, traced - can increasingly be handled by AI.
            </p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className={`text-base md:text-lg leading-[1.8] ${txtMuted} mb-4`}>
              Judgment, accountability, taste, strategic intuition, the principled risk - those still belong to people.
            </p>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p className={`text-lg md:text-xl font-medium leading-[1.7] ${txt}`}>
              OpenPing is built on a simple idea: let AI do the assembly. Let humans do the deciding.
            </p>
          </FadeUp>
        </section>

        {/* Three pillars */}
        <section className="max-w-3xl mx-auto px-6 pb-24">
          <div className="space-y-10">
            {[
              { n: "01", title: "Surfaces the right decisions", body: "Not everything deserves attention. OpenPing identifies what actually needs a human call - nothing more, nothing less." },
              { n: "02", title: "Prepares them with the right context", body: "Not too much. Not too little. Enough to move with confidence, with depth available on demand." },
              { n: "03", title: "Turns decisions into motion", body: "A decision should not die in a thread. It triggers coordination, delegation, reminders, and execution immediately." },
            ].map((p, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <div className="flex gap-5">
                  <span className={`text-3xl font-bold tracking-tight shrink-0 ${isDark ? "text-neutral-800" : "text-neutral-200"}`}>{p.n}</span>
                  <div>
                    <p className={`font-medium mb-1 text-base md:text-lg ${txt}`}>{p.title}</p>
                    <p className={`text-base leading-[1.8] ${txtMuted}`}>{p.body}</p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </section>

        {/* Beliefs */}
        <section className="max-w-3xl mx-auto px-6 pb-24">
          <div className="space-y-4">
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
              <FadeUp key={i} delay={i * 0.04}>
                <p className={`text-lg md:text-xl leading-[1.7] ${txtMuted}`}>{b}</p>
              </FadeUp>
            ))}
          </div>
        </section>

        {/* Closing */}
        <section className="max-w-3xl mx-auto px-6 pb-32 text-center">
          <FadeUp>
            <p className={`text-2xl md:text-3xl font-bold tracking-tight ${txt}`}>
              Clearer judgment. Faster coordinated action.
            </p>
            <p className={`mt-4 text-lg ${txtMuted}`}>
              That is what OpenPing is here to build.
            </p>
          </FadeUp>
        </section>

        {/* Footer */}
        <footer className={`border-t ${border} py-8 text-center`}>
          <a href="/deck" className={`text-sm ${txtFaint} hover:${txt} transition-colors`}>
            &larr; Back to deck
          </a>
        </footer>
      </main>
    </>
  );
}
