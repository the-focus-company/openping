"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Check, Hash, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChannelSelectionStepProps {
  workspaceId: Id<"workspaces">;
  onNext: () => void;
}

export function ChannelSelectionStep({ workspaceId, onNext }: ChannelSelectionStepProps) {
  const channels = useQuery(api.channels.list, { workspaceId });
  const joinChannel = useMutation(api.channels.join);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggleChannel = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleContinue = async () => {
    setSaving(true);
    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          joinChannel({ channelId: id as Id<"channels"> }),
        ),
      );
      onNext();
    } catch {
      setSaving(false);
    }
  };

  if (!channels) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const availableChannels = channels.filter(
    (c) => !c.isMember && !c.isArchived,
  );
  const joinedChannels = channels.filter((c) => c.isMember);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Join Channels
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Select channels to stay in the loop with your team.
        </p>
      </div>

      <div className="space-y-1">
        {joinedChannels.map((channel) => (
          <div
            key={channel._id}
            className="flex items-center gap-3 rounded-lg border border-subtle bg-surface-2 px-3 py-2 opacity-50"
          >
            <Hash className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <div className="text-xs font-medium">{channel.name}</div>
              {channel.description && (
                <div className="text-2xs text-muted-foreground">
                  {channel.description}
                </div>
              )}
            </div>
            <span className="text-2xs text-muted-foreground">Joined</span>
          </div>
        ))}

        {availableChannels.map((channel) => (
          <button
            key={channel._id}
            type="button"
            onClick={() => toggleChannel(channel._id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
              selected.has(channel._id)
                ? "border-ping-purple bg-ping-purple/10"
                : "border-subtle bg-surface-2 hover:border-white/20",
            )}
          >
            <Hash className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <div className="text-xs font-medium">{channel.name}</div>
              {channel.description && (
                <div className="text-2xs text-muted-foreground">
                  {channel.description}
                </div>
              )}
            </div>
            <div
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                selected.has(channel._id)
                  ? "border-ping-purple bg-ping-purple text-white"
                  : "border-white/20",
              )}
            >
              {selected.has(channel._id) && (
                <Check className="h-3 w-3" />
              )}
            </div>
          </button>
        ))}

        {availableChannels.length === 0 && joinedChannels.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No channels available yet.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={onNext}
          disabled={saving}
        >
          Skip
        </Button>
        <Button
          size="sm"
          className="bg-ping-purple px-6 text-xs text-white hover:bg-ping-purple/90"
          onClick={handleContinue}
          disabled={saving}
        >
          {saving ? "Joining..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
