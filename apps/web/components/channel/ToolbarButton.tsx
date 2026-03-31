import { cn } from "@/lib/utils";

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

export function ToolbarButton({ onClick, isActive, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      data-toolbar-item
      tabIndex={-1}
      className={cn(
        "rounded p-1 transition-colors",
        isActive
          ? "bg-foreground/10 text-foreground"
          : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
        disabled && "cursor-not-allowed opacity-30"
      )}
    >
      {children}
    </button>
  );
}
