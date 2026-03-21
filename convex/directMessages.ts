import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireUser } from "./auth";

export const list = query({
  args: {
    conversationId: v.id("directConversations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verify membership
    const membership = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation_user", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("userId", user._id),
      )
      .unique();
    if (!membership) throw new Error("Not a member");

    const results = await ctx.db
      .query("directMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    const messagesWithAuthors = await Promise.all(
      results.page.map(async (message) => {
        const author = await ctx.db.get(message.authorId);
        const memberRecord = await ctx.db
          .query("directConversationMembers")
          .withIndex("by_conversation_user", (q) =>
            q
              .eq("conversationId", args.conversationId)
              .eq("userId", message.authorId),
          )
          .unique();
        return {
          ...message,
          author: author
            ? { name: author.name, avatarUrl: author.avatarUrl }
            : null,
          isAgent: memberRecord?.isAgent ?? false,
        };
      }),
    );

    return { ...results, page: messagesWithAuthors };
  },
});

export const send = mutation({
  args: {
    conversationId: v.id("directConversations"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verify membership
    const membership = await ctx.db
      .query("directConversationMembers")
      .withIndex("by_conversation_user", (q) =>
        q
          .eq("conversationId", args.conversationId)
          .eq("userId", user._id),
      )
      .unique();
    if (!membership) throw new Error("Not a member");

    const messageId = await ctx.db.insert("directMessages", {
      conversationId: args.conversationId,
      authorId: user._id,
      body: args.body,
      type: membership.isAgent ? "bot" : "user",
      isEdited: false,
    });

    // Update sender's lastReadAt
    await ctx.db.patch(membership._id, { lastReadAt: Date.now() });

    return messageId;
  },
});
