"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AgentTokenDialog } from "@/components/bot/AgentTokenDialog";
import { Key, Plus, Trash2 } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";

export function UserApiKeyManager() {
  const { workspaceId } = useWorkspace();

  const tokens = useQuery(
    api.userApiTokens.list,
    workspaceId ? { workspaceId } : "skip",
  );
  const generateToken = useMutation(api.userApiTokens.generate);
  const revokeToken = useMutation(api.userApiTokens.revoke);

  const [newTokenLabel, setNewTokenLabel] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!workspaceId) return;
    const result = await generateToken({
      workspaceId,
      label: newTokenLabel || undefined,
    });
    setGeneratedToken(result.token);
    setShowGenerateDialog(false);
    setShowTokenDialog(true);
    setNewTokenLabel("");
  };

  const handleRevoke = async (tokenId: Id<"userApiTokens">) => {
    setRevoking(tokenId);
    await revokeToken({ tokenId });
    setRevoking(null);
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Your API Keys</h2>
        <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="h-7 gap-1.5 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover"
            >
              <Plus className="h-3 w-3" />
              Generate Key
            </Button>
          </DialogTrigger>
          <DialogContent className="border-subtle bg-surface-2 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold">
                Generate API Key
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs text-muted-foreground">
                  Label (optional)
                </label>
                <Input
                  value={newTokenLabel}
                  onChange={(e) => setNewTokenLabel(e.target.value)}
                  placeholder="e.g., My integration"
                  className="mt-1 h-8 border-subtle bg-surface-3 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowGenerateDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 bg-ping-purple text-xs text-white hover:bg-ping-purple-hover"
                  onClick={handleGenerate}
                >
                  Generate
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {tokens && tokens.length > 0 ? (
        <div className="space-y-2">
          {tokens.map((token) => (
            <div
              key={token._id}
              className="flex items-center justify-between rounded border border-subtle bg-surface-2 px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <Key className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-xs text-foreground">
                      {token.tokenPrefix}...
                    </code>
                    {token.label && (
                      <span className="text-xs text-muted-foreground">
                        {token.label}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Created {formatDate(token.createdAt)}
                    {token.lastUsedAt &&
                      ` · Last used ${formatDate(token.lastUsedAt)}`}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-[10px] text-red-400 hover:text-red-300"
                onClick={() => handleRevoke(token._id)}
                disabled={revoking === token._id}
              >
                <Trash2 className="h-3 w-3" />
                {revoking === token._id ? "Revoking..." : "Revoke"}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded border border-dashed border-subtle p-6 text-center">
          <Key className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No API keys yet</p>
          <p className="text-xs text-muted-foreground">
            Generate a key to get started with the API
          </p>
        </div>
      )}

      <AgentTokenDialog
        token={generatedToken}
        open={showTokenDialog}
        onClose={() => {
          setShowTokenDialog(false);
          setGeneratedToken(null);
        }}
      />
    </div>
  );
}
