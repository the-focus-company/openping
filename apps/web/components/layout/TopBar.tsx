"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import { TOPBAR_HEIGHT } from "@/lib/constants";
import { SearchField } from "./SearchField";

/** Still used by DashboardShell for document.title */
export function titleFromPath(pathname: string): string | null {
  const p = pathname.replace(/^\/app\/[^/]+/, "");
  if (p === "/inbox" || p === "") return "My Deck";
  if (p === "/dms") return "Direct Messages";
  if (p.startsWith("/dm/")) return "Direct Message";
  if (p === "/channels") return "Channels";
  if (p.startsWith("/channel/")) return null;
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
  onOpenSearch: () => void;
  trailing?: ReactNode;
  workspaceName?: string;
}

export function TopBar({
  onToggleSidebar,
  onOpenSearch,
  trailing,
  workspaceName,
}: TopBarProps) {
  const pathname = usePathname();
  const workspacePrefix = pathname.match(/^\/app\/[^/]+/)?.[0] ?? "";
  const inboxHref = workspacePrefix ? `${workspacePrefix}/inbox` : "/";

  return (
    <header
      role="banner"
      className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-subtle bg-background/80 px-3 backdrop-blur-sm"
      style={{ height: TOPBAR_HEIGHT, minHeight: TOPBAR_HEIGHT }}
    >
      {/* Left: mobile menu + logo + workspace */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <Link href={inboxHref} className="flex items-center gap-1.5 transition-opacity hover:opacity-80">
          <Image src="/ping-logo.png" alt="PING" width={20} height={20} className="dark:hidden" unoptimized />
          <Image src="/ping-logo-white.png" alt="PING" width={20} height={20} className="hidden dark:block" unoptimized />
          <span className="text-sm font-bold text-foreground">PING</span>
          {workspaceName && (
            <>
              <span className="text-foreground/40">·</span>
              <span className="text-sm font-medium text-foreground/60 hidden sm:inline">{workspaceName}</span>
            </>
          )}
        </Link>
      </div>

      {/* Center: search bar */}
      <div className="flex justify-center px-4 w-[480px]">
        <SearchField onOpenSearch={onOpenSearch} />
      </div>

      {/* Right: trailing actions */}
      <div className="flex items-center gap-2 justify-end min-w-0">
        {trailing}
      </div>
    </header>
  );
}
