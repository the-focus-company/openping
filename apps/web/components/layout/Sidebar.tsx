"use client";

import { useState, useMemo, useContext, useCallback, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  Inbox,
  Mail,
  Plus,
  Users,
  GitBranch,
  BarChart2,
  Settings,
  User,
  Building2,
  Keyboard,
  LogOut,
  Lock,
  Key,
  ArrowLeft,
  PanelLeftClose,
  Check,
  Sparkles,
  Bot,
  Star,
} from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { StatusDot } from "@/components/ui/status-dot";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { WorkspaceContext } from "@/components/workspace/WorkspaceProvider";
// Sidebar width is now controlled by parent via style

interface NavItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
  kbd?: string;
  isActive: boolean;
}

function NavItem({ href, icon: Icon, label, badge, kbd, isActive }: NavItemProps) {
  return (
    <Link
      href={href}
      data-nav-item
      tabIndex={-1}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex h-7 items-center gap-2 rounded px-2 text-sm",
        "transition-colors duration-100",
        isActive
          ? "bg-ping-purple-muted text-foreground before:absolute before:left-0 before:top-1/2 before:h-4 before:-translate-y-1/2 before:w-0.5 before:rounded-r before:bg-ping-purple"
          : "text-muted-foreground hover:bg-surface-3 hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 truncate">{label}</span>

      {badge != null && badge > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-ping-purple px-1 text-2xs font-medium text-white tabular-nums">
          {badge > 99 ? "99+" : badge}
        </span>
      )}

      {kbd && !badge && (
        <Kbd className="opacity-0 transition-opacity group-hover:opacity-100">{kbd}</Kbd>
      )}
    </Link>
  );
}

interface SectionHeaderProps {
  label: string;
  action?: React.ReactNode;
  href?: string;
}

function SectionHeader({ label, action, href }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between px-2 pb-0.5 pt-4">
      {href ? (
        <Link
          href={href}
          tabIndex={-1}
          className="text-2xs font-medium uppercase tracking-widest text-foreground/50 transition-colors hover:text-foreground/70"
        >
          {label}
        </Link>
      ) : (
        <span className="text-2xs font-medium uppercase tracking-widest text-foreground/50">
          {label}
        </span>
      )}
      {action}
    </div>
  );
}

interface SidebarProps {
  isSettingsRoute?: boolean;
  onOpenShortcuts?: () => void;
  onCollapse?: () => void;
}

export function Sidebar({ isSettingsRoute, onOpenShortcuts, onCollapse }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const wsCtx = useContext(WorkspaceContext);
  const isAdmin = wsCtx?.role === "admin";
  const isGuest = wsCtx?.role === "guest";

  const workspaceSlug = pathname.match(/^\/app\/([^/]+)/)?.[1];
  const workspacePrefix = workspaceSlug ? `/app/${workspaceSlug}` : "";
  const buildPath = (p: string) => `${workspacePrefix}${p.startsWith("/") ? p : `/${p}`}`;

  const { isAuthenticated } = useConvexAuth();
  const workspace = useQuery(api.workspaces.getBySlug, isAuthenticated && workspaceSlug ? { slug: workspaceSlug } : "skip");
  const workspaceId = workspace?._id;

  const allWorkspaces = useQuery(api.workspaces.listForUser, isAuthenticated ? {} : "skip");
  const channels = useQuery(api.channels.list, isAuthenticated && workspaceId ? { workspaceId } : "skip");
  const inboxUnread = useQuery(api.inboxItems.unreadCount, isAuthenticated ? {} : "skip");
  const emailUnread = useQuery(api.emails.unreadCount, isAuthenticated ? {} : "skip");
  const dmConversations = useQuery(api.directConversations.list, isAuthenticated ? {} : "skip");
  const user = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");
  const onlineUsers = useQuery(api.presence.getOnlineUsers, isAuthenticated && workspaceId ? { workspaceId } : "skip");
  const onlineUserIds = useMemo(
    () => new Set(onlineUsers?.map((u) => u._id)),
    [onlineUsers],
  );
  const createChannel = useMutation(api.channels.create);
  const toggleStar = useMutation(api.channels.toggleStar);

  const [addChannelOpen, setAddChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [dmUserSearch, setDmUserSearch] = useState("");
  const allUsers = useQuery(api.users.listAll, isAuthenticated && workspaceId ? { workspaceId } : "skip");
  const createConversation = useMutation(api.directConversations.create);

  const handleCreateChannel = async () => {
    const name = newChannelName.trim().toLowerCase().replace(/\s+/g, "-");
    if (!name) return;
    if (!workspaceId) return;
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

  const userInitial = user?.name?.[0]?.toUpperCase() ?? "U";
  const userName = user?.name ?? "User";
  const userEmail = user?.email ?? "user@company.com";

  const navRef = useRef<HTMLElement>(null);

  const handleNavKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "Home" && e.key !== "End") return;
    const nav = navRef.current;
    if (!nav) return;
    const items = Array.from(nav.querySelectorAll<HTMLElement>("[data-nav-item]"));
    if (items.length === 0) return;
    const current = document.activeElement as HTMLElement;
    const idx = items.indexOf(current);
    let next: number;
    if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = items.length - 1;
    } else if (e.key === "ArrowDown") {
      next = idx < items.length - 1 ? idx + 1 : 0;
    } else {
      next = idx > 0 ? idx - 1 : items.length - 1;
    }
    e.preventDefault();
    items[next].focus();
  }, []);

  // Keep the active route item as the roving tab target
  const activeNavRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const items = Array.from(nav.querySelectorAll<HTMLElement>("[data-nav-item]"));
    const active = items.find((el) => el.getAttribute("aria-current") === "page") ?? items[0];
    items.forEach((el) => { el.tabIndex = el === active ? 0 : -1; });
    activeNavRef.current = active ?? null;
  }, [pathname, channels, dmConversations, isSettingsRoute]);

  const handleNavFocus = useCallback((e: React.FocusEvent) => {
    const nav = navRef.current;
    if (!nav) return;
    const target = e.target as HTMLElement;
    if (!target.hasAttribute("data-nav-item")) return;
    // Update roving tabindex
    const items = Array.from(nav.querySelectorAll<HTMLElement>("[data-nav-item]"));
    items.forEach((el) => { el.tabIndex = el === target ? 0 : -1; });
  }, []);

  return (
    <div
      className="flex h-full flex-col border-r border-subtle bg-surface-1 w-full"
    >
      {/* Navigation */}
      <nav
        ref={navRef}
        aria-label="Workspace navigation"
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2 scrollbar-thin"
        onKeyDown={handleNavKeyDown}
        onFocus={handleNavFocus}
      >
        {isSettingsRoute ? (
          <SettingsNav pathname={pathname} buildPath={buildPath} user={user} />
        ) : (
          <MainNav
            pathname={pathname}
            buildPath={buildPath}
            inboxUnread={inboxUnread}
            emailUnread={emailUnread}
            dmConversations={dmConversations}
            channels={channels}
            user={user}
            onlineUserIds={onlineUserIds}
            isGuest={isGuest}
            onNewDm={() => router.push(buildPath("/dms?new=1"))}
            onNewChannel={() => router.push(buildPath("/channels?new=1"))}
            onToggleStar={(channelId) => toggleStar({ channelId: channelId as Id<"channels"> })}
          />
        )}
      </nav>

      {/* User row */}
      <div className="border-t border-subtle px-2 py-2">
        <div className="group/row flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-8 flex-1 min-w-0 items-center gap-2 rounded px-2 transition-colors hover:bg-surface-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ping-purple text-2xs font-medium text-white">
                  {userInitial}
                </div>
                <span className="flex-1 truncate text-left text-sm text-muted-foreground group-hover/row:text-foreground">
                  {userName}
                </span>
              </button>
            </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56 bg-surface-2 border-subtle">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-foreground">{userName}</p>
              <p className="text-2xs text-muted-foreground">{userEmail}</p>
            </div>
            <DropdownMenuSeparator className="bg-foreground/5" />
            <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => router.push(buildPath("/settings/profile"))}>
              <User className="mr-2 h-3 w-3" />
              Profile
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => router.push(buildPath("/settings/team"))}>
                <Users className="mr-2 h-3 w-3" />
                Team
              </DropdownMenuItem>
            )}
            {isAdmin && (
              <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => router.push(buildPath("/settings/workspace"))}>
                <Settings className="mr-2 h-3 w-3" />
                Settings
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-foreground/5" />

            {/* Workspaces */}
            <div className="px-2 py-1">
              <span className="text-2xs font-medium uppercase tracking-widest text-foreground/50">Workspaces</span>
            </div>
            {allWorkspaces?.map((ws) => (
              <DropdownMenuItem
                key={ws._id}
                className="cursor-pointer text-xs"
                onClick={() => router.push(`/app/${ws.slug}/inbox`)}
              >
                <Building2 className="mr-2 h-3 w-3" />
                <span className="flex-1 truncate">{ws.name}</span>
                {ws._id === workspaceId && <Check className="ml-2 h-3 w-3 text-ping-purple" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem className="cursor-pointer text-xs" onClick={() => router.push("/onboarding")}>
              <Plus className="mr-2 h-3 w-3" />
              Add workspace
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-foreground/5" />
            <DropdownMenuItem className="cursor-pointer text-xs" onClick={onOpenShortcuts}>
              <Keyboard className="mr-2 h-3 w-3" />
              Keyboard shortcuts
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-foreground/5" />
            <DropdownMenuItem
              className="cursor-pointer text-xs text-destructive focus:text-destructive"
              onClick={() => (window.location.href = "/sign-out")}
            >
              <LogOut className="mr-2 h-3 w-3" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
          </DropdownMenu>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              aria-label="Collapse sidebar (⌘B)"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-all hover:bg-surface-3 hover:text-foreground group-hover/row:opacity-100 focus-visible:opacity-100"
              title="Collapse sidebar (⌘B)"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* New DM quick picker */}
      <Dialog open={newDmOpen} onOpenChange={setNewDmOpen}>
        <DialogContent className="border-subtle bg-surface-2 sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">New direct message</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            <input
              value={dmUserSearch}
              onChange={(e) => setDmUserSearch(e.target.value)}
              placeholder="Search people..."
              autoFocus
              className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/40 focus:border-ring focus:outline-none"
            />
            <div className="max-h-52 space-y-0.5 overflow-y-auto scrollbar-thin">
              {(allUsers ?? [])
                .filter(
                  (u) =>
                    u._id !== user?._id &&
                    u.name.toLowerCase().includes(dmUserSearch.toLowerCase()),
                )
                .sort((a, b) => {
                  if (a.isAgent && !b.isAgent) return -1;
                  if (!a.isAgent && b.isAgent) return 1;
                  return a.name.localeCompare(b.name);
                })
                .map((u) => (
                  <button
                    key={u._id}
                    onClick={async () => {
                      if (!workspaceId) return;
                      const id = await createConversation({
                        workspaceId,
                        kind: u.isAgent ? "agent_1to1" : "1to1",
                        memberIds: u.isAgent ? [] : [u._id],
                        agentMemberIds: u.isAgent ? [u._id] : undefined,
                      });
                      setNewDmOpen(false);
                      router.push(buildPath(`/dm/${id}`));
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-surface-3"
                  >
                    {u.isAgent ? (
                      <div
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${u.agentColor ?? "#5E6AD2"}20` }}
                      >
                        <Bot className="h-3 w-3" style={{ color: u.agentColor ?? "#5E6AD2" }} />
                      </div>
                    ) : (
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-2xs font-medium">
                        {u.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="flex-1 truncate">{u.name}</span>
                    {u.isAgent ? (
                      <span className="text-2xs text-ping-purple/60">Agent</span>
                    ) : (
                      <span className="text-2xs text-muted-foreground">{u.email}</span>
                    )}
                  </button>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Channel Dialog */}
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
                className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/40 focus:border-ring focus:outline-none"
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

/* ─── Main navigation (non-settings) ─── */

interface MainNavProps {
  pathname: string;
  buildPath: (p: string) => string;
  inboxUnread: number | null | undefined;
  emailUnread: number | null | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dmConversations: any[] | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  channels: any[] | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  onlineUserIds: Set<string>;
  isGuest?: boolean;
  onNewDm: () => void;
  onNewChannel: () => void;
  onToggleStar: (channelId: string) => void;
}

function ConvLink({
  conv,
  user,
  onlineUserIds,
  pathname,
  buildPath,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conv: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  onlineUserIds: Set<string>;
  pathname: string;
  buildPath: (p: string) => string;
}) {
  const otherMembers = conv.members.filter(
    (m: { userId: string }) => m.userId !== user?._id,
  );
  const displayName =
    conv.name || otherMembers.map((m: { name: string }) => m.name).join(", ") || "DM";
  const isActive = pathname.endsWith(`/dm/${conv._id}`);

  let ConvIcon: React.ReactNode;
  if (conv.kind === "agent_group") {
    ConvIcon = (
      <div className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        <Users className="h-3.5 w-3.5 text-foreground/50" />
        <Sparkles className="absolute -right-1.5 -top-1 h-2 w-2 text-ping-purple" />
      </div>
    );
  } else if (conv.kind === "agent_1to1") {
    ConvIcon = (
      <div className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        <User className="h-3.5 w-3.5 text-foreground/50" />
        <Sparkles className="absolute -right-1.5 -top-1 h-2 w-2 text-ping-purple" />
      </div>
    );
  } else if (conv.kind === "group") {
    ConvIcon = <Users className="h-3.5 w-3.5 shrink-0 text-foreground/50" />;
  } else {
    ConvIcon = <User className="h-3.5 w-3.5 shrink-0 text-foreground/50" />;
  }

  return (
    <Link
      href={buildPath(`/dm/${conv._id}`)}
      data-nav-item
      tabIndex={-1}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex h-7 items-center gap-2 rounded px-2 text-sm",
        "transition-colors duration-100",
        isActive
          ? "bg-ping-purple-muted text-foreground before:absolute before:left-0 before:top-1/2 before:h-4 before:-translate-y-1/2 before:w-0.5 before:rounded-r before:bg-ping-purple"
          : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
      )}
    >
      {ConvIcon}
      <StatusDot
        variant={otherMembers.some((m: { userId: string }) => onlineUserIds.has(m.userId)) ? "online" : "offline"}
        size="xs"
      />
      <span className="flex-1 truncate">{displayName}</span>
      {conv.unreadCount > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-ping-purple px-1 text-2xs font-medium text-white tabular-nums">
          {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
        </span>
      )}
    </Link>
  );
}

function MainNav({
  pathname,
  buildPath,
  inboxUnread,
  emailUnread,
  dmConversations,
  channels,
  user,
  onlineUserIds,
  isGuest,
  onNewDm,
  onNewChannel,
  onToggleStar,
}: MainNavProps) {
  // Combine inbox unread + email unread for the Decision Inbox badge
  const totalInboxUnread = (inboxUnread ?? 0) + (emailUnread ?? 0);

  // Filter channels for guests (only show assigned channels)
  const visibleChannels = useMemo(() => {
    if (!channels) return undefined;
    return isGuest ? channels.filter((c) => c.isMember) : channels;
  }, [channels, isGuest]);

  // Sort channels: starred first, then alphabetical
  const sortedChannels = useMemo(() => {
    if (!visibleChannels) return undefined;
    return [...visibleChannels].sort((a, b) => {
      if (a.isStarred && !b.isStarred) return -1;
      if (!a.isStarred && b.isStarred) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [visibleChannels]);

  return (
    <>
      {/* My Deck */}
      <NavItem
        href={buildPath("/inbox")}
        icon={Inbox}
        label="My Deck"
        badge={totalInboxUnread}
        kbd="G I"
        isActive={pathname.endsWith("/inbox")}
      />

      {/* Communication */}
      <SectionHeader
        label="Communication"
        href={buildPath("/dms")}
        action={
          <button
            onClick={onNewDm}
            tabIndex={-1}
            className="rounded p-0.5 text-foreground/50 transition-colors hover:bg-surface-3 hover:text-foreground/80"
            title="New message"
            aria-label="New message"
          >
            <Plus className="h-3 w-3" />
          </button>
        }
      />

      {dmConversations &&
        dmConversations.slice(0, 8).map((conv) => (
          <ConvLink
            key={conv._id}
            conv={conv}
            user={user}
            onlineUserIds={onlineUserIds}
            pathname={pathname}
            buildPath={buildPath}
          />
        ))}

      {/* Channels */}
      <SectionHeader
        label="Channels"
        href={buildPath("/channels")}
        action={
          !isGuest ? (
            <button
              onClick={onNewChannel}
              tabIndex={-1}
              className="rounded p-0.5 text-foreground/50 transition-colors hover:bg-surface-3 hover:text-foreground/80"
              aria-label="New channel"
            >
              <Plus className="h-3 w-3" />
            </button>
          ) : undefined
        }
      />

      {sortedChannels === undefined ? (
        <>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex h-7 items-center gap-2 rounded px-2">
              <div className="h-3 w-3 rounded bg-foreground/8" />
              <div className="h-3 flex-1 rounded bg-foreground/8" />
            </div>
          ))}
        </>
      ) : (
        sortedChannels.map((channel) => {
          const isActive = pathname.endsWith(`/channel/${channel._id}`);
          return (
            <Link
              key={channel._id}
              href={buildPath(`/channel/${channel._id}`)}
              data-nav-item
              tabIndex={-1}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group/ch relative flex h-7 items-center gap-2 rounded px-2 text-sm",
                "transition-colors duration-100",
                isActive
                  ? "bg-ping-purple-muted text-foreground before:absolute before:left-0 before:top-1/2 before:h-4 before:-translate-y-1/2 before:w-0.5 before:rounded-r before:bg-ping-purple"
                  : "text-muted-foreground hover:bg-surface-3 hover:text-foreground"
              )}
            >
              <span className="flex h-3 w-3 shrink-0 items-center justify-center">
                {channel.isPrivate ? (
                  <Lock className="h-3 w-3 text-foreground/50" />
                ) : (
                  <span className="text-2xs font-medium text-foreground/50">#</span>
                )}
              </span>
              <span className={cn("flex-1 truncate", channel.unreadCount > 0 && "font-semibold text-foreground")}>{channel.name}</span>
              {channel.isMember && (
                <Star
                  className={cn(
                    "h-3 w-3 shrink-0 cursor-pointer transition-opacity",
                    channel.isStarred
                      ? "fill-yellow-400 text-yellow-400 opacity-100"
                      : "text-foreground/40 opacity-0 group-hover/ch:opacity-100",
                  )}
                  tabIndex={-1}
                  aria-label={channel.isStarred ? "Unstar channel" : "Star channel"}
                  onClick={(e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); onToggleStar(channel._id); }}
                />
              )}
              {/* Mention count badge — only when user is mentioned */}
              {channel.unreadMentionCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-ping-purple px-1 text-2xs font-medium text-white tabular-nums">
                  {channel.unreadMentionCount > 99 ? "99+" : channel.unreadMentionCount}
                </span>
              )}
            </Link>
          );
        })
      )}
    </>
  );
}

/* ─── Settings navigation ─── */

interface SettingsNavProps {
  pathname: string;
  buildPath: (p: string) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
}

function SettingsNav({ pathname, buildPath }: SettingsNavProps) {
  const router = useRouter();
  const wsCtx = useContext(WorkspaceContext);
  const isAdmin = wsCtx?.role === "admin";
  const isGuest = wsCtx?.role === "guest";

  return (
    <>
      <button
        data-nav-item
        tabIndex={-1}
        onClick={() => router.push(buildPath("/inbox"))}
        className="flex h-7 items-center gap-2 rounded px-2 text-sm text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back</span>
      </button>

      <div className="h-px bg-foreground/5 mx-0 my-2" />

      <NavItem href={buildPath("/settings/profile")} icon={User} label="Profile" isActive={pathname.endsWith("/settings/profile")} />
      {isAdmin && <NavItem href={buildPath("/settings/workspace")} icon={Building2} label="Workspace" isActive={pathname.endsWith("/settings/workspace")} />}
      {isAdmin && <NavItem href={buildPath("/settings/team")} icon={Users} label="Team" isActive={pathname.endsWith("/settings/team")} />}
      {isAdmin && <NavItem href={buildPath("/settings/agents")} icon={Bot} label="Agents" isActive={pathname.endsWith("/settings/agents")} />}
      {!isGuest && <NavItem href={buildPath("/settings/knowledge-graph")} icon={GitBranch} label="Knowledge Graph" isActive={pathname.endsWith("/settings/knowledge-graph")} />}
      {!isGuest && <NavItem href={buildPath("/settings/email")} icon={Mail} label="Email" isActive={pathname.endsWith("/settings/email")} />}
      {!isGuest && <NavItem href={buildPath("/settings/api-keys")} icon={Key} label="API Keys" isActive={pathname.endsWith("/settings/api-keys")} />}
      {isAdmin && <NavItem href={buildPath("/settings/analytics")} icon={BarChart2} label="Analytics" isActive={pathname.endsWith("/settings/analytics")} />}

      {isAdmin && (
        <>
          <div className="h-px bg-foreground/5 mx-0 my-2" />
          <NavItem href="/admin" icon={Settings} label="Backoffice" isActive={pathname.startsWith("/admin")} />
        </>
      )}
    </>
  );
}
