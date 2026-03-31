import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChipGridProps {
  options: ReadonlyArray<{ key: string; label: string; description: string }>;
  selected: string[];
  onToggle: (key: string) => void;
  accentColor: string;
}

export function ChipGrid({ options, selected, onToggle, accentColor }: ChipGridProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {options.map((opt) => {
        const active = selected.includes(opt.key);
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onToggle(opt.key)}
            className={cn(
              "flex items-start gap-2 rounded border px-2.5 py-2 text-left transition-colors",
              active
                ? "border-foreground/15 bg-surface-3"
                : "border-subtle hover:border-foreground/10",
            )}
          >
            <div
              className={cn(
                "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors",
                active ? `border-transparent` : "border-foreground/20",
              )}
              style={active ? { backgroundColor: accentColor } : undefined}
            >
              {active && <Check className="h-2.5 w-2.5 text-white" />}
            </div>
            <div className="min-w-0">
              <p className={cn("text-xs font-medium truncate", active ? "text-foreground" : "text-foreground/60")}>
                {opt.label}
              </p>
              <p className="text-2xs text-foreground/50 line-clamp-1">{opt.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
