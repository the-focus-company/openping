import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./auth";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getFileUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const attachmentValidator = v.object({
  storageId: v.string(),
  filename: v.string(),
  mimeType: v.string(),
  size: v.number(),
});

export const cleanupOrphanedStorage = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Find soft-deleted messages with attachments and clean up their storage
    const deletedMessages = await ctx.db
      .query("messages")
      .filter((q) => q.neq(q.field("deletedAt"), undefined))
      .take(100);

    let cleaned = 0;
    for (const msg of deletedMessages) {
      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          try {
            await ctx.storage.delete(att.storageId as any);
            cleaned++;
          } catch {
            // Storage entry may already be deleted
          }
        }
        await ctx.db.patch(msg._id, { attachments: [] });
      }
    }
  },
});
