import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireUser, getGuestVisibleUserIds } from "./auth";

/**
 * Search messages using the full-text search index.
 * Returns up to 20 matching messages with author info.
 * Works across all conversations (channels and DMs) the user has access to.
 */
export const searchMessages = query({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.query.trim().length < 1) throw new Error("Search query empty");
    if (args.query.length > 1000) throw new Error("Search query too long");
    const user = await requireAuth(ctx, args.workspaceId);

    // Get conversations in this workspace so we only return relevant results
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(200);

    let conversationIds = new Set<string>(conversations.map((c) => c._id));

    if (user.role === "guest") {
      const myMemberships = await ctx.db
        .query("conversationMembers")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      const myConversationIds = new Set<string>(myMemberships.map((m) => m.conversationId));
      conversationIds = new Set([...conversationIds].filter((id) => myConversationIds.has(id)));
    }
    const conversationMap = new Map(conversations.map((c) => [c._id, c]));

    // Search across all messages (search index doesn't support OR on filterFields,
    // so we search without filter and post-filter by workspace conversations)
    const results = await ctx.db
      .query("messages")
      .withSearchIndex("search_body", (q) => q.search("body", args.query))
      .take(200);

    const filtered = results.filter((m) => conversationIds.has(m.conversationId!));

    // Enrich with author and conversation info
    const enriched = await Promise.all(
      filtered.slice(0, 20).map(async (msg) => {
        const author = await ctx.db.get(msg.authorId);
        const conversation = conversationMap.get(msg.conversationId!);
        return {
          _id: msg._id,
          body: msg.body,
          conversationId: msg.conversationId!,
          conversationName: conversation?.name ?? null,
          authorName: author?.name ?? "Unknown",
          authorAvatarUrl: author?.avatarUrl ?? null,
          _creationTime: msg._creationTime,
        };
      }),
    );

    return enriched;
  },
});

/**
 * Search workspace members by name (client-side filter since users
 * table doesn't have a search index — workspace member lists are small).
 */
export const searchPeople = query({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);
    const visibleUserIds = await getGuestVisibleUserIds(ctx, user._id, user.role);

    const wsMembers = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .take(200);

    const q = args.query.toLowerCase();

    const users = await Promise.all(
      wsMembers.map(async (m) => {
        if (visibleUserIds && !visibleUserIds.has(m.userId)) return null;
        const u = await ctx.db.get(m.userId);
        if (!u || u.status === "deactivated") return null;
        if (
          !u.name.toLowerCase().includes(q) &&
          !u.email.toLowerCase().includes(q)
        ) {
          return null;
        }
        return {
          _id: u._id,
          name: u.name,
          email: u.email,
          avatarUrl: u.avatarUrl,
          status: u.status,
          presenceStatus: u.presenceStatus,
        };
      }),
    );

    return users.filter((u): u is NonNullable<typeof u> => u !== null);
  },
});
