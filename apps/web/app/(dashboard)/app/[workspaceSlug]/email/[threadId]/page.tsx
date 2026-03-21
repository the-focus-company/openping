"use client";

import { use, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import { ArrowLeft, Archive, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Loader2 } from "lucide-react";

/**
 * Sanitize HTML to prevent XSS attacks.
 * Strips script tags, event handlers, and dangerous attributes.
 */
function sanitizeHtml(html: string): string {
  // Remove script tags and their content
  let clean = html.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );
  // Remove event handlers (onclick, onerror, onload, etc.)
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "");
  // Remove javascript: URLs
  clean = clean.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, "");
  // Remove data: URLs in src attributes (can be used for XSS)
  clean = clean.replace(
    /src\s*=\s*["']data:(?!image\/)[^"']*["']/gi,
    'src=""',
  );
  // Remove iframe, object, embed tags
  clean = clean.replace(/<(iframe|object|embed|form)\b[^>]*>.*?<\/\1>/gis, "");
  clean = clean.replace(/<(iframe|object|embed|form)\b[^>]*\/?\s*>/gi, "");
  return clean;
}

interface Props {
  params: Promise<{ threadId: string }>;
}

export default function EmailThreadPage({ params }: Props) {
  const { threadId } = use(params);
  const router = useRouter();
  const { buildPath } = useWorkspace();
  const { isAuthenticated } = useConvexAuth();

  const threadEmails = useQuery(
    api.emails.listByThread,
    isAuthenticated ? { threadId } : "skip",
  );

  const markReadMutation = useMutation(api.emails.markRead);
  const archiveMutation = useMutation(api.emails.archive);
  const toggleStarMutation = useMutation(api.emails.toggleStar);

  // Mark emails as read when viewing the thread
  useEffect(() => {
    if (threadEmails) {
      threadEmails
        .filter((e) => !e.isRead)
        .forEach((e) => {
          markReadMutation({ emailId: e._id });
        });
    }
  }, [threadEmails, markReadMutation]);

  const subject = useMemo(() => {
    if (!threadEmails || threadEmails.length === 0) return "";
    return threadEmails[0].subject;
  }, [threadEmails]);

  if (threadEmails === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-white/20" />
      </div>
    );
  }

  if (threadEmails.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Thread not found</p>
        <button
          onClick={() => router.push(buildPath("/email"))}
          className="text-xs text-ping-purple hover:underline"
        >
          Back to email
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-subtle px-4 py-2">
        <button
          onClick={() => router.push(buildPath("/email"))}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex-1 truncate text-sm font-medium text-foreground">
          {subject}
        </h1>
        <span className="text-2xs text-muted-foreground">
          {threadEmails.length} message{threadEmails.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Thread emails */}
      <div className="divide-y divide-subtle">
        {threadEmails.map((email) => {
          const senderName = email.from.name || email.from.email;
          const senderInitial = senderName[0]?.toUpperCase() ?? "?";
          const recipients = email.to
            .map((r) => r.name || r.email)
            .join(", ");

          return (
            <div key={email._id} className="px-4 py-4">
              {/* Email header */}
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-medium text-foreground">
                  {senderInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {senderName}
                    </span>
                    <span className="text-2xs text-muted-foreground">
                      {formatRelativeTime(email.receivedAt)}
                    </span>
                  </div>
                  <p className="text-2xs text-muted-foreground">
                    To: {recipients}
                    {email.cc && email.cc.length > 0 && (
                      <>
                        {" "}
                        · CC:{" "}
                        {email.cc.map((r) => r.name || r.email).join(", ")}
                      </>
                    )}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleStarMutation({ emailId: email._id })}
                    className={cn(
                      "rounded p-1 transition-colors hover:bg-surface-3",
                      email.isStarred
                        ? "text-amber-400"
                        : "text-white/30 hover:text-foreground",
                    )}
                    title={email.isStarred ? "Unstar" : "Star"}
                  >
                    <Star
                      className="h-3.5 w-3.5"
                      fill={email.isStarred ? "currentColor" : "none"}
                    />
                  </button>
                  <button
                    onClick={() =>
                      archiveMutation({ emailId: email._id })
                    }
                    className="rounded p-1 text-white/30 transition-colors hover:bg-surface-3 hover:text-foreground"
                    title="Archive"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* AI Summary badge */}
              {email.aiSummary && (
                <div className="mb-3 rounded border border-ping-purple/20 bg-ping-purple/5 px-3 py-2">
                  <p className="text-2xs font-medium uppercase tracking-widest text-ping-purple/60">
                    AI Summary
                  </p>
                  <p className="mt-0.5 text-xs text-foreground">
                    {email.aiSummary}
                  </p>
                </div>
              )}

              {/* Email body */}
              <div className="prose prose-invert prose-sm max-w-none">
                {email.bodyHtml ? (
                  <div
                    className="email-body text-sm text-foreground/80 [&_a]:text-ping-purple [&_a]:underline [&_img]:max-w-full [&_img]:rounded"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHtml(email.bodyHtml),
                    }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm text-foreground/80">
                    {email.bodyText ?? email.snippet}
                  </pre>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
