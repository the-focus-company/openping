"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CreateSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateSection: (name: string) => void;
}

export function CreateSectionDialog({
  open,
  onOpenChange,
  onCreateSection,
}: CreateSectionDialogProps) {
  const [name, setName] = useState("");

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreateSection(trimmed);
    setName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-subtle bg-surface-2 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            New section
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
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Engineering"
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
              disabled={!name.trim()}
              className="h-7 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover disabled:opacity-40"
              onClick={handleCreate}
            >
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
