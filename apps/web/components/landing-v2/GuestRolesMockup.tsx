import { Check, X, Shield, User, UserCheck } from "lucide-react";
import { MockupFrame } from "./MockupFrame";

const roles = [
  { name: "Admin", icon: Shield, color: "text-amber-400", bg: "bg-amber-500/15" },
  { name: "Member", icon: UserCheck, color: "text-blue-400", bg: "bg-blue-500/15" },
  { name: "Guest", icon: User, color: "text-neutral-400", bg: "bg-neutral-500/15" },
] as const;

const permissions = [
  { label: "Send messages", access: [true, true, true] },
  { label: "Create channels", access: [true, true, false] },
  { label: "Invite members", access: [true, false, false] },
  { label: "Manage workspace", access: [true, false, false] },
  { label: "View knowledge graph", access: [true, true, false] },
] as const;

export function GuestRolesMockup() {
  return (
    <MockupFrame>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800">
        <Shield className="w-4 h-4 text-neutral-400" />
        <span className="text-[13px] font-medium text-white">
          Workspace Roles
        </span>
      </div>

      {/* Table */}
      <div className="p-4">
        {/* Role headers */}
        <div className="grid grid-cols-[1fr_repeat(3,72px)] gap-2 mb-3">
          <div />
          {roles.map((role) => (
            <div key={role.name} className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-lg ${role.bg} flex items-center justify-center`}
              >
                <role.icon className={`w-4 h-4 ${role.color}`} />
              </div>
              <span className={`text-[11px] font-medium ${role.color}`}>
                {role.name}
              </span>
            </div>
          ))}
        </div>

        {/* Permission rows */}
        <div className="space-y-1">
          {permissions.map((perm) => (
            <div
              key={perm.label}
              className="grid grid-cols-[1fr_repeat(3,72px)] gap-2 items-center py-2 px-2 rounded-lg bg-neutral-800/30"
            >
              <span className="text-[12px] text-neutral-300">
                {perm.label}
              </span>
              {perm.access.map((allowed, i) => (
                <div key={i} className="flex justify-center">
                  {allowed ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <X className="w-4 h-4 text-neutral-600" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </MockupFrame>
  );
}
