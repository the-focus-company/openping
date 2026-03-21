"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { TOPBAR_HEIGHT } from "@/lib/constants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface TopBarProps {
  onToggleSidebar: () => void;
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const pathname = usePathname();

  let title = "Inbox";
  if (pathname?.startsWith("/channel/")) {
    const channelId = pathname.split("/channel/")[1];
    title = `# ${channelId}`;
  } else if (pathname === "/settings") {
    title = "Settings";
  }

  return (
    <header
      className="flex items-center justify-between border-b border-border px-4"
      style={{ height: TOPBAR_HEIGHT, minHeight: TOPBAR_HEIGHT }}
    >
      <div className="flex items-center gap-3">
        {/* Hamburger for mobile / collapsed sidebar */}
        <button
          onClick={onToggleSidebar}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-[#6366F1] text-xs text-white">
                  U
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => (window.location.href = "/login")}
              className="cursor-pointer"
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
