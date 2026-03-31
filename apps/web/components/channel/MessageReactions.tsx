"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface ReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
  userNames: string[];
}

function EmojiPickerPopover({
  onSelect,
  children,
  onOpenChange,
}: {
  onSelect: (emoji: string) => void;
  children: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [Picker, setPicker] = useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const [emojiData, setEmojiData] = useState<unknown>(null);

  useEffect(() => {
    if (open && !Picker) {
      Promise.all([
        import("@emoji-mart/react"),
        import("@emoji-mart/data"),
      ]).then(([pickerModule, dataModule]) => {
        setPicker(() => pickerModule.default);
        setEmojiData(dataModule.default);
      });
    }
  }, [open, Picker]);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    onOpenChange?.(v);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-auto p-0 border-none bg-transparent shadow-none">
        {Picker && emojiData ? (
          <Picker
            data={emojiData}
            onEmojiSelect={(emoji: { native: string }) => {
              onSelect(emoji.native);
              setOpen(false);
            }}
            theme="dark"
            set="native"
            previewPosition="none"
            skinTonePosition="search"
            maxFrequentRows={2}
          />
        ) : (
          <div className="flex h-[435px] w-[352px] items-center justify-center rounded-xl bg-surface-2 border border-subtle">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function formatTooltipNames(names: string[]): string {
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} other${names.length - 3 !== 1 ? "s" : ""}`;
}

function ReactionPill({
  emoji,
  count,
  isActive,
  userNames,
  onClick,
}: {
  emoji: string;
  count: number;
  isActive: boolean;
  userNames: string[];
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded-full px-1.5 text-xs transition-colors hover:bg-surface-3",
            isActive
              ? "bg-ping-purple/10 text-ping-purple"
              : "bg-surface-2 text-muted-foreground",
          )}
        >
          <span>{emoji}</span>
          <span>{count}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {formatTooltipNames(userNames)}
      </TooltipContent>
    </Tooltip>
  );
}

export function MessageReactions({
  reactions,
  currentUserId,
  onToggle,
}: {
  reactions: ReactionGroup[];
  currentUserId: string;
  onToggle: (emoji: string) => void;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {reactions.map((r) => (
          <ReactionPill
            key={r.emoji}
            emoji={r.emoji}
            count={r.count}
            isActive={r.userIds.includes(currentUserId)}
            userNames={r.userNames}
            onClick={() => onToggle(r.emoji)}
          />
        ))}
        <EmojiPickerPopover onSelect={onToggle}>
          <button className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-subtle bg-surface-2 text-muted-foreground transition-colors hover:bg-surface-3">
            <Plus className="h-2.5 w-2.5" />
          </button>
        </EmojiPickerPopover>
      </div>
    </TooltipProvider>
  );
}

export { EmojiPickerPopover };
