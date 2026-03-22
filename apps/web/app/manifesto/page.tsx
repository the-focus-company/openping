"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Metadata } from "next";

/* ───────────────────────────── Gordian Knot Canvas ───────────────────────────── */

function GordianKnot() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Vector Math Utilities ---
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

    type Vec3 = { x: number; y: number; z: number };
    type Frame = { P: Vec3; T: Vec3; N: Vec3; B: Vec3 };

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

    // --- SVG Setup ---
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "-400 -400 800 800");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.cursor = "grab";

    const defs = document.createElementNS(svgNS, "defs");
    defs.innerHTML = `<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    svg.appendChild(defs);

    const numBuckets = 20;
    const pathEls: SVGPathElement[] = [];

    for (let i = 0; i < numBuckets; i++) {
      const pathEl = document.createElementNS(svgNS, "path");
      const depthRatio = i / (numBuckets - 1);
      const hue = 250 - depthRatio * 60;
      const lightness = 20 + depthRatio * 60;
      const opacity = 0.15 + depthRatio * 0.85;
      pathEl.setAttribute("fill", "none");
      pathEl.setAttribute("stroke", `hsl(${hue}, 100%, ${lightness}%)`);
      pathEl.setAttribute("stroke-width", depthRatio > 0.8 ? "1.5" : "1");
      pathEl.setAttribute("stroke-opacity", String(opacity));
      pathEl.setAttribute("stroke-linecap", "round");
      pathEl.setAttribute("stroke-linejoin", "round");
      if (i > numBuckets - 4) pathEl.setAttribute("filter", "url(#glow)");
      svg.appendChild(pathEl);
      pathEls.push(pathEl);
    }

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
      svg.removeEventListener("mousedown", handleDown);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      svg.removeEventListener("touchstart", handleDown);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
      container.removeChild(svg);
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}

/* ────────────────────────────── Section Components ───────────────────────────── */

function SectionDivider() {
  return (
    <div className="my-20 flex items-center justify-center">
      <div className="h-px w-16 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="mx-4 h-1 w-1 rounded-full bg-white/20" />
      <div className="h-px w-16 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}

function Quote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="border-l-2 border-white/20 pl-6 text-xl font-light italic leading-relaxed text-white/70 md:text-2xl">
      {children}
    </blockquote>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-8 text-2xl font-semibold tracking-tight text-white md:text-3xl">
      {children}
    </h2>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 mt-10 text-lg font-medium tracking-tight text-white/90 md:text-xl">
      {children}
    </h3>
  );
}

/* ────────────────────────────── Page ───────────────────────────── */

export default function ManifestoPage() {
  return (
    <div className="min-h-screen bg-[#050510] text-white/80 selection:bg-indigo-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/[0.06] bg-[#050510]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ping-logo-white.png"
              alt="PING"
              width={22}
              height={22}
            />
            <span className="text-sm font-semibold tracking-tight text-white">
              PING
            </span>
          </Link>
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/30">
            Manifesto
          </span>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden pt-14">
        {/* Gordian Knot background */}
        <div className="absolute inset-0 opacity-40">
          <GordianKnot />
        </div>

        {/* Radial fade overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#050510_70%)]" />

        {/* Hero text */}
        <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <p className="mb-6 text-xs font-medium uppercase tracking-[0.3em] text-indigo-400/80">
            A Paradigm Shift Manifesto
          </p>
          <h1 className="mb-8 text-5xl font-bold leading-[1.1] tracking-tight text-white md:text-7xl">
            PING That
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
              Works
            </span>
          </h1>
          <p className="mx-auto max-w-xl text-lg leading-relaxed text-white/50 md:text-xl">
            PING is not another chat app with AI bolted on.
            <br />
            PING is a{" "}
            <span className="text-white/90 font-medium">
              decision-first workspace
            </span>
            .
          </p>
          <div className="mt-12 flex justify-center">
            <div className="h-12 w-px bg-gradient-to-b from-white/20 to-transparent" />
          </div>
        </div>

        {/* Subtle hint */}
        <p className="absolute bottom-8 text-xs tracking-widest text-white/20">
          DRAG TO ROTATE
        </p>
      </section>

      {/* Content */}
      <main className="relative z-10 mx-auto max-w-2xl px-6 pb-32">
        {/* Core Thesis */}
        <section>
          <SectionHeading>The Core Thesis</SectionHeading>
          <p className="mb-6 leading-relaxed">
            Today, most work tools optimize for four user actions: search, send,
            receive, and decide. Most platforms obsess over the first three.
          </p>
          <Quote>We are building for the fourth.</Quote>
          <p className="mt-6 leading-relaxed">
            Because in real organizations, the value is not created when
            information moves. The value is created when{" "}
            <strong className="text-white">
              the right person makes the right decision with the right context at
              the right time
            </strong>
            .
          </p>
          <p className="mt-4 leading-relaxed">
            That is the job to be done. Not chatting. Not scrolling. Not inbox
            triage. Not hunting through ten tabs and fifteen threads.
          </p>
          <p className="mt-4 font-medium text-white">
            The job is decision-making.
          </p>
        </section>

        <SectionDivider />

        {/* The Problem */}
        <section>
          <SectionHeading>The Problem We Refuse to Accept</SectionHeading>
          <p className="mb-6 leading-relaxed">
            Work communication suites were built for a world where humans had to
            do everything manually &mdash; notice a message, interpret its
            urgency, find the missing context, ask follow-up questions, search in
            other tools, summarize the issue for others, decide what matters,
            trigger the next step.
          </p>
          <p className="mb-6 font-medium text-white">This model is broken.</p>
          <p className="mb-4 leading-relaxed">
            It turns highly capable people into:
          </p>
          <ul className="mb-6 list-none space-y-2 pl-0">
            {[
              "routers of information",
              "collectors of context",
              "translators between tools",
              "bottlenecks in decision chains",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-indigo-400/60" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="leading-relaxed">
            This is not a communication problem.{" "}
            <strong className="text-white">
              This is a cognitive systems problem.
            </strong>
          </p>
        </section>

        <SectionDivider />

        {/* Human + AI Collaboration */}
        <section>
          <SectionHeading>
            Our Belief About Human + AI Collaboration
          </SectionHeading>
          <p className="mb-6 leading-relaxed">
            A good decision requires <strong className="text-white">expertise + context</strong>.
          </p>
          <p className="mb-6 leading-relaxed">
            Context can increasingly be gathered, synthesized, ranked, expanded,
            traced, and refreshed by AI.
          </p>
          <p className="mb-4 leading-relaxed">
            Expertise is different. Expertise is not just memory. It is:
          </p>
          <ul className="mb-6 list-none space-y-2 pl-0">
            {[
              "pattern recognition across domains",
              "judgment under uncertainty",
              "moral and organizational reasoning",
              "taste",
              "accountability",
              "strategic intuition",
              "the ability to take a principled risk",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-400/60" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mb-6 leading-relaxed">
            So we do not believe AI should replace the decision-maker. We believe
            AI should{" "}
            <strong className="text-white">
              prepare the decision-maker to operate at their best
            </strong>
            .
          </p>
          <Quote>
            Let AI do the gathering, ranking, linking, tracing, and
            orchestration. Let humans do the judgment.
          </Quote>
        </section>

        <SectionDivider />

        {/* Vision */}
        <section>
          <SectionHeading>Vision</SectionHeading>
          <Quote>
            To build the operating system for high-quality decisions at work.
          </Quote>
          <p className="mt-6 leading-relaxed">
            We envision a future where workplace software no longer revolves
            around streams of messages, but around clear, contextualized
            decisions and the actions that follow them.
          </p>
          <p className="mt-4 leading-relaxed">
            PING becomes the place where fragmented organizational context is
            turned into momentum. Not just a place where people talk.{" "}
            <strong className="text-white">
              A place where work advances.
            </strong>
          </p>
        </section>

        <SectionDivider />

        {/* Mission */}
        <section>
          <SectionHeading>Mission</SectionHeading>
          <Quote>
            To reduce the cognitive load of work by turning communication into
            decision-ready context and turning decisions into coordinated action.
          </Quote>
          <p className="mt-6 leading-relaxed">
            We do this by creating a workspace where priorities are ranked
            automatically, context is progressively disclosed, missing
            information is resolved proactively, decisions are easy to make,
            actions are easy to trigger, and outcomes remain linked to the source
            truth behind them.
          </p>
        </section>

        <SectionDivider />

        {/* Positioning */}
        <section>
          <SectionHeading>Positioning</SectionHeading>
          <div className="space-y-6">
            {[
              [
                'PING is not "AI for chat."',
                "It is decision infrastructure for modern teams.",
              ],
              [
                "PING is not a conversation hub.",
                "It is a context engine and execution surface.",
              ],
              [
                "PING is not trying to help users read more messages.",
                "It is trying to help them need fewer messages to make better decisions.",
              ],
              [
                "PING is not a passive archive of workplace noise.",
                "It is an active system that prepares, ranks, and advances work.",
              ],
            ].map(([contrast, statement]) => (
              <div key={contrast}>
                <p className="text-white/40">{contrast}</p>
                <p className="font-medium text-white">{statement}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 leading-relaxed">
            This is the category we want to define:{" "}
            <strong className="text-white">
              Decision-first collaboration.
            </strong>
          </p>
        </section>

        <SectionDivider />

        {/* Paradigm Shift */}
        <section>
          <SectionHeading>The Collaboration Paradigm Shift</SectionHeading>
          <p className="mb-6 leading-relaxed">
            The last generation of collaboration software treated the message as
            the atomic unit of work. That made sense when software could only
            transmit information. It no longer makes sense in a world where
            software can interpret, rank, summarize, investigate, and act.
          </p>
          <p className="mb-8 leading-relaxed">
            The new atomic unit is not the message.{" "}
            <strong className="text-white">It is the decision.</strong>
          </p>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <SubHeading>The Old Paradigm</SubHeading>
              <ul className="list-none space-y-2 pl-0 text-white/50">
                {[
                  "communication is the center",
                  "people manually gather context",
                  "urgency is inferred badly from noise",
                  "decisions are hidden inside threads",
                  "follow-through depends on memory",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-white/20" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-indigo-400/20 bg-indigo-400/[0.03] p-6">
              <SubHeading>The New Paradigm</SubHeading>
              <ul className="list-none space-y-2 pl-0 text-white/70">
                {[
                  "decisions are surfaced explicitly",
                  "context arrives pre-assembled",
                  "priority is ranked by the system",
                  "missing information is resolved proactively",
                  "action is orchestrated from the decision point",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-indigo-400/60" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <SectionDivider />

        {/* The PING Experience */}
        <section>
          <SectionHeading>The PING Experience</SectionHeading>
          <p className="mb-8 leading-relaxed">
            When PING works, a user should feel:
          </p>
          <div className="space-y-4">
            {[
              "I know what matters now.",
              "I understand why it matters.",
              "I can go deeper if needed.",
              "I can trust the source trail behind this.",
              "I can make the call quickly.",
              "Once I decide, the system carries the work forward.",
            ].map((item) => (
              <p
                key={item}
                className="border-l-2 border-indigo-400/30 pl-5 text-lg font-light text-white/80"
              >
                {item}
              </p>
            ))}
          </div>
          <p className="mt-8 leading-relaxed">
            Not &ldquo;AI assistant.&rdquo; Not &ldquo;workspace
            copilot.&rdquo; Not &ldquo;chat, but summarized.&rdquo;
          </p>
          <p className="font-medium text-white">
            A true decision-making environment.
          </p>
        </section>

        <SectionDivider />

        {/* Progressive Disclosure */}
        <section>
          <SectionHeading>
            Progressive Disclosure as a Product Principle
          </SectionHeading>
          <p className="mb-6 leading-relaxed">
            Most collaboration tools force the user into one of two bad states:
            too little context or too much context.
          </p>
          <p className="mb-8 leading-relaxed">
            PING introduces{" "}
            <strong className="text-white">
              progressive disclosure for decision-making
            </strong>
            .
          </p>
          <ol className="list-none space-y-3 pl-0">
            {[
              "Decision title / problem framing",
              "High-level summary",
              "Supporting rationale",
              "Underlying messages, links, files, tickets, and artifacts",
              "Organizational and historical traceability",
            ].map((item, i) => (
              <li key={item} className="flex items-start gap-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 text-xs text-white/40">
                  {i + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 leading-relaxed">
            The system should do the assembly.{" "}
            <strong className="text-white">
              The human should choose the depth.
            </strong>
          </p>
        </section>

        <SectionDivider />

        {/* Brand Identity */}
        <section>
          <SectionHeading>The Brand Identity We Stand For</SectionHeading>
          <p className="mb-8 leading-relaxed">PING should feel:</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["sharp", "noisy"],
              ["calm", "addictive"],
              ["decisive", "bloated"],
              ["intelligent", "theatrical"],
              ["trustworthy", "magical for its own sake"],
              ["high-agency", "passive"],
            ].map(([good, bad]) => (
              <div key={good} className="flex items-center gap-2 text-sm">
                <span className="font-medium text-white">{good}</span>
                <span className="text-white/30">rather than</span>
                <span className="text-white/40">{bad}</span>
              </div>
            ))}
          </div>
          <p className="mt-8 leading-relaxed">
            PING should feel like a premium cognitive instrument for serious
            work.
          </p>
        </section>

        <SectionDivider />

        {/* Manifesto */}
        <section>
          <SectionHeading>A Short Manifesto</SectionHeading>
          <div className="space-y-4 text-lg leading-relaxed">
            {[
              "We believe work software should respect attention.",
              "We believe communication is not the end state of collaboration.",
              "We believe the message feed has become the wrong center of gravity for modern teams.",
              "We believe AI should not just answer questions, but prepare better decisions.",
              "We believe context should come to the decision-maker, not the other way around.",
              "We believe the best systems reduce noise without reducing nuance.",
              "We believe important decisions should be explainable, traceable, and actionable.",
              "We believe once a human makes the call, software should help execute it immediately.",
              "We believe the future of collaboration is not more conversation.",
            ].map((belief) => (
              <p key={belief}>{belief}</p>
            ))}
          </div>
          <Quote>
            It is clearer judgment and faster coordinated action.
          </Quote>
          <p className="mt-6 font-medium text-white">
            That is what PING is here to build.
          </p>
        </section>

        <SectionDivider />

        {/* What "PING That Works" Means */}
        <section>
          <SectionHeading>
            What &ldquo;PING That Works&rdquo; Means
          </SectionHeading>
          <p className="mb-8 leading-relaxed">
            PING works when it does three things exceptionally well:
          </p>
          <div className="space-y-8">
            {[
              {
                num: "1",
                title: "It surfaces the right decisions",
                body: "Not everything deserves attention. PING identifies what actually needs a human call.",
              },
              {
                num: "2",
                title: "It prepares those decisions with the right context",
                body: "Not too much. Not too little. Enough to move with confidence, with depth available on demand.",
              },
              {
                num: "3",
                title: "It turns decisions into motion",
                body: "A decision should not die in a thread. It should trigger coordination, delegation, investigation, reminders, and execution.",
              },
            ].map(({ num, title, body }) => (
              <div key={num} className="flex gap-5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-400/10 text-sm font-semibold text-indigo-400">
                  {num}
                </span>
                <div>
                  <p className="mb-1 font-medium text-white">{title}</p>
                  <p className="leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <SectionDivider />

        {/* Closing */}
        <section className="text-center">
          <Quote>
            PING is a decision-first workspace that uses AI to assemble context,
            reduce cognitive load, and turn human judgment into coordinated
            action.
          </Quote>
        </section>

        {/* Internal Standard */}
        <section className="mt-20 rounded-xl border border-white/[0.06] bg-white/[0.02] p-8">
          <h3 className="mb-6 text-sm font-medium uppercase tracking-[0.15em] text-white/40">
            The Internal Product Standard
          </h3>
          <p className="mb-6 leading-relaxed">
            Every feature we build should answer these questions:
          </p>
          <ol className="list-none space-y-3 pl-0">
            {[
              "Does this help users make a better decision?",
              "Does this reduce the effort required to gather context?",
              "Does this preserve trust, traceability, and human judgment?",
              "Does this accelerate action after a decision is made?",
              "Does this reduce noise rather than create more of it?",
            ].map((q, i) => (
              <li key={q} className="flex items-start gap-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 text-xs text-white/40">
                  {i + 1}
                </span>
                <span>{q}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-white/40">
            If not, it may be useful. But it is not core to PING.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-12 text-center">
        <Link href="/" className="text-sm text-white/30 transition-colors hover:text-white/60">
          &larr; Back to PING
        </Link>
      </footer>
    </div>
  );
}
