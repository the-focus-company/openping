"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Inbox, Hash, Plus, Search } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SIDEBAR_WIDTH } from "@/lib/constants";

// Static placeholder data — will be replaced with real data from Convex
const MOCK_CHANNELS = [
  { id: "general", name: "general" },
  { id: "engineering", name: "engineering" },
  { id: "design", name: "design" },
  { id: "product", name: "product" },
];

const MOCK_UNREAD_COUNT = 3;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div
      className="flex h-full flex-col border-r border-border bg-card"
      style={{ width: SIDEBAR_WIDTH }}
    >
      {/* Workspace name */}
      <div className="flex h-12 items-center px-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span className="truncate text-lg font-semibold text-foreground">
            PING
          </span>
        </div>
      </div>

      <Separator className="bg-border" />

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-2">
        {/* Inbox */}
        <Link
          href="/inbox"
          className={`flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors ${
            pathname === "/inbox"
              ? "bg-[#6366F1]/10 text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Inbox className="h-4 w-4" />
          <span className="flex-1">Inbox</span>
          {MOCK_UNREAD_COUNT > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#6366F1] px-1.5 text-xs font-medium text-white">
              {MOCK_UNREAD_COUNT}
            </span>
          )}
        </Link>

        {/* Channels header */}
        <div className="mt-4 flex items-center justify-between px-2">
          <span className="text-xs font-medium uppercase tracking-wider text-[#5C5C5F]">
            Channels
          </span>
        </div>

        {/* Channel list */}
        {MOCK_CHANNELS.map((channel) => {
          const isActive = pathname === `/channel/${channel.id}`;
          return (
            <Link
              key={channel.id}
              href={`/channel/${channel.id}`}
              className={`flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors ${
                isActive
                  ? "border-l-2 border-[#6366F1] bg-[#6366F1]/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Hash className="h-3.5 w-3.5" />
              <span>{channel.name}</span>
            </Link>
          );
        })}

        {/* Add channel */}
        <button className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-[#5C5C5F] transition-colors hover:bg-muted hover:text-foreground">
          <Plus className="h-3.5 w-3.5" />
          <span>Add channel</span>
        </button>
      </div>

      {/* Bottom: Search */}
      <div className="border-t border-border p-2">
        <button className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted">
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="rounded border border-[#333] bg-muted px-1.5 py-0.5 text-[10px] text-[#5C5C5F]">
            &#8984;K
          </kbd>
        </button>
      </div>
    </div>
  );
}
