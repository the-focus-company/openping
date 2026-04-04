"use client";

import { useState, useMemo, useContext, useCallback, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
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
  ArrowLeft,
  PanelLeftClose,
  Check,
  Bot,
  Key,
} from "lucide-react";
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
import { useSidebarLayout } from "@/hooks/useSidebarLayout";
import type { SortMode } from "@/hooks/useSidebarLayout";
import { MyDeckButton } from "./sidebar/MyDeckButton";
import { SidebarSection } from "./sidebar/SidebarSection";
import { SidebarDndProvider } from "./sidebar/SidebarDndProvider";
import { CreateSectionDialog } from "./sidebar/CreateSectionDialog";
import { RenameSectionDialog } from "./sidebar/RenameSectionDialog";

interface NavItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
  isActive: boolean;
}

function NavItem({ href, icon: Icon, label, badge, isActive }: NavItemProps) {
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
          : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-ping-purple px-1 text-2xs font-medium text-white tabular-nums">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

interface SidebarProps {
  isSettingsRoute?: boolean;
  onOpenShortcuts?: () => void;
  onCollapse?: () => void;
  role?: "admin" | "member" | "guest" | null;
}

export function Sidebar({ isSettingsRoute, onOpenShortcuts, onCollapse, role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const wsCtx = useContext(WorkspaceContext);
  const isAdmin = role === "admin" || wsCtx?.role === "admin";
  const workspaceSlug = pathname.match(/^\/app\/([^/]+)/)?.[1];
  const workspacePrefix = workspaceSlug ? `/app/${workspaceSlug}` : "";
  const buildPath = useCallback(
    (p: string) => `${workspacePrefix}${p.startsWith("/") ? p : `/${p}`}`,
    [workspacePrefix],
  );

  const { isAuthenticated } = useConvexAuth();
  const workspace = useQuery(
    api.workspaces.getBySlug,
    isAuthenticated && workspaceSlug ? { slug: workspaceSlug } : "skip",
  );
  const workspaceId = workspace?._id;

  const allWorkspaces = useQuery(
    api.workspaces.listForUser,
    isAuthenticated ? {} : "skip",
  );
  const inboxUnread = useQuery(
    api.inboxItems.unreadCount,
    isAuthenticated ? {} : "skip",
  );
  const emailUnread = useQuery(
    api.emails.unreadCount,
    isAuthenticated ? {} : "skip",
  );
  const user = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");
  const onlineUsers = useQuery(
    api.presence.getOnlineUsers,
    isAuthenticated && workspaceId ? { workspaceId } : "skip",
  );
  const onlineUserIds = useMemo(
    () => new Set<string>(onlineUsers?.map((u) => u._id)),
    [onlineUsers],
  );

  // Sidebar layout hook
  const sidebarLayout = useSidebarLayout(
    workspaceId,
    isAuthenticated,
    pathname,
    buildPath,
  );

  // Mutations
  const createConversation = useMutation(api.conversations.create);
  const toggleStarConversation = useMutation(api.conversations.toggleStar);
  const setSectionSortModeMut = useMutation(api.sidebarLayout.setSectionSortMode);
  const createSectionMut = useMutation(api.sidebarLayout.createSection);
  const renameSectionMut = useMutation(api.sidebarLayout.renameSection);
  const deleteSectionMut = useMutation(api.sidebarLayout.deleteSection);
  const toggleCollapseMut = useMutation(api.sidebarLayout.toggleSectionCollapse);
  const moveItemToSectionMut = useMutation(api.sidebarLayout.moveItemToSection);
  const bakeOrderMut = useMutation(api.sidebarLayout.bakeCurrentOrder);

  // Dialog state
  const [newConvoOpen, setNewConvoOpen] = useState(false);
  const [newConvoSearch, setNewConvoSearch] = useState("");
  const [newConvoSelected, setNewConvoSelected] = useState<string[]>([]);
  const [newConvoName, setNewConvoName] = useState("");
  const [newConvoVisibility, setNewConvoVisibility] = useState<"auto" | "public" | "secret" | "secret_can_be_public">("auto");
  const [createSectionOpen, setCreateSectionOpen] = useState(false);
  const [renameSectionId, setRenameSectionId] = useState<string | null>(null);

  const allUsers = useQuery(
    api.users.listAll,
    isAuthenticated && workspaceId ? { workspaceId } : "skip",
  );

  // Derive conversation kind and visibility from selected members
  const newConvoSelectedUsers = useMemo(
    () => (allUsers ?? []).filter((u) => newConvoSelected.includes(u._id)),
    [allUsers, newConvoSelected],
  );
  const hasAgent = newConvoSelectedUsers.some((u) => u.isAgent);
  const isSmallGroup = newConvoSelected.length <= 1; // 1 other person = 2 total (creator + 1)
  const derivedKind = useMemo(() => {
    if (hasAgent && isSmallGroup) return "agent_1to1" as const;
    if (hasAgent && !isSmallGroup) return "agent_group" as const;
    if (isSmallGroup) return "1to1" as const;
    return "group" as const;
  }, [hasAgent, isSmallGroup]);
  const derivedVisibility = useMemo(() => {
    if (newConvoVisibility !== "auto") return newConvoVisibility;
    // 2 people (or 2 + agent) → secret; 3+ → public
    return isSmallGroup ? "secret" as const : "public" as const;
  }, [newConvoVisibility, isSmallGroup]);

  const handleCreateConversation = async () => {
    if (!workspaceId || newConvoSelected.length === 0) return;
    try {
      const humanIds = newConvoSelectedUsers.filter((u) => !u.isAgent).map((u) => u._id as Id<"users">);
      const agentIds = newConvoSelectedUsers.filter((u) => u.isAgent).map((u) => u._id as Id<"users">);
      const name = newConvoName.trim().toLowerCase().replace(/\s+/g, "-") || undefined;
      const conversationId = await createConversation({
        workspaceId,
        kind: derivedKind,
        name: !isSmallGroup ? name : undefined,
        visibility: derivedVisibility,
        memberIds: humanIds.length > 0 ? humanIds : [],
        agentMemberIds: agentIds.length > 0 ? agentIds : undefined,
      });
      setNewConvoOpen(false);
      setNewConvoSelected([]);
      setNewConvoSearch("");
      setNewConvoName("");
      setNewConvoVisibility("auto");
      router.push(buildPath(`/c/${conversationId}`));
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  };

  // Per-section sort mode change handler
  const handleSectionSortModeChange = async (sectionId: string, mode: SortMode) => {
    if (!workspaceId || sectionId === "__favorites__") return;

    const section = sidebarLayout.sections.find((s) => s.id === sectionId);
    if (!section) return;

    // When switching to custom mode, bake the current visible order for this section
    if (mode === "custom" && section.sortMode !== "custom") {
      const itemOrder: Array<{
        conversationId: Id<"conversations">;
        sectionId: Id<"sidebarSections">;
        sortOrder: number;
      }> = [];

      for (const s of sidebarLayout.sections) {
        if (s.isFavorites) continue;
        for (let i = 0; i < s.items.length; i++) {
          const item = s.items[i];
          itemOrder.push({
            conversationId: item.id as Id<"conversations">,
            sectionId: s.id as Id<"sidebarSections">,
            sortOrder: i,
          });
        }
      }

      await bakeOrderMut({ workspaceId, itemOrder });
    }

    await setSectionSortModeMut({
      sectionId: sectionId as Id<"sidebarSections">,
      sortMode: mode,
    });
  };

  // Section handlers
  const handleCreateSection = async (name: string) => {
    if (!workspaceId) return;
    await createSectionMut({ workspaceId, name });
  };

  const handleRenameSection = async (name: string) => {
    if (!renameSectionId) return;
    await renameSectionMut({
      sectionId: renameSectionId as Id<"sidebarSections">,
      name,
    });
    setRenameSectionId(null);
  };

  const handleDeleteSection = async (sectionId: string) => {
    await deleteSectionMut({
      sectionId: sectionId as Id<"sidebarSections">,
    });
  };

  const handleToggleCollapse = async (sectionId: string) => {
    if (sectionId === "__favorites__") return;
    await toggleCollapseMut({
      sectionId: sectionId as Id<"sidebarSections">,
    });
  };

  const handleMoveItemToSection = async (
    itemId: string,
    targetSectionId: string,
  ) => {
    if (!workspaceId) return;
    await moveItemToSectionMut({
      workspaceId,
      conversationId: itemId as Id<"conversations">,
      targetSectionId: targetSectionId as Id<"sidebarSections">,
    });
  };

  // DnD handlers
  const handleDndReorderItems = async (sectionId: string, itemIds: string[]) => {
    // Find which items have sidebarItemIds (are explicitly placed)
    const section = sidebarLayout.sections.find((s) => s.id === sectionId);
    if (!section) return;

    // We need to create sidebarItems for any items that don't have them,
    // then reorder all of them. For now, use bakeCurrentOrder for the section.
    if (!workspaceId) return;

    // Build new order for this section
    const itemOrder: Array<{
      conversationId: Id<"conversations">;
      sectionId: Id<"sidebarSections">;
      sortOrder: number;
    }> = [];

    // Items from all other sections stay the same
    for (const s of sidebarLayout.sections) {
      if (s.id === sectionId) {
        // Use the new order
        for (let i = 0; i < itemIds.length; i++) {
          const item = section.items.find((it) => it.id === itemIds[i]);
          if (item) {
            itemOrder.push({
              conversationId: item.id as Id<"conversations">,
              sectionId: s.id as Id<"sidebarSections">,
              sortOrder: i,
            });
          }
        }
      } else {
        // Keep existing order
        for (let i = 0; i < s.items.length; i++) {
          const item = s.items[i];
          itemOrder.push({
            conversationId: item.id as Id<"conversations">,
            sectionId: s.id as Id<"sidebarSections">,
            sortOrder: i,
          });
        }
      }
    }

    await bakeOrderMut({ workspaceId, itemOrder });
  };

  const handleDndMoveItem = async (
    itemId: string,
    toSectionId: string,
  ) => {
    await handleMoveItemToSection(itemId, toSectionId);
  };

  const userInitial = user?.name?.[0]?.toUpperCase() ?? "U";
  const userName = user?.name ?? "User";
  const userEmail = user?.email ?? "user@company.com";

  // Keyboard navigation
  const navRef = useRef<HTMLElement>(null);

  const handleNavKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (
      e.key !== "ArrowUp" &&
      e.key !== "ArrowDown" &&
      e.key !== "Home" &&
      e.key !== "End"
    )
      return;
    const nav = navRef.current;
    if (!nav) return;
    const items = Array.from(
      nav.querySelectorAll<HTMLElement>("[data-nav-item]"),
    );
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

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const items = Array.from(
      nav.querySelectorAll<HTMLElement>("[data-nav-item]"),
    );
    const active =
      items.find((el) => el.getAttribute("aria-current") === "page") ??
      items[0];
    items.forEach((el) => {
      el.tabIndex = el === active ? 0 : -1;
    });
  }, [pathname, sidebarLayout.sections, isSettingsRoute]);

  const handleNavFocus = useCallback((e: React.FocusEvent) => {
    const nav = navRef.current;
    if (!nav) return;
    const target = e.target as HTMLElement;
    if (!target.hasAttribute("data-nav-item")) return;
    const items = Array.from(
      nav.querySelectorAll<HTMLElement>("[data-nav-item]"),
    );
    items.forEach((el) => {
      el.tabIndex = el === target ? 0 : -1;
    });
  }, []);

  const totalInboxUnread = (inboxUnread ?? 0) + (emailUnread ?? 0);

  const renamingSection = sidebarLayout.sections.find(
    (s) => s.id === renameSectionId,
  );

  return (
    <div className="flex h-full flex-col border-r border-subtle bg-surface-1 w-full">
      {isSettingsRoute ? (
        <nav
          ref={navRef}
          aria-label="Workspace navigation"
          className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2 scrollbar-thin"
          onKeyDown={handleNavKeyDown}
          onFocus={handleNavFocus}
        >
          <SettingsNav pathname={pathname} buildPath={buildPath} role={role} />
        </nav>
      ) : (
        <>
          {/* My Deck — pinned top */}
          <div className="shrink-0 px-2 pt-2 pb-1">
            <MyDeckButton
              href={buildPath("/inbox")}
              badge={totalInboxUnread}
              isActive={pathname.endsWith("/inbox")}
            />
          </div>

          {/* Create conversation button */}
          <div className="shrink-0 px-2 pb-1">
            <button
              type="button"
              onClick={() => setNewConvoOpen(true)}
              className="flex w-full items-center gap-2 rounded px-2 h-7 text-xs font-medium text-foreground/50 transition-colors hover:bg-surface-3 hover:text-foreground/70"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New conversation</span>
            </button>
          </div>

          <div className="h-px bg-foreground/5 mx-2" />

          {/* Scrollable sections */}
          <nav
            ref={navRef}
            aria-label="Workspace navigation"
            className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-1 scrollbar-thin"
            onKeyDown={handleNavKeyDown}
            onFocus={handleNavFocus}
          >
            {sidebarLayout.isLoading ? (
              <>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex h-7 items-center gap-2 rounded px-2"
                  >
                    <div className="h-3 w-3 rounded bg-foreground/8" />
                    <div className="h-3 flex-1 rounded bg-foreground/8" />
                  </div>
                ))}
              </>
            ) : (
              <>
                <SidebarDndProvider
                  enabled={sidebarLayout.sections.some((s) => s.sortMode === "custom")}
                  sections={sidebarLayout.sections}
                  onReorderItems={handleDndReorderItems}
                  onMoveItemToSection={handleDndMoveItem}
                >
                  {sidebarLayout.sections.map((section) => (
                    <SidebarSection
                      key={section.id}
                      section={section}
                      onlineUserIds={onlineUserIds}
                      userId={user?._id}
                      buildPath={buildPath}
                      pathname={pathname}
                      allSections={sidebarLayout.sections}
                      onToggleCollapse={handleToggleCollapse}
                      onRename={(id) => setRenameSectionId(id)}
                      onDelete={handleDeleteSection}
                      onCreateSection={() => setCreateSectionOpen(true)}
                      onToggleStar={(itemId) => {
                        toggleStarConversation({ conversationId: itemId as Id<"conversations"> });
                      }}
                      onMoveItemToSection={handleMoveItemToSection}
                      onChangeSortMode={handleSectionSortModeChange}
                    />
                  ))}
                </SidebarDndProvider>

                {/* Add section — below all sections */}
                <button
                  onClick={() => setCreateSectionOpen(true)}
                  className="flex items-center gap-1 rounded px-2 py-1.5 mt-1 text-2xs text-foreground/30 transition-colors hover:bg-surface-3 hover:text-foreground/50"
                  title="New section"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add section</span>
                </button>
              </>
            )}
          </nav>
        </>
      )}

      {/* User row */}
      <div className="border-t border-subtle px-2 py-2">
        <div className="group/row flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-8 flex-1 min-w-0 items-center gap-2 rounded px-2 transition-colors hover:bg-surface-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ping-purple text-2xs font-medium text-white overflow-hidden">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={userName} className="h-full w-full object-cover" />
                  ) : (
                    userInitial
                  )}
                </div>
                <span className="flex-1 truncate text-left text-sm text-muted-foreground group-hover/row:text-foreground">
                  {userName}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="top"
              className="w-56 bg-surface-2 border-subtle"
            >
              <div className="px-2 py-1.5">
                <p className="text-xs font-medium text-foreground">
                  {userName}
                </p>
                <p className="text-2xs text-muted-foreground">{userEmail}</p>
              </div>
              <DropdownMenuSeparator className="bg-foreground/5" />
              <DropdownMenuItem
                className="cursor-pointer text-xs"
                onClick={() => router.push(buildPath("/settings/profile"))}
              >
                <User className="mr-2 h-3 w-3" />
                Profile
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem
                  className="cursor-pointer text-xs"
                  onClick={() => router.push(buildPath("/settings/team"))}
                >
                  <Users className="mr-2 h-3 w-3" />
                  Team
                </DropdownMenuItem>
              )}
              {isAdmin && (
                <DropdownMenuItem
                  className="cursor-pointer text-xs"
                  onClick={() =>
                    router.push(buildPath("/settings/workspace"))
                  }
                >
                  <Settings className="mr-2 h-3 w-3" />
                  Settings
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-foreground/5" />

              {/* Workspaces */}
              <div className="px-2 py-1">
                <span className="text-2xs font-medium uppercase tracking-widest text-foreground/50">
                  Workspaces
                </span>
              </div>
              {allWorkspaces?.map((ws) => (
                <DropdownMenuItem
                  key={ws._id}
                  className="cursor-pointer text-xs"
                  onClick={() => router.push(`/app/${ws.slug}/inbox`)}
                >
                  <Building2 className="mr-2 h-3 w-3" />
                  <span className="flex-1 truncate">{ws.name}</span>
                  {ws._id === workspaceId && (
                    <Check className="ml-2 h-3 w-3 text-ping-purple" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                className="cursor-pointer text-xs"
                onClick={() => router.push("/onboarding")}
              >
                <Plus className="mr-2 h-3 w-3" />
                Add workspace
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-foreground/5" />
              <DropdownMenuItem
                className="cursor-pointer text-xs"
                onClick={onOpenShortcuts}
              >
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

      {/* Unified New Conversation Dialog */}
      <Dialog open={newConvoOpen} onOpenChange={(open) => {
        setNewConvoOpen(open);
        if (!open) {
          setNewConvoSearch("");
          setNewConvoSelected([]);
          setNewConvoName("");
          setNewConvoVisibility("auto");
        }
      }}>
        <DialogContent className="border-subtle bg-surface-2 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              New conversation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            {/* Search */}
            <input
              value={newConvoSearch}
              onChange={(e) => setNewConvoSearch(e.target.value)}
              placeholder="Add people or agents..."
              autoFocus
              className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/40 focus:border-ring focus:outline-none"
            />

            {/* Selected chips */}
            {newConvoSelected.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {newConvoSelectedUsers.map((u) => (
                  <span
                    key={u._id}
                    className="inline-flex items-center gap-1 rounded-full bg-ping-purple/10 px-2 py-0.5 text-2xs text-ping-purple"
                  >
                    {u.name}
                    <button
                      type="button"
                      onClick={() => setNewConvoSelected((prev) => prev.filter((id) => id !== u._id))}
                      className="ml-0.5 text-ping-purple/60 hover:text-ping-purple"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* People list */}
            <div className="max-h-44 space-y-0.5 overflow-y-auto scrollbar-thin">
              {(allUsers ?? [])
                .filter(
                  (u) =>
                    u._id !== user?._id &&
                    !newConvoSelected.includes(u._id) &&
                    u.name.toLowerCase().includes(newConvoSearch.toLowerCase()),
                )
                .sort((a, b) => {
                  if (a.isAgent && !b.isAgent) return -1;
                  if (!a.isAgent && b.isAgent) return 1;
                  return a.name.localeCompare(b.name);
                })
                .map((u) => (
                  <button
                    key={u._id}
                    onClick={() => setNewConvoSelected((prev) => [...prev, u._id])}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-surface-3"
                  >
                    {u.isAgent ? (
                      <div
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${u.agentColor ?? "#5E6AD2"}20` }}
                      >
                        <Bot className="h-3 w-3" style={{ color: u.agentColor ?? "#5E6AD2" }} />
                      </div>
                    ) : u.avatarUrl ? (
                      <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full">
                        <img src={u.avatarUrl} alt={u.name} className="h-full w-full object-cover" />
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

            {/* Group name — shown for 3+ total participants */}
            {!isSmallGroup && (
              <div>
                <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
                  Name (optional)
                </label>
                <input
                  value={newConvoName}
                  onChange={(e) => setNewConvoName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateConversation()}
                  placeholder="e.g. frontend-team"
                  className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/40 focus:border-ring focus:outline-none"
                />
              </div>
            )}

            {/* Visibility override */}
            {newConvoSelected.length > 0 && (
              <div className="flex items-center gap-2">
                <Lock className="h-3 w-3 text-foreground/40" />
                <select
                  value={newConvoVisibility}
                  onChange={(e) => setNewConvoVisibility(e.target.value as typeof newConvoVisibility)}
                  className="flex-1 rounded border border-subtle bg-background px-2 py-1 text-xs text-foreground focus:border-ring focus:outline-none"
                >
                  <option value="auto">
                    Auto ({isSmallGroup ? "private" : "public"})
                  </option>
                  <option value="public">Public</option>
                  <option value="secret">Private</option>
                  <option value="secret_can_be_public">Private (can be made public)</option>
                </select>
              </div>
            )}

            {/* Create button */}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setNewConvoOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={newConvoSelected.length === 0}
                className="h-7 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover disabled:opacity-40"
                onClick={handleCreateConversation}
              >
                Start conversation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Section Dialog */}
      <CreateSectionDialog
        open={createSectionOpen}
        onOpenChange={setCreateSectionOpen}
        onCreateSection={handleCreateSection}
      />

      {/* Rename Section Dialog */}
      <RenameSectionDialog
        open={!!renameSectionId}
        onOpenChange={(open) => {
          if (!open) setRenameSectionId(null);
        }}
        currentName={renamingSection?.name ?? ""}
        onRename={handleRenameSection}
      />
    </div>
  );
}

/* --- Settings navigation --- */

interface SettingsNavProps {
  pathname: string;
  buildPath: (p: string) => string;
  role?: "admin" | "member" | "guest" | null;
}

function SettingsNav({ pathname, buildPath, role }: SettingsNavProps) {
  const router = useRouter();
  const wsCtx = useContext(WorkspaceContext);
  const isAdmin = role === "admin" || wsCtx?.role === "admin";
  const isGuest = role === "guest" || wsCtx?.role === "guest";

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

      <div className="mx-0 my-2 h-px bg-foreground/5" />

      <NavItem
        href={buildPath("/settings/profile")}
        icon={User}
        label="Profile"
        isActive={pathname.endsWith("/settings/profile")}
      />
      {isAdmin && (
        <NavItem
          href={buildPath("/settings/workspace")}
          icon={Building2}
          label="Workspace"
          isActive={pathname.endsWith("/settings/workspace")}
        />
      )}
      {isAdmin && (
        <NavItem
          href={buildPath("/settings/team")}
          icon={Users}
          label="Team"
          isActive={pathname.endsWith("/settings/team")}
        />
      )}
      {isAdmin && (
        <NavItem
          href={buildPath("/settings/agents")}
          icon={Bot}
          label="Agents"
          isActive={pathname.endsWith("/settings/agents")}
        />
      )}
      {!isGuest && (
        <NavItem
          href={buildPath("/settings/knowledge-graph")}
          icon={GitBranch}
          label="Knowledge Graph"
          isActive={pathname.endsWith("/settings/knowledge-graph")}
        />
      )}
      {!isGuest && (
        <NavItem
          href={buildPath("/settings/email")}
          icon={Mail}
          label="Email"
          isActive={pathname.endsWith("/settings/email")}
        />
      )}
      {isAdmin && (
        <NavItem
          href={buildPath("/settings/analytics")}
          icon={BarChart2}
          label="Analytics"
          isActive={pathname.endsWith("/settings/analytics")}
        />
      )}
      <NavItem
        href={buildPath("/settings/api-keys")}
        icon={Key}
        label="API Keys"
        isActive={pathname.endsWith("/settings/api-keys")}
      />

      {isAdmin && (
        <>
          <div className="mx-0 my-2 h-px bg-foreground/5" />
          <NavItem
            href="/admin"
            icon={Settings}
            label="Backoffice"
            isActive={pathname.startsWith("/admin")}
          />
        </>
      )}
    </>
  );
}
