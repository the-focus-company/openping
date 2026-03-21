"use client";

import { useState } from "react";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AgentTokenDialogProps {
  token: string | null;
  open: boolean;
  onClose: () => void;
}

export function AgentTokenDialog({ token, open, onClose }: AgentTokenDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="border-subtle bg-surface-2 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">API Token Generated</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="flex items-start gap-2 rounded border border-yellow-500/20 bg-yellow-500/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
            <p className="text-xs leading-relaxed text-yellow-200/80">
              This token will only be shown once. Copy it now and store it securely.
            </p>
          </div>

          <div className="relative">
            <code
              className={cn(
                "block w-full break-all rounded border border-subtle bg-surface-3 p-3",
                "font-mono text-xs text-foreground"
              )}
            >
              {token}
            </code>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1.5 top-1.5 h-7 gap-1.5 px-2 text-2xs text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-green-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </Button>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              className="h-7 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
