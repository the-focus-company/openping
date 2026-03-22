"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@convex/_generated/api";
import { useWorkspace } from "@/hooks/useWorkspace";
import Link from "next/link";
import { Hash, MessageSquare, AtSign, Star, Loader2, Plus, Lock } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ChannelsPage() {
  const { workspaceId, buildPath } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();

  const activity = useQuery(
    api.channels.listActivity,
    workspaceId ? { workspaceId } : "skip",
  );
  const channels = useQuery(
    api.channels.list,
    workspaceId ? { workspaceId } : "skip",
  );

  const createChannel = useMutation(api.channels.create);
  const [addChannelOpen, setAddChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);

  // Auto-open "Create channel" dialog when navigating with ?new=1
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setAddChannelOpen(true);
    }
  }, [searchParams]);

  const handleCreateChannel = async () => {
    const name = newChannelName.trim().toLowerCase().replace(/\s+/g, "-");
    if (!name || !workspaceId) return;
    try {
      const channelId = await createChannel({ workspaceId, name, isPrivate: newChannelPrivate });
      setNewChannelName("");
      setNewChannelPrivate(false);
      setAddChannelOpen(false);
      router.push(buildPath(`/channel/${channelId}`));
    } catch (err) {
      console.error("Failed to create channel:", err);
    }
  };

  // Group activity by channel
  const groupedActivity = useMemo(() => {
    if (!activity) return [];
    const map = new Map<
      string,
      {
        channelId: string;
        channelName: string;
        isStarred: boolean;
        items: typeof activity;
      }
    >();

    for (const item of activity) {
      if (!map.has(item.channelId)) {
        map.set(item.channelId, {
          channelId: item.channelId,
          channelName: item.channelName,
          isStarred: item.isStarred,
          items: [],
        });
      }
      map.get(item.channelId)!.items.push(item);
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.isStarred && !b.isStarred) return -1;
      if (!a.isStarred && b.isStarred) return 1;
      const aLatest = Math.max(...a.items.map((i) => i.createdAt));
      const bLatest = Math.max(...b.items.map((i) => i.createdAt));
      return bLatest - aLatest;
    });
  }, [activity]);

  // Channels without activity (for the bottom section)
  const channelsWithoutActivity = useMemo(() => {
    if (!channels || !activity) return [];
    const activeChannelIds = new Set(activity.map((a) => a.channelId));
    return channels
      .filter((c) => c.isMember && !activeChannelIds.has(c._id))
      .sort((a, b) => {
        if (a.isStarred && !b.isStarred) return -1;
        if (!a.isStarred && b.isStarred) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [channels, activity]);

  if (activity === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-foreground/40" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground mb-1">Channels</h1>
          <p className="text-sm text-muted-foreground">
            Recent threads and mentions from your channels
          </p>
        </div>
        <Button
          size="sm"
          className="h-7 gap-1.5 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover"
          onClick={() => setAddChannelOpen(true)}
        >
          <Plus className="h-3 w-3" />
          New
        </Button>
      </div>

      {groupedActivity.length === 0 && (
        <div className="rounded-lg border border-subtle bg-surface-1 p-8 text-center">
          <Hash className="mx-auto h-8 w-8 text-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">No recent activity in your channels</p>
        </div>
      )}

      {groupedActivity.map((group) => (
        <div key={group.channelId} className="mb-6">
          <Link
            href={buildPath(`/channel/${group.channelId}`)}
            className="flex items-center gap-2 mb-2 group"
          >
            {group.isStarred && (
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            )}
            <Hash className="h-3.5 w-3.5 text-foreground/50" />
            <span className="text-sm font-medium text-foreground group-hover:text-ping-purple transition-colors">
              {group.channelName}
            </span>
          </Link>

          <div className="space-y-1 pl-1">
            {group.items.slice(0, 5).map((item) => (
              <Link
                key={item.messageId}
                href={buildPath(`/channel/${item.channelId}?msg=${item.messageId}`)}
                className="flex items-start gap-2.5 rounded-md px-3 py-2 transition-colors hover:bg-surface-2"
              >
                <div className="mt-0.5 shrink-0">
                  {item.type === "mention" ? (
                    <AtSign className="h-3.5 w-3.5 text-ping-purple" />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5 text-foreground/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-foreground">{item.authorName}</span>
                    <span className="text-2xs text-muted-foreground">
                      {formatRelativeTime(new Date(item.createdAt))}
                    </span>
                    {item.type === "mention" && (
                      <span className="rounded bg-ping-purple/10 px-1 py-px text-2xs text-ping-purple">
                        mentioned you
                      </span>
                    )}
                    {item.type === "thread" && item.threadReplyCount && (
                      <span className="text-2xs text-muted-foreground">
                        {item.threadReplyCount} {item.threadReplyCount === 1 ? "reply" : "replies"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground/70 line-clamp-2">{item.body}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* Other channels without recent activity */}
      {channelsWithoutActivity.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xs font-medium uppercase tracking-widest text-foreground/50 mb-3">
            Other channels
          </h2>
          <div className="space-y-0.5">
            {channelsWithoutActivity.map((channel) => (
              <Link
                key={channel._id}
                href={buildPath(`/channel/${channel._id}`)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-surface-2",
                  "text-muted-foreground hover:text-foreground",
                )}
              >
                {channel.isStarred ? (
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                ) : (
                  <Hash className="h-3.5 w-3.5 text-foreground/50" />
                )}
                <span className="flex-1 truncate">{channel.name}</span>
                {channel.unreadCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground/10 px-1 text-2xs font-medium text-foreground/70 tabular-nums">
                    {channel.unreadCount}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
      {/* Create Channel Dialog */}
      <Dialog open={addChannelOpen} onOpenChange={setAddChannelOpen}>
        <DialogContent className="border-subtle bg-surface-2 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Create channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
                Channel name
              </label>
              <input
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateChannel()}
                placeholder="e.g. announcements"
                className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/45 focus:border-ring focus:outline-none"
                autoFocus
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newChannelPrivate}
                onChange={(e) => setNewChannelPrivate(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-subtle bg-surface-3"
              />
              <div className="flex items-center gap-1.5">
                <Lock className="h-3 w-3 text-foreground/50" />
                <span className="text-xs text-muted-foreground">Private channel</span>
              </div>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAddChannelOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!newChannelName.trim()}
                className="h-7 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover disabled:opacity-40"
                onClick={handleCreateChannel}
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
