"use client";

import { AnimatePresence, motion } from "motion/react";
import type { TypingUser } from "./message-types";

export function TypingIndicator({ users, showHint = true }: { users: TypingUser[]; showHint?: boolean }) {
  const label =
    users.length === 1
      ? `${users[0].name} is typing`
      : users.length === 2
        ? `${users[0].name} and ${users[1].name} are typing`
        : users.length > 2
          ? `${users[0].name} and ${users.length - 1} others are typing`
          : null;

  return (
    <div className="h-5 flex items-center px-1 pt-1 text-2xs text-muted-foreground">
      <AnimatePresence mode="wait">
        {label ? (
          <motion.div
            key="typing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <span className="inline-flex gap-0.5">
              <span className="animate-bounce [animation-delay:0ms]">·</span>
              <span className="animate-bounce [animation-delay:150ms]">·</span>
              <span className="animate-bounce [animation-delay:300ms]">·</span>
            </span>
            <span>{label}</span>
          </motion.div>
        ) : showHint ? (
          <motion.div
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            Enter to send · Shift+Enter for new line · @mention to summon agents
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
