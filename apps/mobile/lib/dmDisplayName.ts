interface Member {
  userId: string;
  name: string;
  isAgent?: boolean;
}

/**
 * Build a display name for a DM conversation.
 * - If the conversation has an explicit name, use it.
 * - For 1:1 (2 members), show the other person's name.
 * - For groups, show names joined by ", " truncated with (+N) suffix.
 */
export function getDMDisplayName(
  conversationName: string | undefined | null,
  members: Member[],
  currentUserId: string | undefined,
  maxNames = 3,
): string {
  if (conversationName) return conversationName;

  const others = currentUserId
    ? members.filter((m) => m.userId !== currentUserId)
    : members;

  if (others.length === 0) return "Conversation";
  if (others.length === 1) return others[0].name;

  const shown = others.slice(0, maxNames).map((m) => m.name);
  const remaining = others.length - maxNames;

  if (remaining > 0) {
    return `${shown.join(", ")} (+${remaining})`;
  }

  return shown.join(", ");
}
