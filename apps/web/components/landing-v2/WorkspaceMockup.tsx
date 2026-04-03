import { Hash, Inbox, Bot, Users } from "lucide-react";
import { MockupFrame } from "./MockupFrame";

const channels = ["backend", "frontend", "devops"];

const dms = [
  { name: "Sarah Chen", agent: false },
  { name: "mrPING", agent: true },
];

const messages = [
  {
    avatar: "S",
    avatarColor: "bg-emerald-600",
    name: "Sarah Chen",
    text: "Pushed the migration script. Ready for review.",
  },
  {
    avatar: "M",
    avatarColor: "bg-blue-600",
    name: "mrPING",
    text: "I linked 2 related PRs and updated the decision trail.",
  },
  {
    avatar: "J",
    avatarColor: "bg-amber-600",
    name: "Jake Miller",
    text: "LGTM, merging after CI passes.",
  },
];

export function WorkspaceMockup() {
  return (
    <MockupFrame maxWidth="max-w-[520px]">
      <div className="flex min-h-[260px]">
        {/* Sidebar */}
        <div className="w-[180px] border-r border-neutral-800 py-3 shrink-0">
          {/* Deck */}
          <div className="flex items-center justify-between px-3 py-1.5 mx-2 rounded-md bg-neutral-800/50">
            <div className="flex items-center gap-2">
              <Inbox className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-[12px] text-white font-medium">
                My Deck
              </span>
            </div>
            <span className="text-[10px] font-medium text-white bg-blue-600 px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              3
            </span>
          </div>

          {/* Engineering section */}
          <div className="mt-4 px-3">
            <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
              Engineering
            </span>
            <div className="mt-1.5 space-y-0.5">
              {channels.map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-1.5 py-1 px-1 rounded text-[12px] text-neutral-400 hover:text-white"
                >
                  <Hash className="w-3 h-3" />
                  <span>{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* DMs section */}
          <div className="mt-4 px-3">
            <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
              DMs
            </span>
            <div className="mt-1.5 space-y-0.5">
              {dms.map((dm) => (
                <div
                  key={dm.name}
                  className="flex items-center gap-1.5 py-1 px-1 rounded text-[12px] text-neutral-400"
                >
                  <div className="w-4 h-4 rounded-full bg-neutral-700 flex items-center justify-center">
                    {dm.agent ? (
                      <Bot className="w-2.5 h-2.5 text-blue-400" />
                    ) : (
                      <span className="text-[8px] text-neutral-300">
                        {dm.name[0]}
                      </span>
                    )}
                  </div>
                  <span>{dm.name}</span>
                  {dm.agent && (
                    <span className="text-[9px] text-blue-400 bg-blue-500/15 px-1 py-0.5 rounded leading-none">
                      agent
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Channel header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800">
            <div className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-[13px] font-medium text-white">
                backend
              </span>
            </div>
            <div className="flex items-center gap-1 text-neutral-500">
              <Users className="w-3 h-3" />
              <span className="text-[11px]">8</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 px-4 py-3 space-y-3">
            {messages.map((msg) => (
              <div key={msg.name} className="flex items-start gap-2.5">
                <div
                  className={`w-6 h-6 rounded-full ${msg.avatarColor} flex items-center justify-center shrink-0`}
                >
                  <span className="text-[10px] font-medium text-white">
                    {msg.avatar}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[12px] font-medium text-white">
                    {msg.name}
                  </span>
                  <p className="text-[12px] text-neutral-400 leading-relaxed mt-0.5">
                    {msg.text}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Cmd+K hint */}
          <div className="px-4 py-2 border-t border-neutral-800 flex justify-end">
            <span className="text-[10px] text-neutral-600 bg-neutral-800/50 px-1.5 py-0.5 rounded border border-neutral-700/50">
              Cmd+K
            </span>
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}
