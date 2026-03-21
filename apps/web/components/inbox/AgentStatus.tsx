"use client";

import { Loader2, Check, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type AgentExecutionStatus = "pending" | "running" | "completed" | "failed";

interface AgentStatusProps {
  status: AgentExecutionStatus;
  error?: string;
  className?: string;
}

export function AgentStatus({ status, error, className }: AgentStatusProps) {
  if (status === "pending") {
    return null;
  }

  if (status === "running") {
    return (
      <span
        className={cn("inline-flex items-center text-muted-foreground", className)}
        aria-label="Agent action running"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span
        className={cn("inline-flex items-center text-green-500", className)}
        aria-label="Agent action completed"
      >
        <Check className="h-4 w-4" />
      </span>
    );
  }

  if (status === "failed") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn("inline-flex items-center text-red-500", className)}
              aria-label="Agent action failed"
            >
              <X className="h-4 w-4" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{error ?? "Action failed"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
}
