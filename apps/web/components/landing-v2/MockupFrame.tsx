import type { ReactNode } from "react";

export function MockupFrame({
  children,
  maxWidth = "max-w-[480px]",
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div
      className={`w-full ${maxWidth} rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl shadow-black/40 overflow-hidden`}
    >
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-neutral-800">
        <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
      </div>
      {children}
    </div>
  );
}
