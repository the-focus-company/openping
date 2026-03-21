"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { UserPlus, MoreHorizontal, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Mail } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";

type Role = "admin" | "member";
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
  member: { label: "Member", className: "border-white/15 bg-white/5 text-white/60" },
};

const statusConfig: Record<Status, { dot: "online" | "pending" | "offline"; label: string }> = {
  active:        { dot: "online",  label: "Active" },
  invited:       { dot: "pending", label: "Invited" },
  deprovisioned: { dot: "offline", label: "Deprovisioned" },
};

export default function TeamPage() {
  const rawUsers = useQuery(api.users.listAll);
  const updateRoleMutation = useMutation(api.users.updateRole);
  const deactivateMutation = useMutation(api.users.deactivate);
  const inviteUserMutation = useMutation(api.users.inviteUser);

  const [tab, setTab] = useState("all");
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<TeamMember | null>(null);
  const [deprovisionOpen, setDeprovisionOpen] = useState(false);
  const [deprovisionTarget, setDeprovisionTarget] = useState<TeamMember | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const { toast } = useToast();

  const [sortCol, setSortCol] = useState<"name" | "email" | "role" | "status">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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
    const base = tab === "all" ? members : members.filter((m) => m.status === tab);
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

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviteLoading(true);
    try {
      await inviteUserMutation({ email });
      const inviteLink = `${window.location.origin}/sign-in?email=${encodeURIComponent(email)}`;
      toast(`Invite sent to ${email}. Share this link: ${inviteLink}`, "success");
      setInviteOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to invite user", "error");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleChangeRole = async (id: Id<"users">, newRole: Role) => {
    try {
      await updateRoleMutation({ userId: id, role: newRole });
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
      await deactivateMutation({ userId: deprovisionTarget.id });
      toast(`${deprovisionTarget.name} has been deprovisioned`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to deprovision user", "error");
    }
    setDeprovisionOpen(false);
    setDeprovisionTarget(null);
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
            className="flex items-center gap-1.5 rounded border border-subtle px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-white/10 hover:text-foreground"
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

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="h-7 bg-surface-2 p-0.5">
          <TabsTrigger value="all" className="h-6 px-2.5 text-xs">All</TabsTrigger>
          <TabsTrigger value="active" className="h-6 px-2.5 text-xs">Active</TabsTrigger>
          <TabsTrigger value="invited" className="h-6 px-2.5 text-xs">Pending</TabsTrigger>
          <TabsTrigger value="deprovisioned" className="h-6 px-2.5 text-xs">Deprovisioned</TabsTrigger>
        </TabsList>
      </Tabs>

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
                className="flex items-center gap-1 text-2xs font-medium uppercase tracking-widest text-white/25 transition-colors hover:text-white/50 cursor-pointer"
              >
                {label}
                <SortIcon className={cn("h-3 w-3", sortCol === key ? "text-white/40" : "text-white/15")} />
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
                  <AvatarFallback className="bg-surface-3 text-2xs font-medium text-foreground">
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-xs font-medium text-foreground">{member.name}</span>
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
                  <button className="flex h-6 w-6 items-center justify-center rounded text-white/25 transition-colors hover:bg-surface-3 hover:text-foreground">
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
                  <DropdownMenuSeparator className="bg-white/5" />
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

      <p className="mt-3 text-2xs text-white/20">
        {members.length} total members · Real-time sync via Convex
      </p>

      {/* Change Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={(open) => { setRoleDialogOpen(open); if (!open) setRoleTarget(null); }}>
        <DialogContent className="border-subtle bg-surface-2 sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Change role for {roleTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            {(["admin", "member"] as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => roleTarget && handleChangeRole(roleTarget.id, r)}
                className={cn(
                  "flex w-full items-center justify-between rounded border px-3 py-2 text-xs transition-colors",
                  roleTarget?.role === r
                    ? "border-ping-purple/40 bg-ping-purple/10 text-ping-purple"
                    : "border-subtle bg-surface-3 text-foreground hover:border-white/10"
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

      {/* Invite Member Dialog */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { setInviteOpen(open); if (!open) { setInviteEmail(""); } }}>
        <DialogContent className="border-subtle bg-surface-2 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Invite a team member</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Enter their email address to send an invite to your workspace.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); handleInvite(); }}
            className="space-y-3 pt-1"
          >
            <div className="space-y-1.5">
              <label htmlFor="invite-email" className="text-xs font-medium text-foreground">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="invite-email"
                  type="email"
                  required
                  placeholder="teammate@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="h-8 bg-surface-3 border-subtle pl-8 text-xs placeholder:text-white/20"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setInviteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-7 gap-1.5 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover"
                disabled={inviteLoading || !inviteEmail.trim()}
              >
                {inviteLoading ? "Sending..." : "Send invite"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
