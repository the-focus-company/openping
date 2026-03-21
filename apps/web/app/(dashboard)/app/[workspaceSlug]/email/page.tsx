"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  EmailCard,
  type EisenhowerQuadrant,
} from "@/components/email/EmailCard";
import { Loader2, Mail, Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type QuadrantFilter = "all" | EisenhowerQuadrant;

const QUADRANT_TABS: { value: QuadrantFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "urgent-important", label: "Do Now" },
  { value: "important", label: "Schedule" },
  { value: "urgent", label: "Delegate" },
  { value: "fyi", label: "FYI" },
];

export default function EmailListPage() {
  const [quadrantFilter, setQuadrantFilter] = useState<QuadrantFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { isAuthenticated } = useConvexAuth();

  const emails = useQuery(
    api.emails.list,
    isAuthenticated
      ? quadrantFilter === "all"
        ? {}
        : { quadrant: quadrantFilter }
      : "skip",
  );

  const searchResults = useQuery(
    api.emails.search,
    isAuthenticated && searchQuery.length >= 2
      ? { query: searchQuery }
      : "skip",
  );

  const markReadMutation = useMutation(api.emails.markRead);
  const markUnreadMutation = useMutation(api.emails.markUnread);
  const archiveMutation = useMutation(api.emails.archive);
  const toggleStarMutation = useMutation(api.emails.toggleStar);

  const displayEmails = searchQuery.length >= 2 ? searchResults : emails;

  const unreadCount = useMemo(() => {
    if (!emails) return 0;
    return emails.filter((e) => !e.isRead).length;
  }, [emails]);

  const handleMarkRead = (id: string) => {
    const email = displayEmails?.find((e) => e._id === id);
    if (email?.isRead) {
      markUnreadMutation({ emailId: id as Id<"emails"> });
    } else {
      markReadMutation({ emailId: id as Id<"emails"> });
    }
  };

  const handleArchive = (id: string) => {
    archiveMutation({ emailId: id as Id<"emails"> });
  };

  const handleToggleStar = (id: string) => {
    toggleStarMutation({ emailId: id as Id<"emails"> });
  };

  if (emails === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-subtle px-4 py-2">
        <div className="flex items-center gap-3">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Email</span>
          {unreadCount > 0 && (
            <>
              <span className="text-2xs text-white/20">·</span>
              <span className="text-xs text-muted-foreground">
                {unreadCount} unread
              </span>
            </>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="border-b border-subtle px-4 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emails..."
            className="w-full rounded border border-subtle bg-surface-2 py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-foreground/25 focus:border-foreground/20 focus:outline-none"
          />
        </div>
      </div>

      {/* Quadrant filter tabs */}
      <div className="border-b border-subtle px-4 py-2">
        <Tabs
          value={quadrantFilter}
          onValueChange={(v) => setQuadrantFilter(v as QuadrantFilter)}
        >
          <TabsList className="h-7 bg-surface-2 p-0.5">
            {QUADRANT_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="h-6 px-2.5 text-xs"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Email list */}
      {displayEmails && displayEmails.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <Mail className="h-10 w-10 text-white/15" />
          <h2 className="text-sm font-medium text-foreground">
            {searchQuery ? "No results found" : "No emails"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {searchQuery
              ? "Try a different search term"
              : "Connect your email account in Settings to get started"}
          </p>
        </div>
      ) : (
        displayEmails?.map((email) => (
          <EmailCard
            key={email._id}
            email={email}
            onMarkRead={handleMarkRead}
            onArchive={handleArchive}
            onToggleStar={handleToggleStar}
          />
        ))
      )}
    </div>
  );
}
