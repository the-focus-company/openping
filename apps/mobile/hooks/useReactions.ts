import { useQuery, useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export interface ReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
  userNames: string[];
}

export function useReactions(messageIds: Id<"messages">[]) {
  const reactionsByMessage =
    useQuery(
      api.reactions.getByMessages,
      messageIds.length > 0 ? { messageIds } : "skip",
    ) ?? {};

  const toggle = useMutation(api.reactions.toggle);

  const toggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      toggle({ messageId: messageId as Id<"messages">, emoji });
    },
    [toggle],
  );

  return { reactionsByMessage, toggleReaction } as const;
}

export function useDMReactions(messageIds: Id<"directMessages">[]) {
  const reactionsByMessage =
    useQuery(
      api.reactions.getByDMMessages,
      messageIds.length > 0 ? { messageIds } : "skip",
    ) ?? {};

  const toggle = useMutation(api.reactions.toggleDM);

  const toggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      toggle({ messageId: messageId as Id<"directMessages">, emoji });
    },
    [toggle],
  );

  return { reactionsByMessage, toggleReaction } as const;
}
