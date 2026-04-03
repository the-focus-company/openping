import { Inbox, Zap, Scale, Users, SkipForward } from "lucide-react";
import { MockupFrame } from "./MockupFrame";

const rows = [
  {
    color: "#E74C3C",
    label: "DO",
    title: "Deploy hotfix for auth timeout",
    time: "2 min ago",
    icon: Zap,
    badge: null,
    pulse: true,
  },
  {
    color: "#F59E0B",
    label: "DECIDE",
    title: "Approve Q3 architecture proposal",
    time: "15 min ago",
    icon: Scale,
    badge: null,
    pulse: false,
  },
  {
    color: "#3B82F6",
    label: "DELEGATE",
    title: "Review PR #847: Add caching layer",
    time: "1h ago",
    icon: Users,
    badge: "PING will do",
    pulse: false,
  },
  {
    color: "#737373",
    label: "SKIP",
    title: "Weekly standup notes shared",
    time: "3h ago",
    icon: SkipForward,
    badge: null,
    pulse: false,
  },
] as const;

export function InboxMockup() {
  return (
    <MockupFrame>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800">
        <Inbox className="w-4 h-4 text-neutral-400" />
        <span className="text-[13px] font-medium text-white">My Deck</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-neutral-800/60">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderLeft: `3px solid ${row.color}` }}
          >
            <row.icon
              className="w-4 h-4 shrink-0"
              style={{ color: row.color }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-white truncate">
                  {row.title}
                </span>
                {row.pulse && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: row.color }}
                  />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {row.badge && (
                <span className="text-[10px] font-medium text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded">
                  {row.badge}
                </span>
              )}
              <span className="text-[11px] text-neutral-500">{row.time}</span>
            </div>
          </div>
        ))}
      </div>
    </MockupFrame>
  );
}
