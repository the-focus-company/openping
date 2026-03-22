"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

/* ───────────────────────────── Gordian Knot Canvas ───────────────────────────── */

function GordianKnot({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    type Vec3 = { x: number; y: number; z: number };
    type Frame = { P: Vec3; T: Vec3; N: Vec3; B: Vec3 };

    const cross = (a: Vec3, b: Vec3): Vec3 => ({
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    });
    const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
    const normalize = (v: Vec3): Vec3 => {
      const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      if (len === 0) return { x: 0, y: 0, z: 0 };
      return { x: v.x / len, y: v.y / len, z: v.z / len };
    };
    const rotateAroundAxis = (v: Vec3, k: Vec3, theta: number): Vec3 => {
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const kXv = cross(k, v);
      const kDotV = dot(k, v);
      const oneMinusCos = 1 - cos;
      return {
        x: v.x * cos + kXv.x * sin + k.x * kDotV * oneMinusCos,
        y: v.y * cos + kXv.y * sin + k.y * kDotV * oneMinusCos,
        z: v.z * cos + kXv.z * sin + k.z * kDotV * oneMinusCos,
      };
    };

    const spineNodes = 300;
    const tubeNodes = 8;
    const tubeRadius = 14;
    const p = 3;
    const q = 7;
    const R = 150;
    const r0 = 55;

    function getSpinePoint(t: number): Vec3 {
      const r = R + r0 * Math.cos(q * t);
      const x = r * Math.cos(p * t);
      const y = r * Math.sin(p * t);
      const z = r0 * Math.sin(q * t) - 30 * Math.sin(p * t);
      return { x, y, z };
    }

    function getTangent(t: number): Vec3 {
      const d = 0.001;
      const p1 = getSpinePoint(t - d);
      const p2 = getSpinePoint(t + d);
      return normalize({ x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z });
    }

    const vertices: Vec3[] = [];
    const edges: { a: number; b: number }[] = [];
    const frames: Frame[] = [];

    let prevN: Vec3 = { x: 0, y: 0, z: 1 };
    for (let i = 0; i <= spineNodes; i++) {
      const t = (i / spineNodes) * Math.PI * 2;
      const P = getSpinePoint(t);
      const T = getTangent(t);
      let N: Vec3;
      if (i === 0) {
        let UP: Vec3 = { x: 0, y: 1, z: 0 };
        if (Math.abs(T.y) > 0.9) UP = { x: 1, y: 0, z: 0 };
        N = normalize(cross(T, UP));
      } else {
        const dotTN = dot(T, prevN);
        N = normalize({
          x: prevN.x - dotTN * T.x,
          y: prevN.y - dotTN * T.y,
          z: prevN.z - dotTN * T.z,
        });
      }
      const B = cross(T, N);
      prevN = N;
      frames.push({ P, T, N, B });
    }

    const firstFrame = frames[0];
    const lastFrame = frames[spineNodes];
    const cosTheta = dot(lastFrame.N, firstFrame.N);
    const sinTheta = dot(cross(firstFrame.N, lastFrame.N), firstFrame.T);
    let totalTwist = Math.atan2(sinTheta, cosTheta);
    if (totalTwist > Math.PI) totalTwist -= Math.PI * 2;
    if (totalTwist < -Math.PI) totalTwist += Math.PI * 2;

    for (let i = 0; i <= spineNodes; i++) {
      const correctionAngle = -(i / spineNodes) * totalTwist;
      frames[i].N = rotateAroundAxis(frames[i].N, frames[i].T, correctionAngle);
      frames[i].B = cross(frames[i].T, frames[i].N);
    }

    for (let i = 0; i < spineNodes; i++) {
      const frame = frames[i];
      for (let j = 0; j < tubeNodes; j++) {
        const angle = (j / tubeNodes) * Math.PI * 2;
        const cx = Math.cos(angle) * tubeRadius;
        const cy = Math.sin(angle) * tubeRadius;
        vertices.push({
          x: frame.P.x + cx * frame.N.x + cy * frame.B.x,
          y: frame.P.y + cx * frame.N.y + cy * frame.B.y,
          z: frame.P.z + cx * frame.N.z + cy * frame.B.z,
        });
      }
    }

    for (let i = 0; i < spineNodes; i++) {
      for (let j = 0; j < tubeNodes; j++) {
        const current = i * tubeNodes + j;
        const nextAround = i * tubeNodes + ((j + 1) % tubeNodes);
        const nextAlong = ((i + 1) % spineNodes) * tubeNodes + j;
        edges.push({ a: current, b: nextAround });
        edges.push({ a: current, b: nextAlong });
      }
    }

    // Detect dark mode
    const isDark = () => document.documentElement.classList.contains("dark");

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "-400 -400 800 800");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.cursor = "grab";

    const defs = document.createElementNS(svgNS, "defs");
    defs.innerHTML = `<filter id="knot-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    svg.appendChild(defs);

    const numBuckets = 20;
    const pathEls: SVGPathElement[] = [];

    function updateColors() {
      const dark = isDark();
      for (let i = 0; i < numBuckets; i++) {
        const depthRatio = i / (numBuckets - 1);
        const lightness = dark
          ? 10 + depthRatio * 80   // dark: 10% -> 90% (dark gray -> bright white)
          : 90 - depthRatio * 80;  // light: 90% -> 10% (light gray -> near black)
        const opacity = 0.15 + depthRatio * 0.85;
        pathEls[i].setAttribute("stroke", `hsl(0, 0%, ${lightness}%)`);
        pathEls[i].setAttribute("stroke-opacity", String(opacity));
      }
    }

    for (let i = 0; i < numBuckets; i++) {
      const pathEl = document.createElementNS(svgNS, "path");
      const depthRatio = i / (numBuckets - 1);
      pathEl.setAttribute("fill", "none");
      pathEl.setAttribute("stroke-width", depthRatio > 0.8 ? "1.5" : "1");
      pathEl.setAttribute("stroke-linecap", "round");
      pathEl.setAttribute("stroke-linejoin", "round");
      if (i > numBuckets - 4) pathEl.setAttribute("filter", "url(#knot-glow)");
      svg.appendChild(pathEl);
      pathEls.push(pathEl);
    }

    updateColors();

    // Watch for theme changes
    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    container.appendChild(svg);

    let rotationX = 0.4;
    let rotationY = 0.6;
    const autoRotateSpeedY = 0.003;
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let animId: number;

    const handleDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      svg.style.cursor = "grabbing";
      const ev = "touches" in e ? e.touches[0] : e;
      prevMouse = { x: ev.clientX, y: ev.clientY };
    };
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const ev = "touches" in e ? e.touches[0] : e;
      rotationY += (ev.clientX - prevMouse.x) * 0.008;
      rotationX -= (ev.clientY - prevMouse.y) * 0.008;
      prevMouse = { x: ev.clientX, y: ev.clientY };
    };
    const handleUp = () => {
      isDragging = false;
      svg.style.cursor = "grab";
    };

    svg.addEventListener("mousedown", handleDown);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    svg.addEventListener("touchstart", handleDown);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);

    const focalLength = 600;
    const fixedRange = R + r0 + tubeRadius;

    function animate() {
      if (!isDragging) rotationY += autoRotateSpeedY;

      const sinX = Math.sin(rotationX);
      const cosX = Math.cos(rotationX);
      const sinY = Math.sin(rotationY);
      const cosY = Math.cos(rotationY);

      const rotated: Vec3[] = [];
      for (const v of vertices) {
        const x1 = v.x * cosY - v.z * sinY;
        const z1 = v.z * cosY + v.x * sinY;
        const y2 = v.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + v.y * sinX;
        rotated.push({ x: x1, y: y2, z: z2 });
      }

      const dStrings = Array(numBuckets).fill("");
      const zRange = fixedRange * 2;
      const minZ = -fixedRange;

      for (const edge of edges) {
        const vA = rotated[edge.a];
        const vB = rotated[edge.b];
        const zAvg = (vA.z + vB.z) / 2;
        const scaleA = focalLength / (focalLength - vA.z);
        const scaleB = focalLength / (focalLength - vB.z);
        let normalizedZ = (zAvg - minZ) / zRange;
        if (normalizedZ < 0) normalizedZ = 0;
        if (normalizedZ > 0.999) normalizedZ = 0.999;
        const bucket = Math.floor(normalizedZ * numBuckets);
        dStrings[bucket] += `M ${(vA.x * scaleA).toFixed(1)} ${(vA.y * scaleA).toFixed(1)} L ${(vB.x * scaleB).toFixed(1)} ${(vB.y * scaleB).toFixed(1)} `;
      }

      for (let i = 0; i < numBuckets; i++) {
        pathEls[i].setAttribute("d", dStrings[i]);
      }

      animId = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      svg.removeEventListener("mousedown", handleDown);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      svg.removeEventListener("touchstart", handleDown);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
      container.removeChild(svg);
    };
  }, []);

  return <div ref={containerRef} className={className} />;
}

/* ────────────────────────────── Page ───────────────────────────── */

export default function ManifestoPage() {
  return (
    <div className="min-h-screen bg-white text-black/70 selection:bg-black/10 dark:bg-[#0a0a0a] dark:text-white/70 dark:selection:bg-white/10">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#0a0a0a]/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bw_logotype_onwhite_padding.png" alt="PING" className="h-5 w-auto dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bw_logotype_onbalck_padding.png" alt="PING" className="hidden h-5 w-auto dark:block" />
          </Link>
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-black/25 dark:text-white/25">
            Manifesto
          </span>
        </div>
      </nav>

      {/* Hero — Supersized Gordian Knot as animated logotype */}
      <section className="relative flex h-screen flex-col items-center justify-center overflow-hidden">
        {/* Full-bleed knot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-[90vh] w-[90vh] max-h-[90vw] max-w-[90vw]">
            <GordianKnot className="h-full w-full" />
          </div>
        </div>

        {/* Radial fade edges */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,white_75%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_40%,#0a0a0a_75%)]" />

        {/* Title overlaid on knot */}
        <div className="relative z-10 text-center">
          <h1 className="text-6xl font-bold tracking-tight text-black dark:text-white sm:text-8xl md:text-9xl">
            PING
          </h1>
          <p className="mt-4 text-sm uppercase tracking-[0.4em] text-black/30 dark:text-white/30">
            Decision-first workspace
          </p>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-10 flex flex-col items-center gap-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-black/20 dark:text-white/20">
            scroll
          </p>
          <div className="h-8 w-px bg-gradient-to-b from-black/20 to-transparent dark:from-white/20" />
        </div>
      </section>

      {/* Manifesto content — tight, punchy */}
      <main className="relative z-10 mx-auto max-w-2xl px-6 pb-32 pt-24">
        {/* Opening */}
        <p className="mb-16 text-center text-xl leading-relaxed text-black/50 dark:text-white/50 md:text-2xl">
          Most work tools optimize for search, send, and receive.
          <br />
          <span className="font-medium text-black dark:text-white">
            We are building for the fourth action: decide.
          </span>
        </p>

        {/* The problem — condensed */}
        <section className="mb-20">
          <p className="mb-6 leading-relaxed">
            Today&rsquo;s communication tools turn capable people into routers
            of information, collectors of context, and bottlenecks in decision
            chains. The value isn&rsquo;t created when information moves. It&rsquo;s
            created when{" "}
            <strong className="text-black dark:text-white">
              the right person makes the right call with the right context
            </strong>
            .
          </p>
          <p className="font-medium text-black dark:text-white">
            That is the job. Not chatting. Not scrolling. Decision-making.
          </p>
        </section>

        {/* Human + AI — the essential belief */}
        <section className="mb-20 border-l-2 border-black/10 pl-8 dark:border-white/10">
          <p className="mb-4 text-lg leading-relaxed">
            AI gathers, ranks, links, and orchestrates context.
          </p>
          <p className="text-lg font-medium text-black dark:text-white">
            Humans do the judgment.
          </p>
        </section>

        {/* What PING does — three pillars */}
        <section className="mb-20">
          <div className="space-y-10">
            {[
              {
                num: "01",
                title: "Surfaces the right decisions",
                body: "Not everything deserves attention. PING identifies what actually needs a human call.",
              },
              {
                num: "02",
                title: "Prepares them with context",
                body: "Not too much. Not too little. Enough to move with confidence, with depth on demand.",
              },
              {
                num: "03",
                title: "Turns decisions into motion",
                body: "A decision should not die in a thread. It triggers coordination, delegation, and execution.",
              },
            ].map(({ num, title, body }) => (
              <div key={num} className="flex gap-6">
                <span className="font-mono text-2xl font-bold text-black/[0.06] dark:text-white/[0.06]">
                  {num}
                </span>
                <div>
                  <p className="mb-1 font-medium text-black dark:text-white">{title}</p>
                  <p className="leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Beliefs — the manifesto core */}
        <section className="mb-20">
          <div className="space-y-3">
            {[
              "Work software should respect attention.",
              "The message feed is the wrong center of gravity.",
              "AI should prepare better decisions, not just answer questions.",
              "Context should come to the decision-maker.",
              "The best systems reduce noise without reducing nuance.",
              "Once a human makes the call, software should execute immediately.",
            ].map((belief) => (
              <p key={belief} className="text-lg leading-relaxed">
                {belief}
              </p>
            ))}
          </div>
        </section>

        {/* Closing */}
        <section className="text-center">
          <p className="text-2xl font-bold tracking-tight text-black dark:text-white md:text-3xl">
            The future of collaboration is not more conversation.
          </p>
          <p className="mt-4 text-lg text-black/50 dark:text-white/50">
            It is clearer judgment and faster coordinated action.
          </p>
          <p className="mt-8 text-sm font-medium uppercase tracking-[0.2em] text-black/30 dark:text-white/30">
            That is what PING is here to build.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-black/[0.06] py-12 text-center dark:border-white/[0.06]">
        <Link href="/" className="text-sm text-black/25 transition-colors hover:text-black/50 dark:text-white/25 dark:hover:text-white/50">
          &larr; Back to PING
        </Link>
      </footer>
    </div>
  );
}
