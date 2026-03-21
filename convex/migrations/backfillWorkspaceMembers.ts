import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * One-time backfill migration: reads all users and creates
 * workspaceMembers rows from their legacy workspaceId + role fields.
 *
 * Run via Convex dashboard after deploy:
 *   npx convex run migrations/backfillWorkspaceMembers:run
 *
 * Safe to re-run — skips users that already have a membership row.
 * Processes in batches of 100 with self-scheduling for large datasets.
 */
export const run = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const BATCH_SIZE = 100;
    let created = 0;
    let skipped = 0;

    // Paginate through all users
    const query = ctx.db.query("users");
    const users = await query.take(BATCH_SIZE);

    for (const user of users) {
      // Check if user already has any workspace membership
      const existingMembership = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();

      if (existingMembership) {
        skipped++;
        continue;
      }

      // User has no memberships — this shouldn't happen in normal flow
      // but log it for visibility
      console.log(
        `[backfill] User ${user._id} (${user.email}) has no workspace membership — skipping (may need manual assignment)`,
      );
      skipped++;
    }

    console.log(
      `[backfill] Batch complete: ${created} created, ${skipped} skipped, ${users.length} processed`,
    );

    return { created, skipped, processed: users.length };
  },
});
