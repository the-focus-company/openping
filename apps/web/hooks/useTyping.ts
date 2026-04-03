import { useCallback, useRef } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import type { TypingUser } from "@/components/channel/MessageList";

const THROTTLE_MS = 3000;

/** Typing indicator for any conversation (channels, DMs, group chats). */
export function useConversationTyping(
  conversationId: Id<"conversations">,
  enabled = true,
) {
  const { isAuthenticated } = useConvexAuth();
  const typingUsers =
    useQuery(
      api.typing.getTypingUsers,
      isAuthenticated && enabled ? { conversationId } : "skip",
    ) ?? [];

  const setTyping = useMutation(api.typing.setTyping);
  const clearTyping = useMutation(api.typing.clearTyping);
  const lastFired = useRef(0);

  const onTyping = useCallback(() => {
    if (!enabled) return;
    const now = Date.now();
    if (now - lastFired.current < THROTTLE_MS) return;
    lastFired.current = now;
    setTyping({ conversationId });
  }, [setTyping, conversationId, enabled]);

  const onSendClear = useCallback(() => {
    if (!enabled) return;
    lastFired.current = 0;
    clearTyping({ conversationId });
  }, [clearTyping, conversationId, enabled]);

  return { typingUsers: typingUsers as TypingUser[], onTyping, onSendClear };
}

/**
 * @deprecated Use useConversationTyping instead.
 */
export const useChannelTyping = (
  channelId: Id<"conversations">,
  enabled = true,
) => useConversationTyping(channelId, enabled);

/**
 * @deprecated Use useConversationTyping instead.
 */
export const useDMTyping = (conversationId: Id<"conversations">) =>
  useConversationTyping(conversationId);
