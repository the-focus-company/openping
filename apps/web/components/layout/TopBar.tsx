"use client";

import { type ReactNode } from "react";
import { Menu, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { TOPBAR_HEIGHT } from "@/lib/constants";
import { Kbd } from "@/components/ui/kbd";

export function titleFromPath(pathname: string): string | null {
  // Strip /app/{slug} prefix
  const p = pathname.replace(/^\/app\/[^/]+/, "");
  if (p === "/inbox" || p === "") return "Inbox";
  if (p === "/dms") return "Direct Messages";
  if (p.startsWith("/dm/")) return "Direct Message";
  if (p.startsWith("/channel/")) return null; // resolved by DashboardShell
  if (p === "/settings/profile") return "Profile";
  if (p === "/settings/workspace") return "Workspace";
  if (p === "/settings/team") return "Team";
  if (p === "/settings/agents") return "Agents";
  if (p === "/settings/knowledge-graph") return "Knowledge Graph";
  if (p === "/settings/analytics") return "Analytics";
  if (pathname === "/admin") return "Backoffice";
  if (p.includes("/security")) return "Security";
  if (p.includes("/proxy")) return "Impersonation";
  return "PING";
}

interface TopBarProps {
  onToggleSidebar: () => void;
  onOpenSearch?: () => void;
  trailing?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
}

export function TopBar({ onToggleSidebar, onOpenSearch, trailing, title, subtitle }: TopBarProps) {
  const fallback = titleFromPath(usePathname());

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
        <h1 className="text-sm font-medium text-foreground">{title ?? fallback}</h1>
        {subtitle}
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
