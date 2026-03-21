"use client";

import { ReactNode, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Sidebar } from "./Sidebar";
import { TopBar, titleFromPath } from "./TopBar";
import { TopBarProvider } from "./TopBarContext";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { ThemeToggle } from "./ThemeToggle";
import { SIDEBAR_WIDTH } from "@/lib/constants";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";

function isEditableTarget(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((e.target as HTMLElement)?.isContentEditable) return true;
  return false;
}

export function DashboardShell({ children }: { children: ReactNode }) {
  usePresenceHeartbeat();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const pendingKeyRef = useRef<string | null>(null);
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Extract /workspace/{slug} prefix for routing
  const workspacePrefix = pathname.match(/^\/app\/[^/]+/)?.[0] ?? "";
  const workspaceSlug = pathname.match(/^\/app\/([^/]+)/)?.[1];

  // Unread count for browser tab title
  const { isAuthenticated } = useConvexAuth();
  const workspace = useQuery(api.workspaces.getBySlug, isAuthenticated && workspaceSlug ? { slug: workspaceSlug } : "skip");
  const workspaceId = workspace?._id as Id<"workspaces"> | undefined;
  const channels = useQuery(api.channels.list, isAuthenticated && workspaceId ? { workspaceId } : "skip");
  const dmConversations = useQuery(api.directConversations.list, isAuthenticated ? {} : "skip");
  const inboxUnread = useQuery(api.inboxSummaries.unreadCount, isAuthenticated ? {} : "skip");
  const currentUser = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");

  // Resolve channel/DM names from already-loaded data to avoid flashing raw IDs
  const resolvedTitle = useMemo(() => {
    const p = pathname.replace(/^\/app\/[^/]+/, "");

    const channelMatch = p.match(/^\/channel\/(.+)$/);
    if (channelMatch && channels) {
      const ch = channels.find((c) => c._id === channelMatch[1]);
      if (ch) return `# ${ch.name}`;
      return null;
    }

    const dmMatch = p.match(/^\/dm\/(.+)$/);
    if (dmMatch && dmConversations && currentUser) {
      const conv = dmConversations.find((c) => c._id === dmMatch[1]);
      if (conv) {
        const otherMembers = conv.members.filter((m) => m.userId !== currentUser._id);
        return conv.name || otherMembers.map((m) => m.name).join(", ") || "Direct Message";
      }
      return "Direct Message";
    }

    return titleFromPath(pathname);
  }, [pathname, channels, dmConversations, currentUser]);

  useEffect(() => {
    const channelUnread = channels?.reduce((sum, ch) => sum + (ch.unreadCount ?? 0), 0) ?? 0;
    const dmUnread = dmConversations?.reduce((sum, conv) => sum + (conv.unreadCount ?? 0), 0) ?? 0;
    const inbox = inboxUnread ?? 0;
    const total = channelUnread + dmUnread + inbox;
    document.title = total > 0 ? `(${total}) PING` : "PING";
    return () => {
      document.title = "PING";
    };
  }, [channels, dmConversations, inboxUnread]);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);
  const openSearch = useCallback(() => setCmdOpen(true), []);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);

  const clearChord = useCallback(() => {
    pendingKeyRef.current = null;
    if (chordTimerRef.current) {
      clearTimeout(chordTimerRef.current);
      chordTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘B — toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      // ⌘K — command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(true);
        return;
      }

      // Skip chord/single-key shortcuts when typing in editable elements
      if (isEditableTarget(e)) return;
      // Skip when modifier keys are held (except shift)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // Second key of a chord
      if (pendingKeyRef.current === "g") {
        clearChord();
        if (key === "i") {
          e.preventDefault();
          router.push(`${workspacePrefix}/inbox`);
          return;
        }
        if (key === "t") {
          e.preventDefault();
          router.push(`${workspacePrefix}/settings/team`);
          return;
        }
        return;
      }

      // First key of a chord
      if (key === "g") {
        pendingKeyRef.current = "g";
        chordTimerRef.current = setTimeout(() => {
          pendingKeyRef.current = null;
          chordTimerRef.current = null;
        }, 500);
        return;
      }

      // ? — keyboard shortcuts
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearChord();
    };
  }, [toggleSidebar, clearChord, router, workspacePrefix]);

  return (
    <TopBarProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed z-30 h-full transition-transform duration-200 ease-out md:relative md:z-0 ${
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full md:-translate-x-full"
          }`}
          style={{ width: SIDEBAR_WIDTH }}
        >
          <Sidebar
            onOpenSearch={openSearch}
            onOpenShortcuts={openShortcuts}
          />
        </aside>

        {/* Main */}
        <div className="flex flex-1 flex-col overflow-hidden transition-all duration-200">
          <TopBar
            onToggleSidebar={toggleSidebar}
            onOpenSearch={openSearch}
            trailing={<ThemeToggle />}
            title={resolvedTitle}
          />
          <main className="flex-1 overflow-auto scrollbar-thin">{children}</main>
        </div>

        {/* Modals */}
        <CommandPalette
          open={cmdOpen}
          onOpenChange={setCmdOpen}
          onToggleSidebar={toggleSidebar}
        />
        <KeyboardShortcutsDialog
          open={shortcutsOpen}
          onOpenChange={setShortcutsOpen}
        />
      </div>
    </TopBarProvider>
  );
}
