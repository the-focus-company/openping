"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

interface CopyButtonProps {
  text: string;
}

export function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silent fallback
    }
  };

  return (
    <button
      onClick={handleCopy}
      aria-label="Copy to clipboard"
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-3 hover:text-white active:scale-95"
    >
      <span className="relative h-3.5 w-3.5">
        <AnimatePresence mode="wait">
          {copied ? (
            <motion.span
              key="check"
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: "spring", damping: 22, stiffness: 400 }}
            >
              <Check className="h-3.5 w-3.5 text-status-online" />
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: "spring", damping: 22, stiffness: 400 }}
            >
              <Copy className="h-3.5 w-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
