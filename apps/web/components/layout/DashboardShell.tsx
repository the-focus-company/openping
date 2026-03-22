"use client";

import { ReactNode, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Sidebar } from "./Sidebar";
import { TopBar, titleFromPath } from "./TopBar";
import { TopBarProvider } from "./TopBarContext";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { ThemeToggle } from "./ThemeToggle";
import { PanelLeftOpen } from "lucide-react";
import { SIDEBAR_WIDTH_DEFAULT, SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX, TOPBAR_HEIGHT, THREAD_PANEL_WIDTH } from "@/lib/constants";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { ThreadPanelProvider, useThreadPanel } from "@/hooks/useThreadPanel";
import { SidebarContext } from "@/hooks/useSidebar";
import { ThreadPanel } from "@/components/channel/ThreadPanel";

function isEditableTarget(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((e.target as HTMLElement)?.isContentEditable) return true;
  return false;
}

export function DashboardShell({ children }: { children: ReactNode }) {
  usePresenceHeartbeat();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_WIDTH_DEFAULT);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const isResizingRef = useRef(false);
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
  const markChannelRead = useMutation(api.channels.markRead);
  const markDMRead = useMutation(api.directConversations.markRead);
  const { toast } = useToast();

  // Ordered list of navigable sidebar items for Alt+Arrow shortcuts
  const navItems = useMemo(() => {
    if (!workspacePrefix) return [];
    const items: Array<{ path: string; unread: number }> = [
      { path: `${workspacePrefix}/inbox`, unread: inboxUnread ?? 0 },
    ];
    if (dmConversations) {
      for (const conv of dmConversations.slice(0, 5)) {
        items.push({ path: `${workspacePrefix}/dm/${conv._id}`, unread: conv.unreadCount ?? 0 });
      }
    }
    if (channels) {
      for (const ch of channels) {
        if (!ch.isMember) continue;
        items.push({ path: `${workspacePrefix}/channel/${ch._id}`, unread: ch.unreadCount ?? 0 });
      }
    }
    return items;
  }, [workspacePrefix, channels, dmConversations, inboxUnread]);

  const isSettingsRoute = pathname.includes("/settings/");

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

  // Extract channel/DM names for breadcrumbs
  const channelName = useMemo(() => {
    const p = pathname.replace(/^\/app\/[^/]+/, "");
    const channelMatch = p.match(/^\/channel\/(.+)$/);
    if (channelMatch && channels) {
      const ch = channels.find((c) => c._id === channelMatch[1]);
      return ch?.name ?? null;
    }
    return null;
  }, [pathname, channels]);

  const conversationName = useMemo(() => {
    const p = pathname.replace(/^\/app\/[^/]+/, "");
    const dmMatch = p.match(/^\/dm\/(.+)$/);
    if (dmMatch && dmConversations && currentUser) {
      const conv = dmConversations.find((c) => c._id === dmMatch[1]);
      if (conv) {
        const otherMembers = conv.members.filter((m) => m.userId !== currentUser._id);
        return conv.name || otherMembers.map((m) => m.name).join(", ") || "Direct Message";
      }
    }
    return null;
  }, [pathname, dmConversations, currentUser]);

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

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, startWidth + ev.clientX - startX));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [sidebarWidth]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘B — toggle sidebar (skip if focus is in a rich text editor)
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        const active = document.activeElement;
        if (active?.closest(".tiptap, .ProseMirror")) return;
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

      // Alt+Arrow — navigate between channels/DMs in sidebar order
      // Alt+Shift+Arrow — navigate between unread channels/DMs only
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && !isEditableTarget(e)) {
        e.preventDefault();
        const pool = e.shiftKey ? navItems.filter((item) => item.unread > 0) : navItems;
        if (pool.length === 0) return;
        const currentIdx = pool.findIndex((item) => pathname.startsWith(item.path));
        const next = e.key === "ArrowUp" ? currentIdx - 1 : currentIdx + 1;
        if (next >= 0 && next < pool.length) {
          router.push(pool[next].path);
        }
        return;
      }

      // Shift+Escape — mark current channel/DM as read
      if (e.key === "Escape" && e.shiftKey) {
        const channelMatch = pathname.match(/\/channel\/([^/]+)$/);
        const dmMatch = pathname.match(/\/dm\/([^/]+)$/);
        if (channelMatch) {
          markChannelRead({ channelId: channelMatch[1] as Id<"channels"> });
          toast("Marked as read", "success");
        } else if (dmMatch) {
          markDMRead({ conversationId: dmMatch[1] as Id<"directConversations"> });
          toast("Marked as read", "success");
        }
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
        if (key === "c" && channels?.[0]) {
          e.preventDefault();
          router.push(`${workspacePrefix}/channel/${channels[0]._id}`);
          return;
        }
        if (key === "d") {
          e.preventDefault();
          router.push(`${workspacePrefix}/dms`);
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
  }, [toggleSidebar, clearChord, router, workspacePrefix, pathname, navItems, channels, markChannelRead, markDMRead, toast]);

  return (
    <SidebarContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
    <ThreadPanelProvider>
      <TopBarProvider>
        <div className="flex h-screen flex-col overflow-hidden bg-background">
          {/* TopBar — full width, always on top */}
          <TopBar
            onToggleSidebar={toggleSidebar}
            onOpenSearch={openSearch}
            trailing={<ThemeToggle />}
            workspaceName={workspace?.name}
            channelName={channelName}
            conversationName={conversationName}
          />

          {/* Below topbar: sidebar + content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Mobile overlay */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Sidebar wrapper — width animates to 0 when closed */}
            <div
              className="hidden md:block shrink-0 overflow-hidden transition-[width] duration-200 ease-out"
              style={{ width: sidebarOpen ? sidebarWidth : 0 }}
            >
              <aside className="h-full" style={{ width: sidebarWidth }}>
                <Sidebar
                  isSettingsRoute={isSettingsRoute}
                  onOpenShortcuts={openShortcuts}
                  onCollapse={toggleSidebar}
                />
              </aside>
            </div>

            {/* Resize handle (desktop only) */}
            {sidebarOpen && (
              <div
                className="hidden md:flex shrink-0 w-1 cursor-col-resize items-center justify-center hover:bg-ping-purple/20 active:bg-ping-purple/30 transition-colors"
                onMouseDown={handleResizeStart}
                onDoubleClick={() => setSidebarWidth(SIDEBAR_WIDTH_DEFAULT)}
              />
            )}

            {/* Mobile sidebar — slides in as overlay */}
            <aside
              className={`fixed top-[--topbar-h] z-30 h-[calc(100vh-var(--topbar-h))] transition-transform duration-200 ease-out md:hidden ${
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
              }`}
              style={{ width: sidebarWidth, "--topbar-h": `${TOPBAR_HEIGHT}px` } as React.CSSProperties}
            >
              <Sidebar
                isSettingsRoute={isSettingsRoute}
                onOpenShortcuts={openShortcuts}
              />
            </aside>

            {/* Main content + Thread panel */}
            <div className="flex flex-1 overflow-hidden">
              <main className="flex-1 overflow-auto scrollbar-thin">{children}</main>
              <ThreadPanelSlot />
            </div>
          </div>

          {/* Show sidebar button (bottom-left, visible when sidebar is hidden on desktop) */}
          {!sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="fixed bottom-4 left-4 z-30 hidden md:flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 border border-subtle text-muted-foreground shadow-sm transition-colors hover:bg-surface-3 hover:text-foreground"
              title="Show sidebar (⌘B)"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}

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
    </ThreadPanelProvider>
    </SidebarContext.Provider>
  );
}

function ThreadPanelSlot() {
  const { openThread, closeThreadPanel } = useThreadPanel();

  // Escape — close thread panel (when no modal is open)
  useEffect(() => {
    if (!openThread) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.shiftKey) {
        // Don't close if focus is in a modal (Radix portals into [role="dialog"])
        const inModal = (e.target as HTMLElement)?.closest("[role='dialog']");
        if (inModal) return;
        // Don't close if editing a message (textarea inside message list)
        const inEditTextarea = (e.target as HTMLElement)?.closest(".group");
        if ((e.target as HTMLElement)?.tagName === "TEXTAREA" && inEditTextarea) return;
        closeThreadPanel();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [openThread, closeThreadPanel]);

  return (
    <AnimatePresence>
      {openThread && (
        <>
          {/* Mobile overlay */}
          <motion.div
            key="thread-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={closeThreadPanel}
          />

          {/* Mobile: full-screen slide from right */}
          <motion.aside
            key="thread-mobile"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-50 bg-background md:hidden"
          >
            <ThreadPanel
              parentMessageId={openThread.parentMessageId}
              messageTable={openThread.messageTable}
              channelId={openThread.channelId}
              conversationId={openThread.conversationId}
              contextName={openThread.contextName}
              onClose={closeThreadPanel}
            />
          </motion.aside>

          {/* Desktop: width animation so conversation resizes smoothly */}
          <motion.div
            key="thread-desktop"
            initial={{ width: 0 }}
            animate={{ width: THREAD_PANEL_WIDTH }}
            exit={{ width: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="hidden h-full overflow-hidden border-l border-subtle md:block"
          >
            <div className="h-full" style={{ width: THREAD_PANEL_WIDTH }}>
              <ThreadPanel
                parentMessageId={openThread.parentMessageId}
                messageTable={openThread.messageTable}
                channelId={openThread.channelId}
                conversationId={openThread.conversationId}
                contextName={openThread.contextName}
                onClose={closeThreadPanel}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
