import { cn } from "@/lib/utils";
import { initials, ROLE_LABEL } from "./inbox-config";

interface PersonPillProps {
  name: string;
  role: string;
  userId?: string;
  dim?: boolean;
  dashed?: boolean;
  onClick?: () => void;
}

export function PersonPill({ name, role, dim = false, dashed = false, onClick }: PersonPillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors",
        dashed
          ? "border border-dashed border-white/15 bg-transparent hover:border-white/25 hover:bg-surface-2"
          : "bg-surface-2 hover:bg-surface-3",
        dim && "opacity-60",
        onClick ? "cursor-pointer" : "cursor-default",
      )}
      title={`${name} — ${ROLE_LABEL[role] ?? role}${onClick ? " (click to view profile)" : ""}`}
    >
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-medium",
          dashed ? "bg-white/10 text-foreground/50" : "bg-surface-3 text-foreground/60",
        )}
      >
        {initials(name)}
      </span>
      <span className={cn("text-xs", dim ? "text-foreground/50" : "text-foreground/80")}>
        {name}
      </span>
      <span className="text-2xs text-foreground/50">{ROLE_LABEL[role] ?? role}</span>
    </button>
  );
}
