import { ChevronRight } from "lucide-react";
import type { AgentPickerItem } from "./command-palette-config";

interface AgentPickerPanelProps {
  filteredAgents: AgentPickerItem[];
  onSelect: (agent: AgentPickerItem) => void;
}

export function AgentPickerPanel({ filteredAgents, onSelect }: AgentPickerPanelProps) {
  return (
    <div className="p-1.5">
      <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-white/30">
        Agents
      </div>
      {filteredAgents.map((agent) => (
        <button
          key={agent.id}
          type="button"
          onClick={() => onSelect(agent)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-white/[0.07] transition-colors group"
        >
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ${agent.color}`}>
            <agent.icon className="h-3.5 w-3.5" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[13px] font-medium text-white/80 group-hover:text-white">{agent.name}</span>
            <span className="text-[11px] text-white/30">{agent.description}</span>
          </div>
          <ChevronRight className="h-3 w-3 text-white/15 group-hover:text-white/30 transition-colors" />
        </button>
      ))}
      {filteredAgents.length === 0 && (
        <div className="px-3 py-6 text-center text-[13px] text-white/30">
          No matching agents
        </div>
      )}
    </div>
  );
}
