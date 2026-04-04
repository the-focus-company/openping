"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Bot, X, CornerDownLeft } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
} from "@/components/ui/command";
import { UserProfileDialog } from "@/components/user/UserProfileDialog";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { MANAGED_AGENT_STYLE, DEFAULT_AGENT_STYLE, type AgentPickerItem } from "./command-palette-config";
import { AgentPickerPanel } from "./AgentPickerPanel";
import { AgentChatPanel } from "./AgentChatPanel";
import { SearchResults } from "./SearchResults";
import { DefaultCommands } from "./DefaultCommands";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleSidebar?: () => void;
  onStartMeeting?: () => void;
}

export function CommandPalette({ open, onOpenChange, onToggleSidebar, onStartMeeting }: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const { isAuthenticated } = useConvexAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebouncedValue(search, 250);
  const hasSearch = debouncedSearch.trim().length >= 2;

  const workspaceSlug = pathname.match(/^\/app\/([^/]+)/)?.[1];
  const workspacePrefix = workspaceSlug ? `/app/${workspaceSlug}` : "";
  const workspace = useQuery(api.workspaces.getBySlug, isAuthenticated && workspaceSlug ? { slug: workspaceSlug } : "skip");
  const workspaceId = workspace?._id as Id<"workspaces"> | undefined;

  const conversations = useQuery(api.conversations.list, isAuthenticated && workspaceId ? { workspaceId } : "skip");
  const currentUser = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");

  // Fetch managed agents from DB
  const managedAgentsRaw = useQuery(
    api.managedAgents.listManaged,
    isAuthenticated && workspaceId ? { workspaceId } : "skip",
  );
  const managedAgents: AgentPickerItem[] = useMemo(() => {
    if (!managedAgentsRaw) return [];
    return managedAgentsRaw.map((a) => {
      const style = (a.managedSlug && MANAGED_AGENT_STYLE[a.managedSlug]) || DEFAULT_AGENT_STYLE;
      return {
        id: a._id,
        agentId: a._id,
        name: a.name,
        description: a.description ?? "AI agent",
        icon: style.icon,
        color: style.color,
      };
    });
  }, [managedAgentsRaw]);

  const peopleResults = useQuery(
    api.search.searchPeople,
    isAuthenticated && workspaceId && hasSearch
      ? { workspaceId, query: debouncedSearch.trim() }
      : "skip",
  );
  const messageResults = useQuery(
    api.search.searchMessages,
    isAuthenticated && workspaceId && hasSearch
      ? { workspaceId, query: debouncedSearch.trim() }
      : "skip",
  );
  const isSearching = hasSearch && (peopleResults === undefined || messageResults === undefined);

  // Agent mention state
  const [selectedAgent, setSelectedAgent] = useState<AgentPickerItem | null>(null);
  const [quickChatId, setQuickChatId] = useState<Id<"quickChats"> | null>(null);
  const quickChat = useQuery(api.quickChat.get, quickChatId ? { quickChatId } : "skip");
  const sendQuickChat = useMutation(api.quickChat.send);

  // Detect @mention mode
  const isAtMode = search.startsWith("@");
  const isAgentPickerMode = isAtMode && !selectedAgent;
  const isChatMode = isAtMode && selectedAgent !== null;

  // Filter agents by what's typed after @
  const agentFilter = isAgentPickerMode ? search.slice(1).toLowerCase().trim() : "";
  const filteredAgents = managedAgents.filter(
    (a) => !agentFilter || a.name.toLowerCase().includes(agentFilter) || a.description.toLowerCase().includes(agentFilter),
  );

  const handleAgentSelect = useCallback((agent: AgentPickerItem) => {
    setSelectedAgent(agent);
    setSearch("@");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleQuickChatSubmit = useCallback(async () => {
    if (!workspaceId || !selectedAgent) return;
    const query = search.replace(/^@\s*/, "").trim();
    if (!query) return;
    const id = await sendQuickChat({
      workspaceId,
      query,
      agentId: selectedAgent.agentId,
    });
    setQuickChatId(id);
  }, [workspaceId, search, sendQuickChat, selectedAgent]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setSearch("");
      setQuickChatId(null);
      setSelectedAgent(null);
    }
  }, [open]);

  // Clear agent if user deletes the @ prefix
  useEffect(() => {
    if (!isAtMode && selectedAgent) {
      setSelectedAgent(null);
      setQuickChatId(null);
    }
  }, [isAtMode, selectedAgent]);

  const navigate = (href: string) => {
    const fullHref = href.startsWith("/admin") ? href : `${workspacePrefix}${href}`;
    router.push(fullHref);
    onOpenChange(false);
  };

  const allMessageResults = useMemo(() => {
    if (!messageResults) return [];

    const msgs = messageResults.map((m) => ({
      _id: m._id,
      body: m.body,
      authorName: m.authorName,
      _creationTime: m._creationTime,
      href: `/c/${m.conversationId}`,
      context: m.conversationName ? `#${m.conversationName}` : "conversation",
    }));

    msgs.sort((a, b) => b._creationTime - a._creationTime);
    return msgs.slice(0, 15);
  }, [messageResults]);

  const showSearchResults = hasSearch && !isAtMode;
  const hasAnyResults = (peopleResults && peopleResults.length > 0) || allMessageResults.length > 0;

  const [profileUserId, setProfileUserId] = useState<Id<"users"> | null>(null);

  const openProfile = useCallback((userId: string) => {
    onOpenChange(false);
    setTimeout(() => setProfileUserId(userId as Id<"users">), 150);
  }, [onOpenChange]);

  useEffect(() => {
    if (open) setProfileUserId(null);
  }, [open]);

  return (
    <>
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={isAtMode ? false : undefined}>
      <CommandInput
        ref={inputRef}
        placeholder={
          isChatMode
            ? `Ask ${selectedAgent?.name}...`
            : isAgentPickerMode
              ? "Choose an agent..."
              : "Search or type @ to chat with an agent..."
        }
        value={search}
        onValueChange={(v: string) => {
          setSearch(v);
          if (!v.startsWith("@")) {
            setQuickChatId(null);
          }
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter" && isChatMode && !quickChatId) {
            e.preventDefault();
            e.stopPropagation();
            handleQuickChatSubmit();
          }
          if (e.key === "Backspace" && isChatMode && search === "@") {
            e.preventDefault();
            setSelectedAgent(null);
            setSearch("");
            setQuickChatId(null);
          }
        }}
        leading={
          selectedAgent ? (
            <button
              type="button"
              onClick={() => { setSelectedAgent(null); setSearch(""); setQuickChatId(null); }}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-white/[0.07] px-2 py-0.5 text-[12px] font-medium text-white/70 hover:bg-white/[0.12] transition-colors"
            >
              <selectedAgent.icon className={`h-3 w-3 ${selectedAgent.color}`} />
              {selectedAgent.name}
              <X className="h-2.5 w-2.5 text-white/30" />
            </button>
          ) : isAtMode ? (
            <Bot className="shrink-0 h-4 w-4 text-violet-400/60" />
          ) : undefined
        }
        trailing={
          isChatMode && !quickChatId && search.length > 1 ? (
            <button
              type="button"
              onClick={handleQuickChatSubmit}
              className="shrink-0 flex items-center gap-1 rounded-md bg-violet-500/20 px-2 py-1 text-[11px] font-medium text-violet-300 hover:bg-violet-500/30 transition-colors"
            >
              <CornerDownLeft className="h-3 w-3" />
            </button>
          ) : undefined
        }
      />

      <div className="h-[min(360px,50vh)]">
        {isAgentPickerMode ? (
          <AgentPickerPanel filteredAgents={filteredAgents} onSelect={handleAgentSelect} />
        ) : isChatMode ? (
          <AgentChatPanel
            selectedAgent={selectedAgent!}
            quickChatId={quickChatId}
            quickChat={quickChat}
          />
        ) : (
          <CommandList className="h-full max-h-full">
            {showSearchResults ? (
              <SearchResults
                isSearching={isSearching}
                hasAnyResults={hasAnyResults}
                debouncedSearch={debouncedSearch}
                peopleResults={peopleResults}
                allMessageResults={allMessageResults}
                dmConversations={conversations}
                onNavigate={navigate}
                onOpenProfile={openProfile}
              />
            ) : (
              <DefaultCommands
                conversations={conversations}
                currentUserId={currentUser?._id}
                onNavigate={navigate}
                onToggleSidebar={onToggleSidebar}
                onStartMeeting={onStartMeeting}
                onClose={() => onOpenChange(false)}
              />
            )}
          </CommandList>
        )}
      </div>

      {/* Footer bar — Raycast-style hints */}
      <div className="flex items-center justify-between border-t border-white/[0.06] px-3 py-1.5">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[12px] text-white/50">
            <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-px text-[11px]">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1 text-[12px] text-white/50">
            <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-px text-[11px]">↵</kbd>
            Select
          </span>
          <span className="flex items-center gap-1 text-[12px] text-white/50">
            <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-px text-[11px]">esc</kbd>
            Close
          </span>
        </div>
        <span className="flex items-center gap-1 text-[12px] text-white/50">
          <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-px text-[11px]">@</kbd>
          Talk to mrPING
        </span>
      </div>
    </CommandDialog>

    <UserProfileDialog
      userId={profileUserId}
      open={profileUserId !== null}
      onOpenChange={(open) => { if (!open) setProfileUserId(null); }}
    />
    </>
  );
}
