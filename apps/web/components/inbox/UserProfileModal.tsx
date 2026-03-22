"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { X, Mail, Briefcase, BookOpen, Loader2 } from "lucide-react";

interface UserProfileModalProps {
  userId: string;
  onClose: () => void;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function UserProfileModal({ userId, onClose }: UserProfileModalProps) {
  const user = useQuery(api.users.getProfile, { userId: userId as Id<"users"> });

  return (
    // Render on top of the decision modal (z-60)
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/20"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 z-[70] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-subtle bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground">Profile</span>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {user === undefined ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-4 w-4 animate-spin text-foreground/20" />
          </div>
        ) : user === null ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            Profile not found
          </div>
        ) : (
          <div className="p-5">
            {/* Avatar + name */}
            <div className="flex items-start gap-4 mb-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-3 text-sm font-semibold text-foreground/70">
                {initials(user.name)}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">{user.name}</h3>
                {user.title && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{user.title}</p>
                )}
                {user.department && (
                  <span className="mt-1 inline-block rounded bg-surface-2 px-1.5 py-px text-2xs text-foreground/50">
                    {user.department}
                  </span>
                )}
              </div>
            </div>

            {/* Bio */}
            {user.bio && (
              <div className="mb-4">
                <div className="mb-1.5 flex items-center gap-1.5 text-2xs text-foreground/30">
                  <BookOpen className="h-3 w-3" />
                  About
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{user.bio}</p>
              </div>
            )}

            {/* Expertise */}
            {user.expertise && user.expertise.length > 0 && (
              <div className="mb-4">
                <div className="mb-1.5 flex items-center gap-1.5 text-2xs text-foreground/30">
                  <Briefcase className="h-3 w-3" />
                  Expertise
                </div>
                <div className="flex flex-wrap gap-1">
                  {user.expertise.map((skill, i) => (
                    <span
                      key={i}
                      className="rounded bg-surface-2 px-2 py-0.5 text-2xs text-foreground/60"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Email */}
            <div className="flex items-center gap-1.5 text-2xs text-foreground/30">
              <Mail className="h-3 w-3" />
              <span className="text-foreground/50">{user.email}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
