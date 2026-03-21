import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./auth";
import { internal } from "./_generated/api";

// ── Draft Management ────────────────────────────────────────────────────────

export const saveDraft = mutation({
  args: {
    draftId: v.optional(v.id("emailDrafts")),
    workspaceId: v.id("workspaces"),
    emailAccountId: v.id("emailAccounts"),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    bcc: v.optional(v.array(v.string())),
    subject: v.string(),
    body: v.string(),
    mode: v.union(
      v.literal("compose"),
      v.literal("reply"),
      v.literal("reply_all"),
      v.literal("forward"),
    ),
    replyToEmailId: v.optional(v.id("emails")),
    suggestedAction: v.optional(v.string()),
    attachmentIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    if (args.draftId) {
      const existing = await ctx.db.get(args.draftId);
      if (!existing || existing.userId !== user._id) {
        throw new Error("Draft not found");
      }
      await ctx.db.patch(args.draftId, {
        to: args.to,
        cc: args.cc,
        bcc: args.bcc,
        subject: args.subject,
        body: args.body,
        mode: args.mode,
        replyToEmailId: args.replyToEmailId,
        suggestedAction: args.suggestedAction,
        attachmentIds: args.attachmentIds,
        updatedAt: now,
      });
      return args.draftId;
    }

    return await ctx.db.insert("emailDrafts", {
      userId: user._id,
      workspaceId: args.workspaceId,
      emailAccountId: args.emailAccountId,
      to: args.to,
      cc: args.cc,
      bcc: args.bcc,
      subject: args.subject,
      body: args.body,
      mode: args.mode,
      replyToEmailId: args.replyToEmailId,
      suggestedAction: args.suggestedAction,
      attachmentIds: args.attachmentIds,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listDrafts = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const drafts = await ctx.db
      .query("emailDrafts")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "draft"),
      )
      .order("desc")
      .take(args.limit ?? 20);

    return Promise.all(
      drafts.map(async (draft) => {
        const account = await ctx.db.get(draft.emailAccountId);
        return {
          ...draft,
          fromAddress: account?.emailAddress ?? "unknown",
        };
      }),
    );
  },
});

export const getDraft = query({
  args: { draftId: v.id("emailDrafts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.userId !== user._id) {
      return null;
    }
    const account = await ctx.db.get(draft.emailAccountId);
    return {
      ...draft,
      fromAddress: account?.emailAddress ?? "unknown",
    };
  },
});

export const deleteDraft = mutation({
  args: { draftId: v.id("emailDrafts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.userId !== user._id) {
      throw new Error("Draft not found");
    }
    await ctx.db.delete(args.draftId);
  },
});

// ── Internal: Mark draft as sent or failed ──────────────────────────────────

export const markDraftStatus = internalMutation({
  args: {
    draftId: v.id("emailDrafts"),
    status: v.union(v.literal("sent"), v.literal("failed")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.draftId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

// ── Send Email (Action — calls Gmail / Outlook API) ─────────────────────────

export const sendEmail = action({
  args: {
    draftId: v.id("emailDrafts"),
  },
  handler: async (ctx, args) => {
    const draft = await ctx.runQuery(internal.emailSend.getDraftInternal, {
      draftId: args.draftId,
    });
    if (!draft) {
      throw new Error("Draft not found");
    }
    if (draft.status !== "draft") {
      throw new Error("Draft is not in draft status");
    }

    // Mark as sending
    await ctx.runMutation(internal.emailSend.markDraftSending, {
      draftId: args.draftId,
    });

    const account = await ctx.runQuery(internal.emailSend.getAccountInternal, {
      accountId: draft.emailAccountId,
    });
    if (!account) {
      await ctx.runMutation(internal.emailSend.markDraftStatus, {
        draftId: args.draftId,
        status: "failed",
      });
      throw new Error("Email account not found");
    }

    try {
      if (account.provider === "gmail") {
        await sendViaGmail(account as unknown as EmailAccount, draft as unknown as EmailDraft);
      } else if (account.provider === "outlook") {
        await sendViaOutlook(account as unknown as EmailAccount, draft as unknown as EmailDraft);
      }

      await ctx.runMutation(internal.emailSend.markDraftStatus, {
        draftId: args.draftId,
        status: "sent",
      });
    } catch (error) {
      await ctx.runMutation(internal.emailSend.markDraftStatus, {
        draftId: args.draftId,
        status: "failed",
      });
      throw error;
    }
  },
});

// ── Internal queries/mutations used by the action ───────────────────────────

export const getDraftInternal = internalQuery({
  args: { draftId: v.id("emailDrafts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.draftId);
  },
});

export const getAccountInternal = internalQuery({
  args: { accountId: v.id("emailAccounts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.accountId);
  },
});

export const markDraftSending = internalMutation({
  args: { draftId: v.id("emailDrafts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.draftId, {
      status: "sending",
      updatedAt: Date.now(),
    });
  },
});

// ── Gmail API ───────────────────────────────────────────────────────────────

interface EmailAccount {
  emailAddress: string;
  accessToken: string;
  provider: "gmail" | "outlook";
}

interface EmailDraft {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
}

function buildRfc2822Message(
  from: string,
  draft: EmailDraft,
): string {
  const lines: string[] = [];
  lines.push(`From: ${from}`);
  lines.push(`To: ${draft.to.join(", ")}`);
  if (draft.cc && draft.cc.length > 0) {
    lines.push(`Cc: ${draft.cc.join(", ")}`);
  }
  if (draft.bcc && draft.bcc.length > 0) {
    lines.push(`Bcc: ${draft.bcc.join(", ")}`);
  }
  lines.push(`Subject: ${draft.subject}`);
  lines.push("MIME-Version: 1.0");
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push("");
  lines.push(draft.body);
  return lines.join("\r\n");
}

function base64UrlEncode(str: string): string {
  const encoded = btoa(unescape(encodeURIComponent(str)));
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendViaGmail(
  account: EmailAccount,
  draft: EmailDraft,
): Promise<void> {
  const raw = base64UrlEncode(
    buildRfc2822Message(account.emailAddress, draft),
  );

  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gmail API error (${response.status}): ${errorBody}`);
  }
}

// ── Outlook / Microsoft Graph API ───────────────────────────────────────────

async function sendViaOutlook(
  account: EmailAccount,
  draft: EmailDraft,
): Promise<void> {
  const toRecipients = draft.to.map((email) => ({
    emailAddress: { address: email },
  }));
  const ccRecipients = (draft.cc ?? []).map((email) => ({
    emailAddress: { address: email },
  }));
  const bccRecipients = (draft.bcc ?? []).map((email) => ({
    emailAddress: { address: email },
  }));

  const response = await fetch(
    "https://graph.microsoft.com/v1.0/me/sendMail",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: draft.subject,
          body: {
            contentType: "Text",
            content: draft.body,
          },
          toRecipients,
          ccRecipients,
          bccRecipients,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Microsoft Graph API error (${response.status}): ${errorBody}`,
    );
  }
}
