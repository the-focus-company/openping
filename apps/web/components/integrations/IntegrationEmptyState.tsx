"use client";

import { Button } from "@/components/ui/button";

interface IntegrationEmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  actionLabel: string;
  onAction?: () => void;
}

export function IntegrationEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: IntegrationEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-subtle bg-surface-1 px-6 py-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <Button
        className="mt-1 h-8 bg-ping-purple px-4 text-xs text-white hover:bg-ping-purple-hover"
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </div>
  );
}
