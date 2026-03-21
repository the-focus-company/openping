"use client";

import { Clock, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentStatusProps {
  status?: "pending" | "running" | "completed" | "failed";
  result?: string;
}

const statusConfig = {
  pending: {
    icon: Clock,
    className: "text-muted-foreground",
    spin: false,
    label: "Pending",
  },
  running: {
    icon: Loader2,
    className: "text-blue-400",
    spin: true,
    label: "Running",
  },
  completed: {
    icon: Check,
    className: "text-green-400",
    spin: false,
    label: "Completed",
  },
  failed: {
    icon: X,
    className: "text-red-400",
    spin: false,
    label: "Failed",
  },
} as const;

export function AgentStatus({ status, result }: AgentStatusProps) {
  if (!status) return null;

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn("inline-flex items-center gap-1", config.className)}
      title={status === "failed" && result ? result : config.label}
    >
      <Icon className={cn("h-4 w-4", config.spin && "animate-spin")} />
    </span>
  );
}
