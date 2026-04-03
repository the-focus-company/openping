import { GitCommit } from "lucide-react";
import { MockupFrame } from "./MockupFrame";

const nodes = [
  {
    color: "#10B981",
    title: "Decision: Migrate to PostgreSQL",
    date: "Mar 28",
    tag: "Architecture",
  },
  {
    color: "#3B82F6",
    title: "Context gathered: 3 threads, 2 PRs linked",
    date: "Mar 28",
    tag: null,
  },
  {
    color: "#8B5CF6",
    title: "Action: @sarah assigned migration plan",
    date: "Mar 29",
    tag: null,
  },
  {
    color: "#F59E0B",
    title: "Follow-up: Review deadline Mar 31",
    date: "Mar 30",
    tag: null,
  },
] as const;

export function DecisionTrailMockup() {
  return (
    <MockupFrame>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800">
        <GitCommit className="w-4 h-4 text-neutral-400" />
        <span className="text-[13px] font-medium text-white">
          Decision Trail
        </span>
      </div>

      {/* Timeline */}
      <div className="px-4 py-4">
        <div className="relative">
          {/* Connecting line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-neutral-700" />

          <div className="space-y-5">
            {nodes.map((node) => (
              <div key={node.title} className="relative flex items-start gap-3">
                <div
                  className="w-[15px] h-[15px] rounded-full shrink-0 mt-0.5 border-2 border-neutral-900 z-10"
                  style={{ backgroundColor: node.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-white leading-snug">
                    {node.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-neutral-500">
                      {node.date}
                    </span>
                    {node.tag && (
                      <span className="text-[10px] font-medium text-violet-400 bg-violet-500/15 px-1.5 py-0.5 rounded">
                        {node.tag}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}
