import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireUser, getGuestVisibleUserIds } from "./auth";

/**
 * Search channel messages using the full-text search index.
 * Returns up to 20 matching messages with author info.
 */
export const searchMessages = query({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.workspaceId);

    // Get channels in this workspace so we only return relevant results
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(100);

    let channelIds = new Set<string>(channels.map((c) => c._id));

    if (user.role === "guest") {
      const myMemberships = await ctx.db
        .query("channelMembers")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      const myChannelIds = new Set<string>(myMemberships.map((m) => m.channelId));
      channelIds = new Set([...channelIds].filter((id) => myChannelIds.has(id)));
    }
    const channelMap = new Map(channels.map((c) => [c._id, c]));

    // Search across all messages (search index doesn't support OR on filterFields,
    // so we search without filter and post-filter by workspace channels)
    const results = await ctx.db
      .query("messages")
      .withSearchIndex("search_body", (q) => q.search("body", args.query))
      .take(50);

    const filtered = results.filter((m) => channelIds.has(m.channelId));

    // Enrich with author and channel info
    const enriched = await Promise.all(
      filtered.slice(0, 20).map(async (msg) => {
        const author = await ctx.db.get(msg.authorId);
        const channel = channelMap.get(msg.channelId);
        return {
          _id: msg._id,
          body: msg.body,
          channelId: msg.channelId,
          channelName: channel?.name ?? null,
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
 * Search direct messages using the full-text search index.
 * Only returns messages from conversations the user is a member of.
 */
export const searchDirectMessages = query({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Get user's DM conversations
    const memberships = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(100);

    const conversationIds = new Set(memberships.map((m) => m.conversationId));

    // Search DMs and post-filter by membership
    const results = await ctx.db
      .query("directMessages")
      .withSearchIndex("search_body", (q) => q.search("body", args.query))
      .take(50);

    const filtered = results.filter((m) =>
      conversationIds.has(m.conversationId),
    );

    // Enrich with author info
    const enriched = await Promise.all(
      filtered.slice(0, 20).map(async (msg) => {
        const author = await ctx.db.get(msg.authorId);
        const conversation = await ctx.db.get(msg.conversationId);
        return {
          _id: msg._id,
          body: msg.body,
          conversationId: msg.conversationId,
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
