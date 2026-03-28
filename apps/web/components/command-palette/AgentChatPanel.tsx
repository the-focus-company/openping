import { Loader2, AlertCircle } from "lucide-react";
import type { AgentPickerItem } from "./command-palette-config";

interface AgentChatPanelProps {
  selectedAgent: AgentPickerItem;
  quickChatId: string | null;
  quickChat: { status: string; response?: string } | null | undefined;
}

export function AgentChatPanel({ selectedAgent, quickChatId, quickChat }: AgentChatPanelProps) {
  return (
    <div className="flex h-full flex-col p-3">
      {!quickChatId ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] ${selectedAgent.color}`}>
            <selectedAgent.icon className="h-5 w-5" />
          </div>
          <p className="text-[13px] text-white/40">
            Type your message and press{" "}
            <kbd className="rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[11px] font-medium text-white/50">↵</kbd>
          </p>
        </div>
      ) : quickChat?.status === "pending" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
          <p className="text-[12px] text-white/30">Thinking...</p>
        </div>
      ) : quickChat?.status === "error" ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400 mt-0.5" />
            <p className="text-[13px] text-red-300/80">{quickChat.response}</p>
          </div>
        </div>
      ) : quickChat?.status === "done" ? (
        <div className="flex flex-col gap-2 overflow-y-auto">
          <div className="flex items-start gap-2.5">
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/[0.06] mt-0.5 ${selectedAgent.color}`}>
              <selectedAgent.icon className="h-3 w-3" />
            </div>
            <p className="text-[13px] text-white/70 leading-relaxed whitespace-pre-wrap">{quickChat.response}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
