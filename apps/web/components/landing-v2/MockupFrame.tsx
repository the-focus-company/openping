"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MockupFrameProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

export function MockupFrame({ children, className, title }: MockupFrameProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0b14] shadow-2xl shadow-black/60",
        className
      )}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-white/[0.08]" />
          <div className="h-2.5 w-2.5 rounded-full bg-white/[0.08]" />
          <div className="h-2.5 w-2.5 rounded-full bg-white/[0.08]" />
        </div>
        {title && (
          <span className="ml-2 text-[11px] text-muted-foreground/50">
            {title}
          </span>
        )}
      </div>
      {/* Content */}
      <div className="relative">{children}</div>
    </div>
  );
}
