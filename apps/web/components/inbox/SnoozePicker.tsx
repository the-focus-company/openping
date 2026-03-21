"use client";

import { Clock, Sun, Calendar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface SnoozePickerProps {
  onSnooze: (timestamp: number) => void;
  children?: React.ReactNode;
}

type SnoozeOption = "1h" | "4h" | "tomorrow" | "next_week";

function getSnoozeTimestamp(option: SnoozeOption): number {
  const now = new Date();

  switch (option) {
    case "1h":
      return now.getTime() + 60 * 60 * 1000;
    case "4h":
      return now.getTime() + 4 * 60 * 60 * 1000;
    case "tomorrow": {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow.getTime();
    }
    case "next_week": {
      const nextMonday = new Date(now);
      const dayOfWeek = nextMonday.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
      nextMonday.setHours(9, 0, 0, 0);
      return nextMonday.getTime();
    }
  }
}

export function SnoozePicker({ onSnooze, children }: SnoozePickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children ?? (
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" />
            Snooze
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem
          onClick={() => onSnooze(getSnoozeTimestamp("1h"))}
          className="gap-2"
        >
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          1 hour
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSnooze(getSnoozeTimestamp("4h"))}
          className="gap-2"
        >
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          4 hours
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onSnooze(getSnoozeTimestamp("tomorrow"))}
          className="gap-2"
        >
          <Sun className="h-3.5 w-3.5 text-muted-foreground" />
          Tomorrow morning
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSnooze(getSnoozeTimestamp("next_week"))}
          className="gap-2"
        >
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          Next week
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
