"use client";

import { useState, useEffect } from "react";
import { Video, PhoneOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, avatarGradient } from "@/lib/utils";

interface MeetingParticipant {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  joinedAt: number;
}

interface MeetingCardProps {
  title: string;
  provider: string;
  meetingUrl: string;
  status: string;
  startedBy: { name: string; avatarUrl?: string | null };
  startedAt: number;
  endedAt?: number;
  participants: MeetingParticipant[];
  onJoin: () => void;
  onEnd?: () => void;
}

function formatDuration(startMs: number, endMs?: number): string {
  const elapsed = Math.floor(((endMs ?? Date.now()) - startMs) / 1000);
  if (elapsed < 60) return `${elapsed}s`;
  const mins = Math.floor(elapsed / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

export function MeetingCard({
  title,
  status,
  startedBy,
  startedAt,
  endedAt,
  participants,
  onJoin,
  onEnd,
}: MeetingCardProps) {
  const isActive = status === "active";
  const [, setTick] = useState(0);

  // Live duration counter for active meetings
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <div
      className={cn(
        "my-1 max-w-sm rounded border p-3",
        isActive
          ? "border-green-500/30 bg-green-500/5"
          : "border-subtle bg-surface-2/50",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full",
            isActive ? "bg-green-500/20" : "bg-surface-3",
          )}
        >
          <Video
            className={cn(
              "h-3.5 w-3.5",
              isActive ? "text-green-400" : "text-muted-foreground",
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-medium text-foreground">
              {title}
            </span>
            {isActive && (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <span>Started by {startedBy.name}</span>
            <span className="text-foreground/20">·</span>
            <span>
              {isActive
                ? formatDuration(startedAt)
                : `Ended after ${formatDuration(startedAt, endedAt)}`}
            </span>
            {participants.length > 0 && (
              <>
                <span className="text-foreground/20">·</span>
                <span>
                  {participants.length}{" "}
                  {participants.length === 1 ? "participant" : "participants"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Participants */}
      {participants.length > 0 && (
        <div className="mt-2 flex -space-x-1.5">
          {participants.slice(0, 8).map((p) => (
            <Avatar key={p.userId} className="h-5 w-5 border border-background">
              {p.avatarUrl && <AvatarImage src={p.avatarUrl} alt={p.name} />}
              <AvatarFallback
                className={cn(
                  "text-[8px] font-medium bg-gradient-to-br text-white",
                  avatarGradient(p.userId + p.name),
                )}
              >
                {p.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
          {participants.length > 8 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-background bg-surface-3 text-[8px] text-muted-foreground">
              +{participants.length - 8}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      {isActive && (
        <div className="mt-2.5 flex items-center gap-2">
          <button
            onClick={onJoin}
            className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
          >
            <Video className="h-3 w-3" />
            Join meeting
          </button>
          {onEnd && (
            <button
              onClick={onEnd}
              className="flex items-center gap-1.5 rounded-md border border-subtle px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
            >
              <PhoneOff className="h-3 w-3" />
              End
            </button>
          )}
        </div>
      )}
    </div>
  );
}
