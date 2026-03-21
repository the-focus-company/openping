"use client";

import { type ReactNode } from "react";
import { Menu, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { TOPBAR_HEIGHT } from "@/lib/constants";
import { Kbd } from "@/components/ui/kbd";

function titleFromPath(pathname: string): string {
  if (pathname === "/inbox") return "Inbox";
  if (pathname === "/dms") return "Direct Messages";
  if (pathname.startsWith("/dm/")) return "Direct Message";
  if (pathname.startsWith("/channel/")) return `# ${pathname.split("/channel/")[1]}`;
  if (pathname === "/settings/profile") return "Profile";
  if (pathname === "/settings/workspace") return "Workspace";
  if (pathname === "/settings/team") return "Team";
  if (pathname === "/settings/agents") return "Agents";
  if (pathname === "/settings/knowledge-graph") return "Knowledge Graph";
  if (pathname === "/settings/analytics") return "Analytics";
  if (pathname === "/admin") return "Backoffice";
  if (pathname.includes("/security")) return "Security";
  if (pathname.includes("/proxy")) return "Impersonation";
  return "PING";
}

interface TopBarProps {
  onToggleSidebar: () => void;
  onOpenSearch?: () => void;
  trailing?: ReactNode;
}

export function TopBar({ onToggleSidebar, onOpenSearch, trailing }: TopBarProps) {
  const title = titleFromPath(usePathname());

  return (
    <header
      className="flex items-center justify-between border-b border-subtle bg-background/80 px-3 backdrop-blur-sm"
      style={{ height: TOPBAR_HEIGHT, minHeight: TOPBAR_HEIGHT }}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <h1 className="text-sm font-medium text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSearch}
          className="hidden items-center gap-2 rounded border border-subtle px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground sm:flex"
        >
          <Search className="h-3 w-3" />
          <span>Search or jump to...</span>
          <Kbd>⌘K</Kbd>
        </button>
        {trailing}
      </div>
    </header>
  );
}
