"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/* ── Tag ── */

const colorMap: Record<string, string> = {
  indigo: "text-indigo-400 border-indigo-500/25 bg-indigo-500/8",
  emerald: "text-emerald-400 border-emerald-500/25 bg-emerald-500/8",
  amber: "text-amber-400 border-amber-500/25 bg-amber-500/8",
  rose: "text-rose-400 border-rose-500/25 bg-rose-500/8",
  violet: "text-violet-400 border-violet-500/25 bg-violet-500/8",
  sky: "text-sky-400 border-sky-500/25 bg-sky-500/8",
};

export function Tag({
  children,
  color = "indigo",
}: {
  children: ReactNode;
  color?: "indigo" | "emerald" | "amber" | "rose" | "violet" | "sky";
}) {
  return (
    <span
      className={cn(
        "inline-block font-semibold tracking-[0.14em] text-[11px] uppercase border px-3 py-1 rounded-full",
        colorMap[color],
      )}
    >
      {children}
    </span>
  );
}

/* ── FadeUp ── */

export function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      viewport={{ once: true, amount: 0.25 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── SectionWrapper ── */

export function SectionWrapper({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("py-24 md:py-32 px-6 lg:px-8", className)}>
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  );
}

/* ── GradientHeading ── */

export function GradientHeading({
  children,
  as: Tag = "h2",
  className,
  gradient = "bg-gradient-to-r from-white via-white to-neutral-500",
}: {
  children: ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
  gradient?: string;
}) {
  return (
    <Tag className={cn(gradient, "bg-clip-text text-transparent", className)}>
      {children}
    </Tag>
  );
}

/* ── MockupFrame ── */

export function MockupFrame({
  children,
  title,
  className,
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/40",
        className,
      )}
    >
      <div className="relative flex items-center px-4 py-3 border-b border-neutral-800">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#FF5F57]" />
          <div className="w-2 h-2 rounded-full bg-[#FEBC2E]" />
          <div className="w-2 h-2 rounded-full bg-[#28C840]" />
        </div>
        {title && (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500 pointer-events-none">
            {title}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
