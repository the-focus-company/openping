"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS = [
  { section: "Navigation", items: [
    { keys: ["⌘", "K"], description: "Open command palette" },
    { keys: ["⌘", "B"], description: "Toggle sidebar" },
    { keys: ["G", "I"], description: "Go to Inbox" },
    { keys: ["G", "T"], description: "Go to Team settings" },
  ]},
  { section: "Chat", items: [
    { keys: ["Enter"], description: "Send message" },
    { keys: ["⇧", "Enter"], description: "New line" },
    { keys: ["@"], description: "Mention user or agent" },
  ]},
  { section: "General", items: [
    { keys: ["Esc"], description: "Close dialog / modal" },
    { keys: ["?"], description: "Show keyboard shortcuts" },
  ]},
];

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-subtle bg-surface-2 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Keyboard shortcuts</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {SHORTCUTS.map(({ section, items }) => (
            <div key={section}>
              <p className="mb-2 text-2xs font-medium uppercase tracking-widest text-white/25">
                {section}
              </p>
              <div className="space-y-1.5">
                {items.map(({ keys, description }) => (
                  <div key={keys.join("-")} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{description}</span>
                    <div className="flex items-center gap-1">
                      {keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
