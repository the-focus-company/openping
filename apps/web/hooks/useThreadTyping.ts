import { useCallback, useRef } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import type { TypingUser } from "@/components/channel/MessageList";

const THROTTLE_MS = 3000;

/** Typing indicator for message threads (works for both channel and DM threads). */
export function useThreadTyping(threadMessageId: Id<"messages">) {
  const { isAuthenticated } = useConvexAuth();
  const typingUsers =
    useQuery(
      api.typing.getTypingUsers,
      isAuthenticated ? { threadMessageId } : "skip",
    ) ?? [];

  const setTyping = useMutation(api.typing.setTyping);
  const clearTyping = useMutation(api.typing.clearTyping);
  const lastFired = useRef(0);

  const onTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastFired.current < THROTTLE_MS) return;
    lastFired.current = now;
    setTyping({ threadMessageId });
  }, [setTyping, threadMessageId]);

  const onSendClear = useCallback(() => {
    lastFired.current = 0;
    clearTyping({ threadMessageId });
  }, [clearTyping, threadMessageId]);

  return { typingUsers: typingUsers as TypingUser[], onTyping, onSendClear };
}
