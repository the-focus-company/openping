import {
  query,
  mutation,
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./auth";
import { internal } from "./_generated/api";

// ── Email Account Management ────────────────────────────────────────────────

export const listAccounts = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("emailAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const connectAccount = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    provider: v.union(v.literal("gmail"), v.literal("outlook")),
    emailAddress: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Check for existing account with same email
    const existing = await ctx.db
      .query("emailAccounts")
      .withIndex("by_email", (q) => q.eq("emailAddress", args.emailAddress))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        tokenExpiresAt: args.tokenExpiresAt,
        isActive: true,
      });
      return existing._id;
    }

    return await ctx.db.insert("emailAccounts", {
      userId: user._id,
      workspaceId: args.workspaceId,
      provider: args.provider,
      emailAddress: args.emailAddress,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenExpiresAt: args.tokenExpiresAt,
      isActive: true,
    });
  },
});

export const disconnectAccount = mutation({
  args: { accountId: v.id("emailAccounts") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== user._id) {
      throw new Error("Account not found");
    }
    await ctx.db.patch(args.accountId, { isActive: false });
  },
});

// ── Email Listing ───────────────────────────────────────────────────────────

export const listEmails = query({
  args: {
    accountId: v.optional(v.id("emailAccounts")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (args.accountId) {
      return await ctx.db
        .query("emails")
        .withIndex("by_account", (q) => q.eq("emailAccountId", args.accountId!))
        .order("desc")
        .take(args.limit ?? 50);
    }

    return await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const getEmail = query({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const email = await ctx.db.get(args.emailId);
    if (!email || email.userId !== user._id) {
      return null;
    }
    return email;
  },
});

export const getEmailThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    return emails.filter((e) => e.userId === user._id);
  },
});

// ── Sync Actions ────────────────────────────────────────────────────────────

export const syncGmailAccount = action({
  args: { accountId: v.id("emailAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.runQuery(
      internal.emailSync.getAccountInternal,
      { accountId: args.accountId },
    );
    if (!account || !account.isActive) {
      throw new Error("Account not found or inactive");
    }

    const cursor = account.syncCursor;
    let url = "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20";
    if (cursor) {
      url += `&pageToken=${cursor}`;
    }

    const listResponse = await fetch(url, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });

    if (!listResponse.ok) {
      throw new Error(`Gmail list error: ${listResponse.status}`);
    }

    const listData = await listResponse.json();
    const messageIds: string[] = (listData.messages ?? []).map(
      (m: { id: string }) => m.id,
    );

    for (const messageId of messageIds) {
      const msgResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: { Authorization: `Bearer ${account.accessToken}` } },
      );

      if (!msgResponse.ok) continue;

      const msgData = await msgResponse.json();
      const headers = msgData.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find(
          (h: { name: string; value: string }) =>
            h.name.toLowerCase() === name.toLowerCase(),
        )?.value ?? "";

      const attachments = extractGmailAttachments(msgData);

      await ctx.runMutation(internal.emailSync.upsertEmail, {
        emailAccountId: args.accountId,
        userId: account.userId,
        workspaceId: account.workspaceId,
        externalId: messageId,
        threadId: msgData.threadId,
        from: getHeader("From"),
        to: parseEmailList(getHeader("To")),
        cc: parseEmailList(getHeader("Cc")),
        subject: getHeader("Subject"),
        bodyPlain: extractBody(msgData, "text/plain"),
        bodyHtml: extractBody(msgData, "text/html"),
        snippet: msgData.snippet ?? "",
        labels: msgData.labelIds ?? [],
        isRead: !(msgData.labelIds ?? []).includes("UNREAD"),
        isStarred: (msgData.labelIds ?? []).includes("STARRED"),
        receivedAt: parseInt(msgData.internalDate, 10),
        inReplyTo: getHeader("In-Reply-To") || undefined,
        references: getHeader("References")
          ? getHeader("References").split(/\s+/)
          : undefined,
        attachments,
      });
    }

    // Update sync cursor
    await ctx.runMutation(internal.emailSync.updateSyncCursor, {
      accountId: args.accountId,
      cursor: listData.nextPageToken ?? null,
    });

    return { synced: messageIds.length };
  },
});

export const syncOutlookAccount = action({
  args: { accountId: v.id("emailAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.runQuery(
      internal.emailSync.getAccountInternal,
      { accountId: args.accountId },
    );
    if (!account || !account.isActive) {
      throw new Error("Account not found or inactive");
    }

    let url =
      "https://graph.microsoft.com/v1.0/me/messages?$top=20&$orderby=receivedDateTime desc";
    if (account.syncCursor) {
      url = account.syncCursor; // Microsoft Graph uses full nextLink URLs
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Outlook sync error: ${response.status}`);
    }

    const data = await response.json();
    const messages = data.value ?? [];

    for (const msg of messages) {
      const attachments = (msg.hasAttachments && msg.attachments)
        ? msg.attachments.map((a: { name: string; contentType: string; size: number; id: string }) => ({
            filename: a.name ?? "attachment",
            mimeType: a.contentType ?? "application/octet-stream",
            size: a.size ?? 0,
            externalAttachmentId: a.id,
          }))
        : [];

      await ctx.runMutation(internal.emailSync.upsertEmail, {
        emailAccountId: args.accountId,
        userId: account.userId,
        workspaceId: account.workspaceId,
        externalId: msg.id,
        threadId: msg.conversationId,
        from: msg.from?.emailAddress?.address ?? "",
        to: (msg.toRecipients ?? []).map(
          (r: { emailAddress: { address: string } }) =>
            r.emailAddress?.address ?? "",
        ),
        cc: (msg.ccRecipients ?? []).map(
          (r: { emailAddress: { address: string } }) =>
            r.emailAddress?.address ?? "",
        ),
        subject: msg.subject ?? "",
        bodyPlain:
          msg.body?.contentType === "text" ? msg.body.content : undefined,
        bodyHtml:
          msg.body?.contentType === "html" ? msg.body.content : undefined,
        snippet: (msg.bodyPreview ?? "").slice(0, 200),
        labels: msg.categories ?? [],
        isRead: msg.isRead ?? false,
        isStarred: msg.flag?.flagStatus === "flagged",
        receivedAt: new Date(msg.receivedDateTime).getTime(),
        inReplyTo: undefined,
        references: undefined,
        attachments,
      });
    }

    await ctx.runMutation(internal.emailSync.updateSyncCursor, {
      accountId: args.accountId,
      cursor: data["@odata.nextLink"] ?? null,
    });

    return { synced: messages.length };
  },
});

// ── Internal helpers ────────────────────────────────────────────────────────

export const getAccountInternal = internalQuery({
  args: { accountId: v.id("emailAccounts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.accountId);
  },
});

export const getAccountByEmail = internalQuery({
  args: { emailAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("emailAccounts")
      .withIndex("by_email", (q) => q.eq("emailAddress", args.emailAddress))
      .unique();
  },
});

export const getAccountByPushChannel = internalQuery({
  args: { channelId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("emailAccounts")
      .withIndex("by_push_channel", (q) =>
        q.eq("pushChannelId", args.channelId),
      )
      .unique();
  },
});

export const upsertEmail = internalMutation({
  args: {
    emailAccountId: v.id("emailAccounts"),
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    externalId: v.string(),
    threadId: v.optional(v.string()),
    from: v.string(),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    subject: v.string(),
    bodyPlain: v.optional(v.string()),
    bodyHtml: v.optional(v.string()),
    snippet: v.optional(v.string()),
    labels: v.optional(v.array(v.string())),
    isRead: v.boolean(),
    isStarred: v.boolean(),
    receivedAt: v.number(),
    inReplyTo: v.optional(v.string()),
    references: v.optional(v.array(v.string())),
    attachments: v.optional(
      v.array(
        v.object({
          filename: v.string(),
          mimeType: v.string(),
          size: v.number(),
          externalAttachmentId: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emails")
      .withIndex("by_external_id", (q) => q.eq("externalId", args.externalId))
      .unique();

    // Look up sender rule for categorization
    const senderRule = await ctx.db
      .query("emailSenderRules")
      .withIndex("by_user_sender", (q) =>
        q.eq("userId", args.userId).eq("senderAddress", args.from),
      )
      .unique();

    const senderCategory = senderRule?.category ?? "normal";

    if (existing) {
      await ctx.db.patch(existing._id, {
        subject: args.subject,
        bodyPlain: args.bodyPlain,
        bodyHtml: args.bodyHtml,
        snippet: args.snippet,
        labels: args.labels,
        isRead: args.isRead,
        isStarred: args.isStarred,
        senderCategory,
      });
      return existing._id;
    }

    return await ctx.db.insert("emails", {
      emailAccountId: args.emailAccountId,
      userId: args.userId,
      workspaceId: args.workspaceId,
      externalId: args.externalId,
      threadId: args.threadId,
      from: args.from,
      to: args.to,
      cc: args.cc,
      subject: args.subject,
      bodyPlain: args.bodyPlain,
      bodyHtml: args.bodyHtml,
      snippet: args.snippet,
      labels: args.labels,
      isRead: args.isRead,
      isStarred: args.isStarred,
      receivedAt: args.receivedAt,
      inReplyTo: args.inReplyTo,
      references: args.references,
      attachments: args.attachments,
      senderCategory,
    });
  },
});

export const updateSyncCursor = internalMutation({
  args: {
    accountId: v.id("emailAccounts"),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accountId, {
      syncCursor: args.cursor ?? undefined,
      lastSyncedAt: Date.now(),
    });
  },
});

// ── Attachment download ─────────────────────────────────────────────────────

export const downloadAttachment = action({
  args: {
    emailId: v.id("emails"),
    externalAttachmentId: v.string(),
  },
  handler: async (ctx, args) => {
    const email = await ctx.runQuery(internal.emailSync.getEmailInternal, {
      emailId: args.emailId,
    });
    if (!email) throw new Error("Email not found");

    const account = await ctx.runQuery(
      internal.emailSync.getAccountInternal,
      { accountId: email.emailAccountId },
    );
    if (!account) throw new Error("Account not found");

    let data: ArrayBuffer;

    if (account.provider === "gmail") {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.externalId}/attachments/${args.externalAttachmentId}`,
        { headers: { Authorization: `Bearer ${account.accessToken}` } },
      );
      if (!response.ok) {
        throw new Error(`Gmail attachment download failed: ${response.status}`);
      }
      const json = await response.json();
      // Gmail returns base64url-encoded data
      const base64 = json.data.replace(/-/g, "+").replace(/_/g, "/");
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      data = bytes.buffer;
    } else {
      // Outlook
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${email.externalId}/attachments/${args.externalAttachmentId}/$value`,
        { headers: { Authorization: `Bearer ${account.accessToken}` } },
      );
      if (!response.ok) {
        throw new Error(
          `Outlook attachment download failed: ${response.status}`,
        );
      }
      data = await response.arrayBuffer();
    }

    // Store in Convex file storage
    const blob = new Blob([data]);
    const storageId = await ctx.storage.store(blob);

    // Update the attachment record with storageId
    await ctx.runMutation(internal.emailSync.setAttachmentStorageId, {
      emailId: args.emailId,
      externalAttachmentId: args.externalAttachmentId,
      storageId,
    });

    return storageId;
  },
});

export const getEmailInternal = internalQuery({
  args: { emailId: v.id("emails") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.emailId);
  },
});

export const setAttachmentStorageId = internalMutation({
  args: {
    emailId: v.id("emails"),
    externalAttachmentId: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const email = await ctx.db.get(args.emailId);
    if (!email) return;

    const attachments = (email.attachments ?? []).map((a) => {
      if (a.externalAttachmentId === args.externalAttachmentId) {
        return { ...a, storageId: args.storageId };
      }
      return a;
    });

    await ctx.db.patch(args.emailId, { attachments });
  },
});

// ── Utility functions ───────────────────────────────────────────────────────

function parseEmailList(header: string): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

interface GmailPayloadPart {
  mimeType: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPayloadPart[];
}

interface GmailMessage {
  payload?: GmailPayloadPart;
}

function extractBody(
  message: GmailMessage,
  mimeType: string,
): string | undefined {
  const payload = message.payload;
  if (!payload) return undefined;

  if (payload.mimeType === mimeType && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === mimeType && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      if (part.parts) {
        for (const subpart of part.parts) {
          if (subpart.mimeType === mimeType && subpart.body?.data) {
            return decodeBase64Url(subpart.body.data);
          }
        }
      }
    }
  }

  return undefined;
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join(""),
  );
}

function extractGmailAttachments(
  message: GmailMessage,
): Array<{
  filename: string;
  mimeType: string;
  size: number;
  externalAttachmentId: string;
}> {
  const attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
    externalAttachmentId: string;
  }> = [];

  function walk(parts: GmailPayloadPart[] | undefined) {
    if (!parts) return;
    for (const part of parts) {
      const attachId = part.body?.attachmentId;
      if (attachId) {
        attachments.push({
          filename: part.filename ?? "attachment",
          mimeType: part.mimeType,
          size: part.body?.size ?? 0,
          externalAttachmentId: attachId,
        });
      }
      walk(part.parts);
    }
  }

  walk(message.payload?.parts);
  return attachments;
}
