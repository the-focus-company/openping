"use client";

import { useRef, type ReactNode, type CSSProperties } from "react";
import { motion, useInView, useScroll, useTransform } from "motion/react";
import { SPRING } from "./constants";
import { cn } from "@/lib/utils";

/* ── Scroll-triggered fade+slide reveal ── */

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  once?: boolean;
}

const directionMap = {
  up: { y: 24, x: 0 },
  down: { y: -24, x: 0 },
  left: { x: 32, y: 0 },
  right: { x: -32, y: 0 },
};

export function Reveal({
  children,
  className,
  delay = 0,
  direction = "up",
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: "-60px 0px" });
  const offset = directionMap[direction];

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, ...offset }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, ...offset }}
      transition={{ ...SPRING, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ── Staggered children reveal ── */

interface StaggerProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}

export function Stagger({ children, className, stagger = 0.08, delay = 0 }: StaggerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px 0px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: SPRING },
};

/* ── Glow card with mouse-following highlight ── */

export function GlowCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--glow-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--glow-y", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={ref}
      className={cn(
        "group/glow relative overflow-hidden transition-all",
        className
      )}
      onMouseMove={handleMouseMove}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover/glow:opacity-100"
        style={{
          background:
            "radial-gradient(500px circle at var(--glow-x, 50%) var(--glow-y, 50%), rgba(94,106,210,0.08), transparent 50%)",
        }}
      />
      {children}
    </div>
  );
}

/* ── Animated counter ── */

interface CounterProps {
  value: string;
  className?: string;
}

export function AnimatedCounter({ value, className }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
      transition={{ ...SPRING, delay: 0.1 }}
    >
      {value}
    </motion.span>
  );
}

/* ── Section wrapper with consistent spacing ── */

interface SectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
  style?: CSSProperties;
}

export function Section({ children, className, id, style }: SectionProps) {
  return (
    <section id={id} className={cn("relative", className)} style={style}>
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32 lg:px-8">
        {children}
      </div>
    </section>
  );
}

/* ── Section header ── */

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
}: SectionHeaderProps) {
  return (
    <Reveal className={cn("mb-16", align === "center" && "text-center")}>
      {eyebrow && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-ping-purple">
          {eyebrow}
        </p>
      )}
      <h2 className="text-[2rem] font-bold leading-tight tracking-tight text-white sm:text-[2.5rem]">
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground",
            align === "center" && "mx-auto"
          )}
        >
          {description}
        </p>
      )}
    </Reveal>
  );
}

/* ── Parallax wrapper ── */

interface ParallaxProps {
  children: ReactNode;
  offset?: number;
  className?: string;
}

export function Parallax({ children, offset = 40, className }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}

/* ── Gradient text ── */

export function GradientText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-transparent",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ── Horizontal rule / divider ── */

export function Divider({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto h-px w-full max-w-6xl bg-gradient-to-r from-transparent via-white/[0.08] to-transparent",
        className
      )}
    />
  );
}
