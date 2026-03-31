"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface RenameSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onRename: (name: string) => void;
}

export function RenameSectionDialog({
  open,
  onOpenChange,
  currentName,
  onRename,
}: RenameSectionDialogProps) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    if (open) setName(currentName);
  }, [open, currentName]);

  const handleRename = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) return;
    onRename(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-subtle bg-surface-2 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Rename section
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div>
            <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
              Section name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/40 focus:border-ring focus:outline-none"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!name.trim() || name.trim() === currentName}
              className="h-7 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover disabled:opacity-40"
              onClick={handleRename}
            >
              Rename
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
