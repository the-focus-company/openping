"use client";

import { ReactNode, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useToast } from "@/components/ui/toast-provider";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { TopBarProvider } from "./TopBarContext";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { ThemeToggle } from "./ThemeToggle";
import { PanelLeftOpen } from "lucide-react";
import { SIDEBAR_WIDTH_DEFAULT, SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX, TOPBAR_HEIGHT, THREAD_PANEL_WIDTH_DEFAULT, THREAD_PANEL_WIDTH_MIN, THREAD_PANEL_WIDTH_MAX } from "@/lib/constants";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { ThreadPanelProvider, useThreadPanel } from "@/hooks/useThreadPanel";
import { SidebarContext } from "@/hooks/useSidebar";
import { ThreadPanel } from "@/components/channel/ThreadPanel";
import { WorkspaceContext } from "@/components/workspace/WorkspaceProvider";

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
  const [threadPanelWidth, setThreadPanelWidth] = useState(THREAD_PANEL_WIDTH_DEFAULT);
  const isResizingThreadRef = useRef(false);
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
  const myWorkspaces = useQuery(api.workspaceMembers.listMyWorkspaces, isAuthenticated ? {} : "skip");
  const myRole = myWorkspaces?.find((w) => w.workspaceId === workspaceId)?.role ?? null;
  const conversations = useQuery(api.conversations.list, isAuthenticated && workspaceId ? { workspaceId } : "skip");
  const inboxUnread = useQuery(api.inboxItems.unreadCount, isAuthenticated ? {} : "skip");
  const markRead = useMutation(api.conversations.markRead);
  const { toast } = useToast();
  const startMeeting = useMutation(api.meetings.startInConversation);
  const conversationIdFromPath = pathname.match(/\/c\/([^/]+)$/)?.[1] as Id<"conversations"> | undefined;
  const activeMeeting = useQuery(
    api.meetings.getActiveMeeting,
    isAuthenticated && conversationIdFromPath
      ? { conversationId: conversationIdFromPath }
      : "skip",
  );

  const handleStartMeeting = useCallback(async () => {
    if (conversationIdFromPath) {
      if (activeMeeting) {
        window.open(activeMeeting.meetingUrl, "_blank");
      } else {
        const result = await startMeeting({ conversationId: conversationIdFromPath });
        window.open(result.meetingUrl, "_blank");
      }
    } else {
      toast("Navigate to a conversation to start a meeting");
    }
  }, [conversationIdFromPath, activeMeeting, startMeeting, toast]);

  // Ordered list of navigable sidebar items for Alt+Arrow shortcuts
  const navItems = useMemo(() => {
    if (!workspacePrefix) return [];
    const items: Array<{ path: string; unread: number }> = [
      { path: `${workspacePrefix}/inbox`, unread: inboxUnread ?? 0 },
    ];
    if (conversations) {
      for (const conv of conversations) {
        items.push({ path: `${workspacePrefix}/c/${conv._id}`, unread: conv.unreadCount ?? 0 });
      }
    }
    return items;
  }, [workspacePrefix, conversations, inboxUnread]);

  const isSettingsRoute = pathname.includes("/settings/");

  useEffect(() => {
    const conversationUnread = conversations?.reduce((sum, conv) => sum + (conv.unreadCount ?? 0), 0) ?? 0;
    const inbox = inboxUnread ?? 0;
    const total = conversationUnread + inbox;
    document.title = total > 0 ? `(${total}) OpenPing` : "OpenPing";
    return () => {
      document.title = "OpenPing";
    };
  }, [conversations, inboxUnread]);

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

  const handleThreadResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingThreadRef.current = true;
    const startX = e.clientX;
    const startWidth = threadPanelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      const maxWidth = Math.min(THREAD_PANEL_WIDTH_MAX, window.innerWidth * 0.5);
      const newWidth = Math.min(maxWidth, Math.max(THREAD_PANEL_WIDTH_MIN, startWidth - (ev.clientX - startX)));
      setThreadPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizingThreadRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [threadPanelWidth]);

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
      // ⌘⇧M — start meeting
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        handleStartMeeting();
        return;
      }

      // Alt+Arrow — navigate between conversations in sidebar order
      // Alt+Shift+Arrow — navigate between unread conversations only
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

      // Shift+Escape — mark current conversation as read
      if (e.key === "Escape" && e.shiftKey) {
        const convMatch = pathname.match(/\/c\/([^/]+)$/);
        if (convMatch) {
          markRead({ conversationId: convMatch[1] as Id<"conversations"> });
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
        if (key === "c" && conversations?.[0]) {
          e.preventDefault();
          router.push(`${workspacePrefix}/c/${conversations[0]._id}`);
          return;
        }
        if (key === "d") {
          e.preventDefault();
          router.push(`${workspacePrefix}/conversations`);
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
  }, [toggleSidebar, clearChord, router, workspacePrefix, pathname, navItems, conversations, markRead, toast, handleStartMeeting]);

  return (
    <SidebarContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
    <ThreadPanelProvider>
      <TopBarProvider>
        <div className="flex h-screen flex-col overflow-hidden bg-background">
          {/* Skip link for keyboard users */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-ping-purple focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg"
          >
            Skip to content
          </a>

          {/* TopBar — full width, always on top */}
          <TopBar
            onToggleSidebar={toggleSidebar}
            onOpenSearch={openSearch}
            trailing={<ThemeToggle />}
            workspaceName={workspace?.name}
          />

          {/* Below topbar: sidebar + content */}
          <div className="flex min-w-0 flex-1 overflow-hidden">
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
              <aside className="h-full relative" style={{ width: sidebarWidth }} role="navigation" aria-label="Sidebar">
                <Sidebar
                  isSettingsRoute={isSettingsRoute}
                  onOpenShortcuts={openShortcuts}
                  onCollapse={toggleSidebar}
                  role={myRole}
                />
                {/* Right-edge inset shadow for depth */}
                <div className="pointer-events-none absolute inset-y-0 right-0 w-[1px] bg-border" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-4 shadow-[inset_-8px_0_12px_-8px_rgba(94,106,210,0.1)] dark:shadow-[inset_-8px_0_12px_-8px_rgba(0,0,0,0.3)]" />
              </aside>
            </div>

            {/* Resize handle (desktop only) */}
            {sidebarOpen && (
              <div
                className="hidden md:flex shrink-0 w-0 cursor-col-resize items-center justify-center relative z-10 after:absolute after:inset-y-0 after:-left-1 after:w-2 after:transition-colors hover:after:bg-ping-purple/20 active:after:bg-ping-purple/30"
                onMouseDown={handleResizeStart}
                onDoubleClick={() => setSidebarWidth(SIDEBAR_WIDTH_DEFAULT)}
              />
            )}

            {/* Mobile sidebar — slides in as overlay */}
            <aside
              role="navigation"
              aria-label="Sidebar"
              className={`fixed top-[--topbar-h] z-30 h-[calc(100vh-var(--topbar-h))] transition-transform duration-200 ease-out md:hidden ${
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
              }`}
              style={{ width: sidebarWidth, "--topbar-h": `${TOPBAR_HEIGHT}px` } as React.CSSProperties}
            >
              <Sidebar
                isSettingsRoute={isSettingsRoute}
                onOpenShortcuts={openShortcuts}
                role={myRole}
              />
            </aside>

            {/* Main content + Thread panel */}
            <div className="flex min-w-0 flex-1 overflow-hidden">
              <main id="main-content" className="min-w-0 flex-1 overflow-y-auto">{children}</main>
              <ThreadPanelSlot
                threadPanelWidth={threadPanelWidth}
                setThreadPanelWidth={setThreadPanelWidth}
                handleThreadResizeStart={handleThreadResizeStart}
              />
            </div>
          </div>

          {/* Show sidebar button (bottom-left, visible when sidebar is hidden on desktop) */}
          {!sidebarOpen && (
            <button
              onClick={toggleSidebar}
              aria-label="Show sidebar (⌘B)"
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
            onStartMeeting={handleStartMeeting}
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

function ThreadPanelSlot({
  threadPanelWidth,
  setThreadPanelWidth,
  handleThreadResizeStart,
}: {
  threadPanelWidth: number;
  setThreadPanelWidth: (w: number) => void;
  handleThreadResizeStart: (e: React.MouseEvent) => void;
}) {
  const { openThread, closeThreadPanel } = useThreadPanel();
  const workspaceCtxValue = useMemo(() => {
    if (!openThread?.workspaceId) return null;
    return {
      workspaceId: openThread.workspaceId as Id<"workspaces">,
      workspaceSlug: "",
      workspaceName: "",
      role: "member" as const,
      isSubdomain: false,
      buildPath: (path: string) => path,
    };
  }, [openThread?.workspaceId]);

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

  const threadContent = openThread ? (
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
          conversationId={openThread.conversationId}
          contextName={openThread.contextName}
          onClose={closeThreadPanel}
        />
      </motion.aside>

      {/* Desktop: width animation so conversation resizes smoothly */}
      <motion.div
        key="thread-desktop"
        initial={{ width: 0 }}
        animate={{ width: threadPanelWidth }}
        exit={{ width: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="hidden h-full overflow-hidden md:flex"
      >
        {/* Resize handle (left edge of thread panel) */}
        <div
          className="shrink-0 w-0 cursor-col-resize flex items-center justify-center relative z-10 after:absolute after:inset-y-0 after:-right-1 after:w-2 after:transition-colors hover:after:bg-ping-purple/20 active:after:bg-ping-purple/30"
          onMouseDown={handleThreadResizeStart}
          onDoubleClick={() => setThreadPanelWidth(THREAD_PANEL_WIDTH_DEFAULT)}
        />
        <div className="h-full flex-1 overflow-hidden border-l border-subtle">
          <div className="h-full" style={{ width: threadPanelWidth }}>
            <ThreadPanel
              parentMessageId={openThread.parentMessageId}
              conversationId={openThread.conversationId}
              contextName={openThread.contextName}
              onClose={closeThreadPanel}
            />
          </div>
        </div>
      </motion.div>
    </>
  ) : null;

  return (
    <AnimatePresence>
      {threadContent && (
        workspaceCtxValue ? (
          <WorkspaceContext.Provider value={workspaceCtxValue}>
            {threadContent}
          </WorkspaceContext.Provider>
        ) : threadContent
      )}
    </AnimatePresence>
  );
}
