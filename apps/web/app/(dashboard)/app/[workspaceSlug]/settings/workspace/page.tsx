"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { StatusDot } from "@/components/ui/status-dot";
import { Building2, Link, Github, Loader2 } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";

export default function WorkspacePage() {
  const { toast } = useToast();
  const { workspaceId } = useWorkspace();
  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const updateWorkspace = useMutation(api.workspaces.update);

  const [workspaceName, setWorkspaceName] = useState("");
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (workspace && !initialized) {
      setWorkspaceName(workspace.name);
      setInitialized(true);
    }
  }, [workspace, initialized]);

  const handleSave = async () => {
    if (!workspaceName.trim()) return;
    setSaving(true);
    try {
      await updateWorkspace({ workspaceId, name: workspaceName.trim() });
      toast("Workspace settings saved", "success");
    } catch {
      toast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  if (workspace === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg animate-fade-in px-6 py-6">
      <div className="mb-6">
        <h1 className="text-md font-semibold text-foreground">Workspace</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Manage your workspace settings and integrations
        </p>
      </div>

      <div className="space-y-5">
        {/* Workspace Name */}
        <div>
          <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-white/40">
            Workspace name
          </label>
          <input
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            className="w-full rounded border border-subtle bg-surface-2 px-2.5 py-1.5 text-xs text-foreground placeholder:text-white/25 focus:border-white/20 focus:outline-none"
          />
        </div>

        {/* Workspace Slug */}
        <div>
          <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-white/40">
            Workspace slug
          </label>
          <input
            value={workspace?.slug ?? ""}
            disabled
            className="w-full rounded border border-subtle bg-surface-1 px-2.5 py-1.5 text-xs text-muted-foreground"
          />
          <p className="mt-1 text-2xs text-white/20">Read-only identifier</p>
        </div>

        {/* Integrations */}
        <div>
          <label className="mb-2 block text-2xs font-medium uppercase tracking-widest text-white/40">
            <span className="flex items-center gap-1.5">
              <Link className="h-3 w-3" />
              Integrations
            </span>
          </label>
          <div className="space-y-2">
            {/* GitHub */}
            <div className="flex items-center justify-between rounded border border-subtle bg-surface-1 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Github className="h-3.5 w-3.5 text-white/50" />
                <div>
                  <p className="text-xs text-foreground">GitHub</p>
                  <div className="flex items-center gap-1.5">
                    <StatusDot variant="offline" size="xs" />
                    <p className="text-2xs text-muted-foreground">Coming soon</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Linear */}
            <div className="flex items-center justify-between rounded border border-subtle bg-surface-1 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-white/50" />
                <div>
                  <p className="text-xs text-foreground">Linear</p>
                  <div className="flex items-center gap-1.5">
                    <StatusDot variant="offline" size="xs" />
                    <p className="text-2xs text-muted-foreground">Coming soon</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Slack */}
            <div className="flex items-center justify-between rounded border border-subtle bg-surface-1 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 text-white/50" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.52-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.522 2.522v6.312zm-2.522 10.124a2.528 2.528 0 0 1 2.522 2.52A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.521-2.522v-2.52h2.521zm0-1.271a2.527 2.527 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.522h-6.313z" />
                </svg>
                <div>
                  <p className="text-xs text-foreground">Slack</p>
                  <div className="flex items-center gap-1.5">
                    <StatusDot variant="offline" size="xs" />
                    <p className="text-2xs text-muted-foreground">Coming soon</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="pt-2">
          <Button
            className="h-8 w-full bg-ping-purple text-xs text-white hover:bg-ping-purple-hover"
            onClick={handleSave}
            disabled={saving || !workspaceName.trim()}
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
