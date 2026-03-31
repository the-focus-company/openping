"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { UserPlus, MoreHorizontal, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Copy, Check, Link } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarGradient, cn, formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast-provider";
import { useWorkspace } from "@/hooks/useWorkspace";
import { UserProfileDialog } from "@/components/user/UserProfileDialog";

type Role = "admin" | "member" | "guest";
type Status = "active" | "invited" | "deprovisioned";

interface TeamMember {
  id: Id<"users">;
  name: string;
  email: string;
  initials: string;
  role: Role;
  status: Status;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function mapStatus(status: "active" | "invited" | "deactivated"): Status {
  if (status === "deactivated") return "deprovisioned";
  return status;
}

const roleConfig: Record<Role, { label: string; className: string }> = {
  admin:  { label: "Admin",  className: "border-ping-purple/40 bg-ping-purple/10 text-ping-purple" },
  member: { label: "Member", className: "border-foreground/15 bg-foreground/5 text-foreground/60" },
  guest:  { label: "Guest",  className: "border-amber-500/40 bg-amber-500/10 text-amber-600" },
};

const statusConfig: Record<Status, { dot: "online" | "pending" | "offline"; label: string }> = {
  active:        { dot: "online",  label: "Active" },
  invited:       { dot: "pending", label: "Invited" },
  deprovisioned: { dot: "offline", label: "Deprovisioned" },
};

export default function TeamPage() {
  const { role } = useWorkspace();

  if (role !== "admin") {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        You don&apos;t have permission to view team settings.
      </div>
    );
  }

  return <TeamPageContent />;
}

function TeamPageContent() {
  const { workspaceId, workspaceSlug } = useWorkspace();
  const rawUsers = useQuery(api.users.listAll, { workspaceId });
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const updateRoleMutation = useMutation(api.users.updateRole);
  const deactivateMutation = useMutation(api.users.deactivate);
  const inviteByEmailMutation = useMutation(api.workspaceMembers.inviteByEmail);
  const togglePublicInviteMutation = useMutation(api.workspaces.togglePublicInvite);
  const pendingRequestCount = useQuery(api.accessRequests.countPending, { workspaceId });
  const accessRequests = useQuery(api.accessRequests.list, { workspaceId });
  const reviewRequestMutation = useMutation(api.accessRequests.review);
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);

  const [tab, setTab] = useState("all");
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<TeamMember | null>(null);
  const [deprovisionOpen, setDeprovisionOpen] = useState(false);
  const [deprovisionTarget, setDeprovisionTarget] = useState<TeamMember | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [inviteResultToken, setInviteResultToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const { toast } = useToast();

  const [sortCol, setSortCol] = useState<"name" | "email" | "role" | "status">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [profileUserId, setProfileUserId] = useState<Id<"users"> | null>(null);

  const members: TeamMember[] = useMemo(() => {
    if (!rawUsers) return [];
    return rawUsers.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      initials: getInitials(u.name),
      role: u.role,
      status: mapStatus(u.status),
    }));
  }, [rawUsers]);

  const toggleSort = (col: "name" | "email" | "role" | "status") => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let base = members;
    if (tab === "guest") {
      base = members.filter((m) => m.role === "guest");
    } else if (tab !== "all") {
      base = members.filter((m) => m.status === tab);
    }
    return base.slice().sort((a, b) => {
      const aVal = a[sortCol].toLowerCase();
      const bVal = b[sortCol].toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [members, tab, sortCol, sortDir]);

  const activeCount = useMemo(
    () => members.filter((m) => m.status === "active").length,
    [members],
  );

  const handleSync = () => {
    toast("Directory is automatically synced — Convex queries update in real time", "success");
  };

  const handleChangeRole = async (id: Id<"users">, newRole: Role) => {
    try {
      await updateRoleMutation({ workspaceId, userId: id, role: newRole });
      toast(`Role updated to ${newRole}`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update role", "error");
    }
    setRoleDialogOpen(false);
    setRoleTarget(null);
  };

  const handleDeprovision = async () => {
    if (!deprovisionTarget) return;
    try {
      await deactivateMutation({ workspaceId, userId: deprovisionTarget.id });
      toast(`${deprovisionTarget.name} has been deprovisioned`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to deprovision user", "error");
    }
    setDeprovisionOpen(false);
    setDeprovisionTarget(null);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      const result = await inviteByEmailMutation({ workspaceId, email: inviteEmail.trim(), role: inviteRole });
      setInviteResultToken(result.token);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to send invite", "error");
    }
  };

  const handleCopyToken = () => {
    if (inviteResultToken) {
      navigator.clipboard.writeText(inviteResultToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  if (rawUsers === undefined) {
    return (
      <div className="mx-auto max-w-4xl animate-fade-in px-6 py-6">
        <h1 className="text-md font-semibold text-foreground">Team</h1>
        <p className="mt-2 text-xs text-muted-foreground">Loading team members...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl animate-fade-in px-6 py-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-md font-semibold text-foreground">Team</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {activeCount} active members · Synced via WorkOS SCIM
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            className="flex items-center gap-1.5 rounded border border-subtle px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/10 hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" />
            Sync
          </button>
          <Button
            size="sm"
            className="h-7 gap-1.5 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover"
            onClick={() => setInviteOpen(true)}
          >
            <UserPlus className="h-3 w-3" />
            Invite
          </Button>
        </div>
      </div>

      {/* SCIM notice */}
      <div className="mb-4 flex items-center gap-2 rounded border border-subtle bg-surface-1 px-3 py-2.5">
        <StatusDot variant="online" size="xs" />
        <p className="text-xs text-muted-foreground">
          Directory sync active — team members are automatically provisioned via WorkOS SCIM
        </p>
      </div>

      {/* Public Invite Link */}
      {workspace && (
        <div className="mb-4 rounded border border-subtle bg-surface-1 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link className="h-3.5 w-3.5 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium text-foreground">Public Invite Link</p>
                <p className="text-2xs text-muted-foreground">
                  Allow anyone with the link to join this workspace
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  await togglePublicInviteMutation({
                    workspaceId,
                    enabled: !workspace.publicInviteEnabled,
                  });
                  toast(
                    workspace.publicInviteEnabled
                      ? "Public invite link disabled"
                      : "Public invite link enabled",
                    "success",
                  );
                } catch (err) {
                  toast(err instanceof Error ? err.message : "Failed to toggle public invite", "error");
                }
              }}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                workspace.publicInviteEnabled ? "bg-ping-purple" : "bg-foreground/20",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                  workspace.publicInviteEnabled ? "translate-x-4" : "translate-x-0",
                )}
              />
            </button>
          </div>
          {workspace.publicInviteEnabled && (
            <div className="mt-3 flex items-center gap-2">
              <input
                value={typeof window !== "undefined" ? `${window.location.origin}/join/${workspaceSlug}` : `/join/${workspaceSlug}`}
                readOnly
                className="flex-1 rounded border border-subtle bg-surface-3 px-2.5 py-1.5 font-mono text-xs text-foreground"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => {
                  const url = `${window.location.origin}/join/${workspaceSlug}`;
                  navigator.clipboard.writeText(url);
                  setCopiedPublicLink(true);
                  setTimeout(() => setCopiedPublicLink(false), 2000);
                }}
              >
                {copiedPublicLink ? (
                  <Check className="h-3.5 w-3.5 text-status-online" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="h-7 bg-surface-2 p-0.5">
          <TabsTrigger value="all" className="h-6 px-2.5 text-xs">All</TabsTrigger>
          <TabsTrigger value="active" className="h-6 px-2.5 text-xs">Active</TabsTrigger>
          <TabsTrigger value="invited" className="h-6 px-2.5 text-xs">Pending</TabsTrigger>
          <TabsTrigger value="deprovisioned" className="h-6 px-2.5 text-xs">Deprovisioned</TabsTrigger>
          <TabsTrigger value="guest" className="h-6 px-2.5 text-xs">Guests</TabsTrigger>
          <TabsTrigger value="requests" className="h-6 px-2.5 text-xs">
            <span className="flex items-center gap-1.5">
              Requests
              {(pendingRequestCount ?? 0) > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-ping-purple px-1 text-2xs font-medium text-white">
                  {pendingRequestCount}
                </span>
              )}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Requests Tab Content */}
      {tab === "requests" ? (
        <div className="overflow-hidden rounded border border-subtle">
          {(!accessRequests || accessRequests.length === 0) ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              No pending requests
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_1fr_1.5fr_100px_120px] gap-4 border-b border-subtle bg-surface-1 px-4 py-2">
                <span className="text-2xs font-medium uppercase tracking-widest text-foreground/45">Email</span>
                <span className="text-2xs font-medium uppercase tracking-widest text-foreground/45">Name</span>
                <span className="text-2xs font-medium uppercase tracking-widest text-foreground/45">Message</span>
                <span className="text-2xs font-medium uppercase tracking-widest text-foreground/45">Submitted</span>
                <span className="text-2xs font-medium uppercase tracking-widest text-foreground/45">Actions</span>
              </div>
              {accessRequests.map((req) => (
                <div
                  key={req._id}
                  className="grid grid-cols-[1fr_1fr_1.5fr_100px_120px] items-center gap-4 border-b border-subtle px-4 py-2.5 last:border-0 hover:bg-surface-2"
                >
                  <span className="truncate text-xs text-foreground">{req.email}</span>
                  <span className="truncate text-xs text-muted-foreground">{req.name ?? "—"}</span>
                  <span className="truncate text-xs text-muted-foreground">{req.message ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(req.createdAt)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {req.status === "pending" ? (
                      <>
                        <Button
                          size="sm"
                          className="h-6 px-2 text-2xs bg-status-online/15 text-status-online hover:bg-status-online/25"
                          onClick={async () => {
                            try {
                              await reviewRequestMutation({ requestId: req._id, decision: "approved" });
                              toast("Request approved", "success");
                            } catch (err) {
                              toast(err instanceof Error ? err.message : "Failed to approve", "error");
                            }
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-2xs text-destructive hover:text-destructive"
                          onClick={async () => {
                            try {
                              await reviewRequestMutation({ requestId: req._id, decision: "rejected" });
                              toast("Request rejected", "success");
                            } catch (err) {
                              toast(err instanceof Error ? err.message : "Failed to reject", "error");
                            }
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    ) : (
                      <span className={cn(
                        "text-2xs font-medium capitalize",
                        req.status === "approved" ? "text-status-online" : "text-destructive",
                      )}>
                        {req.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
      <>
      {/* Table */}
      <div className="overflow-hidden rounded border border-subtle">
        <div className="grid grid-cols-[1fr_1fr_80px_80px_32px] gap-4 border-b border-subtle bg-surface-1 px-4 py-2">
          {([
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role" },
            { key: "status", label: "Status" },
          ] as const).map(({ key, label }) => {
            const SortIcon = sortCol === key ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
            return (
              <button
                key={key}
                onClick={() => toggleSort(key)}
                className="flex items-center gap-1 text-2xs font-medium uppercase tracking-widest text-foreground/45 transition-colors hover:text-foreground/70 cursor-pointer"
              >
                {label}
                <SortIcon className={cn("h-3 w-3", sortCol === key ? "text-foreground/40" : "text-foreground/50")} />
              </button>
            );
          })}
          <span />
        </div>

        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            No team members found.
          </div>
        )}

        {filtered.map((member) => {
          const sc = statusConfig[member.status];
          return (
            <div
              key={member.id}
              className={cn(
                "grid grid-cols-[1fr_1fr_80px_80px_32px] items-center gap-4",
                "border-b border-subtle px-4 py-2.5 transition-colors last:border-0",
                "hover:bg-surface-2",
                member.status === "deprovisioned" && "opacity-50"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarFallback className={`text-2xs font-medium text-white bg-gradient-to-br ${avatarGradient(member.id + member.initials)}`}>
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => setProfileUserId(member.id as Id<"users">)}
                  className="truncate text-xs font-medium text-foreground hover:underline cursor-pointer"
                >
                  {member.name}
                </button>
              </div>

              <span className="truncate text-xs text-muted-foreground">{member.email}</span>

              <span className={cn("inline-flex items-center rounded border px-1.5 py-px text-2xs font-medium", roleConfig[member.role].className)}>
                {roleConfig[member.role].label}
              </span>

              <div className="flex items-center gap-1.5">
                <StatusDot variant={sc.dot} size="xs" />
                <span className="text-xs text-muted-foreground">{sc.label}</span>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-6 w-6 items-center justify-center rounded text-foreground/45 transition-colors hover:bg-surface-3 hover:text-foreground">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 bg-surface-2 border-subtle">
                  <DropdownMenuItem
                    className="text-xs cursor-pointer"
                    onClick={() => { setRoleTarget(member); setRoleDialogOpen(true); }}
                  >
                    Change role
                  </DropdownMenuItem>
                  {member.status === "invited" && (
                    <DropdownMenuItem
                      className="text-xs cursor-pointer opacity-50"
                      disabled
                    >
                      Resend invite (coming soon)
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-foreground/5" />
                  <DropdownMenuItem
                    className="text-xs text-destructive focus:text-destructive cursor-pointer"
                    onClick={() => { setDeprovisionTarget(member); setDeprovisionOpen(true); }}
                  >
                    Deprovision
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-2xs text-foreground/40">
        {members.length} total members · Real-time sync via Convex
      </p>
      </>
      )}

      {/* Change Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={(open) => { setRoleDialogOpen(open); if (!open) setRoleTarget(null); }}>
        <DialogContent className="border-subtle bg-surface-2 sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Change role for {roleTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            {(["admin", "member", "guest"] as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => roleTarget && handleChangeRole(roleTarget.id, r)}
                className={cn(
                  "flex w-full items-center justify-between rounded border px-3 py-2 text-xs transition-colors",
                  roleTarget?.role === r
                    ? "border-ping-purple/40 bg-ping-purple/10 text-ping-purple"
                    : "border-subtle bg-surface-3 text-foreground hover:border-foreground/10"
                )}
              >
                <span className="capitalize font-medium">{r}</span>
                {roleTarget?.role === r && <span className="text-2xs text-muted-foreground">current</span>}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Deprovision Confirmation */}
      <Dialog open={deprovisionOpen} onOpenChange={(open) => { setDeprovisionOpen(open); if (!open) setDeprovisionTarget(null); }}>
        <DialogContent className="border-subtle bg-surface-2 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-destructive">Deprovision {deprovisionTarget?.name}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground">
              This will revoke all access for <span className="font-medium text-foreground">{deprovisionTarget?.name}</span>.
              They will no longer be able to access any workspace resources.
            </p>
            <div className="rounded border border-status-warning/30 bg-status-warning/10 px-3 py-2">
              <p className="text-2xs text-status-warning">
                This action can be undone by re-inviting the user.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDeprovisionOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={handleDeprovision}
              >
                Deprovision
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) {
            setInviteEmail("");
            setInviteRole("member");
            setInviteResultToken(null);
            setCopiedToken(false);
          }
        }}
      >
        <DialogContent className="border-subtle bg-surface-2 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {inviteResultToken ? "Invite sent" : "Invite team member"}
            </DialogTitle>
          </DialogHeader>

          {inviteResultToken ? (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-muted-foreground">
                Share this invite token with the new team member:
              </p>
              <div className="flex items-center gap-2">
                <input
                  value={inviteResultToken}
                  readOnly
                  className="flex-1 rounded border border-subtle bg-surface-3 px-2.5 py-1.5 font-mono text-xs text-foreground"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={handleCopyToken}
                >
                  {copiedToken ? (
                    <Check className="h-3.5 w-3.5 text-status-online" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  className="h-7 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover"
                  onClick={() => {
                    setInviteOpen(false);
                    setInviteEmail("");
                    setInviteRole("member");
                    setInviteResultToken(null);
                    setCopiedToken(false);
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div>
                <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
                  Email address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/45 focus:border-ring focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
                  Role
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["member", "admin", "guest"] as Role[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setInviteRole(r)}
                      className={cn(
                        "rounded border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                        inviteRole === r
                          ? "border-ping-purple/40 bg-ping-purple/10 text-ping-purple"
                          : "border-subtle bg-surface-3 text-muted-foreground hover:border-foreground/10"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <p className="text-2xs text-muted-foreground mt-1">
                  {inviteRole === "admin" && "Full access to all workspace settings and channels"}
                  {inviteRole === "member" && "Access to all channels, cannot manage workspace settings"}
                  {inviteRole === "guest" && "Access only to assigned channels, limited features"}
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setInviteOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!inviteEmail.trim()}
                  className="h-7 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover disabled:opacity-40"
                  onClick={handleInvite}
                >
                  Send invite
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <UserProfileDialog
        userId={profileUserId}
        open={profileUserId !== null}
        onOpenChange={(open) => { if (!open) setProfileUserId(null); }}
      />
    </div>
  );
}
