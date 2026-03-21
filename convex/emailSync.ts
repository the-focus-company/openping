import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const MAX_EMAILS_PER_INVOCATION = 50;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    mimeType?: string;
    body?: { data?: string };
    parts?: Array<{
      mimeType?: string;
      body?: { data?: string };
      parts?: Array<{
        mimeType?: string;
        body?: { data?: string };
      }>;
    }>;
  };
  snippet?: string;
  internalDate?: string;
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
}

interface GmailHistoryResponse {
  history?: Array<{
    messagesAdded?: Array<{ message: { id: string; threadId: string } }>;
  }>;
  historyId?: string;
  nextPageToken?: string;
}

function getHeader(message: GmailMessage, name: string): string {
  const header = message.payload?.headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  );
  return header?.value ?? "";
}

function parseAddressList(headerValue: string): string[] {
  if (!headerValue) return [];
  return headerValue.split(",").map((addr) => addr.trim()).filter(Boolean);
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64);
}

function extractPlainTextBody(message: GmailMessage): string {
  if (message.payload?.parts) {
    for (const part of message.payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      // Check nested parts (e.g., multipart/alternative inside multipart/mixed)
      if (part.parts) {
        for (const subPart of part.parts) {
          if (subPart.mimeType === "text/plain" && subPart.body?.data) {
            return decodeBase64Url(subPart.body.data);
          }
        }
      }
    }
  }

  if (message.payload?.body?.data) {
    return decodeBase64Url(message.payload.body.data);
  }

  return "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getValidAccessToken(
  ctx: any,
  account: { _id: Id<"emailAccounts">; accessToken: string; tokenExpiresAt: number },
): Promise<string> {
  if (account.tokenExpiresAt < Date.now() + 5 * 60 * 1000) {
    return await ctx.runAction(internal.emailAuth.refreshToken, {
      emailAccountId: account._id,
    });
  }
  return account.accessToken;
}

export const syncEmailAccount = internalAction({
  args: {
    emailAccountId: v.id("emailAccounts"),
  },
  handler: async (ctx, args) => {
    const account = await ctx.runQuery(internal.emailAuth.getEmailAccount, {
      emailAccountId: args.emailAccountId,
    });
    if (!account || account.status !== "active") return;

    if (!account.syncCursor) {
      await ctx.scheduler.runAfter(0, internal.emailSync.initialSync, {
        emailAccountId: args.emailAccountId,
      });
      return;
    }

    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(ctx, account);
    } catch {
      return; // Token refresh already set error status
    }

    let pageToken: string | undefined;
    let newHistoryId: string | undefined;

    do {
      const params = new URLSearchParams({
        startHistoryId: account.syncCursor,
        historyTypes: "messageAdded",
        maxResults: "100",
      });
      if (pageToken) params.set("pageToken", pageToken);

      const response = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/history?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (response.status === 404) {
        // History expired, do full re-sync
        await ctx.scheduler.runAfter(0, internal.emailSync.initialSync, {
          emailAccountId: args.emailAccountId,
        });
        return;
      }

      if (!response.ok) {
        const errorBody = await response.text();
        await ctx.runMutation(internal.emailAuth.updateAccountStatus, {
          emailAccountId: args.emailAccountId,
          status: "error",
          errorMessage: `History sync failed: ${errorBody}`,
        });
        return;
      }

      const data = (await response.json()) as GmailHistoryResponse;
      newHistoryId = data.historyId;

      if (data.history) {
        for (const entry of data.history) {
          if (entry.messagesAdded) {
            for (const added of entry.messagesAdded) {
              await fetchAndStoreMessage(
                ctx,
                accessToken,
                added.message.id,
                args.emailAccountId,
                account.userId,
                account.workspaceId,
              );
            }
          }
        }
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    if (newHistoryId) {
      await ctx.runMutation(internal.emailSync.updateSyncCursor, {
        emailAccountId: args.emailAccountId,
        syncCursor: newHistoryId,
      });
    }
  },
});

export const initialSync = internalAction({
  args: {
    emailAccountId: v.id("emailAccounts"),
    pageToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.runQuery(internal.emailAuth.getEmailAccount, {
      emailAccountId: args.emailAccountId,
    });
    if (!account || account.status !== "active") return;

    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(ctx, account);
    } catch {
      return;
    }

    const after = Math.floor((Date.now() - THIRTY_DAYS_MS) / 1000);
    const params = new URLSearchParams({
      q: `after:${after}`,
      maxResults: String(MAX_EMAILS_PER_INVOCATION),
    });
    if (args.pageToken) params.set("pageToken", args.pageToken);

    const listResponse = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!listResponse.ok) {
      const errorBody = await listResponse.text();
      await ctx.runMutation(internal.emailAuth.updateAccountStatus, {
        emailAccountId: args.emailAccountId,
        status: "error",
        errorMessage: `Initial sync list failed: ${errorBody}`,
      });
      return;
    }

    const listData = (await listResponse.json()) as GmailListResponse;

    if (listData.messages) {
      for (const msg of listData.messages) {
        await fetchAndStoreMessage(
          ctx,
          accessToken,
          msg.id,
          args.emailAccountId,
          account.userId,
          account.workspaceId,
        );
      }
    }

    if (listData.nextPageToken) {
      await ctx.scheduler.runAfter(0, internal.emailSync.initialSync, {
        emailAccountId: args.emailAccountId,
        pageToken: listData.nextPageToken,
      });
    } else {
      // Set historyId cursor only on the final page so incremental sync starts from here
      const profileResponse = await fetch(
        "https://www.googleapis.com/gmail/v1/users/me/profile",
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (profileResponse.ok) {
        const profile = (await profileResponse.json()) as { historyId: string };
        await ctx.runMutation(internal.emailSync.updateSyncCursor, {
          emailAccountId: args.emailAccountId,
          syncCursor: profile.historyId,
        });
      }
    }
  },
});

export const syncAllAccounts = internalAction({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.runQuery(
      internal.emailSync.listActiveAccounts,
    );

    for (const account of accounts) {
      await ctx.scheduler.runAfter(0, internal.emailSync.syncEmailAccount, {
        emailAccountId: account._id,
      });
    }
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAndStoreMessage(
  ctx: any,
  accessToken: string,
  messageId: string,
  emailAccountId: Id<"emailAccounts">,
  userId: Id<"users">,
  workspaceId: Id<"workspaces">,
): Promise<void> {
  const exists = await ctx.runQuery(internal.emailSync.emailExistsByGmailId, {
    gmailId: messageId,
  });
  if (exists) return;

  const response = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) return;

  const message = (await response.json()) as GmailMessage;

  const subject = getHeader(message, "Subject");
  const from = getHeader(message, "From");
  const to = parseAddressList(getHeader(message, "To"));
  const cc = parseAddressList(getHeader(message, "Cc"));
  const bcc = parseAddressList(getHeader(message, "Bcc"));
  const body = extractPlainTextBody(message);
  const receivedAt = message.internalDate
    ? parseInt(message.internalDate, 10)
    : Date.now();
  const isRead = !(message.labelIds ?? []).includes("UNREAD");
  const labels = message.labelIds ?? [];

  await ctx.runMutation(internal.emailSync.upsertEmail, {
    emailAccountId,
    userId,
    workspaceId,
    gmailId: message.id,
    threadId: message.threadId,
    subject,
    from,
    to,
    cc: cc.length > 0 ? cc : undefined,
    bcc: bcc.length > 0 ? bcc : undefined,
    body,
    snippet: message.snippet,
    receivedAt,
    isRead,
    labels,
  });
}

export const listActiveAccounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("emailAccounts")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  },
});

export const emailExistsByGmailId = internalQuery({
  args: { gmailId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emails")
      .withIndex("by_gmail_id", (q) => q.eq("gmailId", args.gmailId))
      .first();
    return existing !== null;
  },
});

export const upsertEmail = internalMutation({
  args: {
    emailAccountId: v.id("emailAccounts"),
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    gmailId: v.string(),
    threadId: v.string(),
    subject: v.string(),
    from: v.string(),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    bcc: v.optional(v.array(v.string())),
    body: v.string(),
    snippet: v.optional(v.string()),
    receivedAt: v.number(),
    isRead: v.boolean(),
    labels: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emails")
      .withIndex("by_gmail_id", (q) => q.eq("gmailId", args.gmailId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        isRead: args.isRead,
        labels: args.labels,
      });
      return existing._id;
    }

    return await ctx.db.insert("emails", {
      emailAccountId: args.emailAccountId,
      userId: args.userId,
      workspaceId: args.workspaceId,
      gmailId: args.gmailId,
      threadId: args.threadId,
      subject: args.subject,
      from: args.from,
      to: args.to,
      cc: args.cc,
      bcc: args.bcc,
      body: args.body,
      snippet: args.snippet,
      receivedAt: args.receivedAt,
      isRead: args.isRead,
      labels: args.labels,
    });
  },
});

export const updateSyncCursor = internalMutation({
  args: {
    emailAccountId: v.id("emailAccounts"),
    syncCursor: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailAccountId, {
      syncCursor: args.syncCursor,
      lastSyncedAt: Date.now(),
    });
  },
});
