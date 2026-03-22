"use client";

import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarGradient } from "@/lib/utils";
import {
  Building2,
  Clock,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Sparkles,
} from "lucide-react";

interface UserProfileDialogProps {
  userId: Id<"users"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfileDialog({
  userId,
  open,
  onOpenChange,
}: UserProfileDialogProps) {
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(
    api.users.getProfile,
    isAuthenticated && userId ? { userId } : "skip",
  );

  const initials = profile?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const lastSeen = profile?.lastSeenAt
    ? formatLastSeen(profile.lastSeenAt)
    : null;

  const isOnline = profile?.presenceStatus === "online";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{profile?.name ?? "User Profile"}</DialogTitle>
        </DialogHeader>

        {!profile ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-foreground/40" />
          </div>
        ) : (
          <>
            {/* Header with avatar */}
            <div className="relative px-5 pt-5 pb-4">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <Avatar className="h-16 w-16">
                    {profile.avatarUrl && (
                      <AvatarImage src={profile.avatarUrl} alt={profile.name} />
                    )}
                    <AvatarFallback
                      className={`bg-gradient-to-br ${avatarGradient(
                        (userId ?? "") + (initials ?? ""),
                      )} text-white text-lg font-medium`}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {/* Online indicator */}
                  <span
                    className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background ${
                      isOnline ? "bg-green-500" : "bg-foreground/20"
                    }`}
                  />
                </div>

                <div className="min-w-0 flex-1 pt-1">
                  <h2 className="text-base font-semibold text-foreground truncate">
                    {profile.statusEmoji && (
                      <span className="mr-1.5">{profile.statusEmoji}</span>
                    )}
                    {profile.name}
                  </h2>
                  {profile.title && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {profile.title}
                      {profile.department && (
                        <span className="text-foreground/40">
                          {" "}
                          · {profile.department}
                        </span>
                      )}
                    </p>
                  )}
                  {profile.statusMessage && (
                    <p className="mt-1 text-xs text-foreground/60 italic truncate">
                      &ldquo;{profile.statusMessage}&rdquo;
                    </p>
                  )}
                  <p className="mt-1 text-2xs text-foreground/50">
                    {isOnline ? "Online" : lastSeen ? `Last seen ${lastSeen}` : "Offline"}
                  </p>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-subtle" />

            {/* Details */}
            <div className="px-5 py-4 space-y-3">
              {/* Email */}
              <ProfileRow icon={Mail} label={profile.email} />

              {/* Department */}
              {profile.department && (
                <ProfileRow icon={Building2} label={profile.department} />
              )}

              {/* Timezone */}
              {profile.communicationPrefs?.timezone && (
                <ProfileRow
                  icon={Globe}
                  label={profile.communicationPrefs.timezone}
                />
              )}

              {/* Preferred hours */}
              {profile.communicationPrefs?.preferredHours && (
                <ProfileRow
                  icon={Clock}
                  label={`Available ${profile.communicationPrefs.preferredHours}`}
                />
              )}

              {/* Response time goal */}
              {profile.communicationPrefs?.responseTimeGoal && (
                <ProfileRow
                  icon={MapPin}
                  label={`Responds within ${profile.communicationPrefs.responseTimeGoal}`}
                />
              )}
            </div>

            {/* Bio */}
            {profile.bio && (
              <>
                <div className="h-px bg-subtle" />
                <div className="px-5 py-4">
                  <p className="text-2xs font-medium uppercase tracking-widest text-foreground/40 mb-2">
                    About
                  </p>
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    {profile.bio}
                  </p>
                </div>
              </>
            )}

            {/* Work context */}
            {profile.workContext && (
              <>
                <div className="h-px bg-subtle" />
                <div className="px-5 py-4">
                  <p className="text-2xs font-medium uppercase tracking-widest text-foreground/40 mb-2">
                    Currently working on
                  </p>
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    {profile.workContext}
                  </p>
                </div>
              </>
            )}

            {/* Expertise tags */}
            {profile.expertise && profile.expertise.length > 0 && (
              <>
                <div className="h-px bg-subtle" />
                <div className="px-5 py-4">
                  <p className="text-2xs font-medium uppercase tracking-widest text-foreground/40 mb-2">
                    Expertise
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.expertise.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full border border-subtle bg-surface-1 px-2 py-0.5 text-2xs text-foreground/70"
                      >
                        <Sparkles className="h-2.5 w-2.5 text-ping-purple/60" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProfileRow({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5 text-xs text-foreground/70">
      <Icon className="h-3.5 w-3.5 text-foreground/50 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function formatLastSeen(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}
