"use client";

import { useState, useEffect } from "react";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { StatusDot } from "@/components/ui/status-dot";
import { Building2, Link, AlertTriangle, Github, Loader2 } from "lucide-react";

export default function WorkspacePage() {
  const { toast } = useToast();
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");

  const [workspaceName, setWorkspaceName] = useState("PING");
  const [workspaceSlug, setWorkspaceSlug] = useState("ping");
  const [initialized, setInitialized] = useState(false);

  const [githubConnected, setGithubConnected] = useState(true);
  const [linearConnected, setLinearConnected] = useState(true);
  const [slackConnected, setSlackConnected] = useState(false);

  useEffect(() => {
    if (user && !initialized) {
      // Mock: in the future, fetch workspace details using user.workspaceId
      setInitialized(true);
    }
  }, [user, initialized]);

  const handleSave = async () => {
    try {
      // TODO: call workspace update mutation when available
      toast("Workspace settings saved", "success");
    } catch {
      toast("Failed to save", "error");
    }
  };

  if (user === undefined) {
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
            value={workspaceSlug}
            disabled
            className="w-full rounded border border-subtle bg-surface-1 px-2.5 py-1.5 text-xs text-muted-foreground"
          />
          <p className="mt-1 text-2xs text-white/20">Used in URLs — cannot be changed</p>
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
            <label className="flex items-center justify-between cursor-pointer rounded border border-subtle bg-surface-1 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Github className="h-3.5 w-3.5 text-white/50" />
                <div>
                  <p className="text-xs text-foreground">GitHub</p>
                  <div className="flex items-center gap-1.5">
                    <StatusDot variant={githubConnected ? "online" : "offline"} size="xs" />
                    <p className="text-2xs text-muted-foreground">
                      {githubConnected ? "Connected" : "Not connected"}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setGithubConnected((v) => !v)}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  githubConnected ? "bg-ping-purple" : "bg-surface-3"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    githubConnected ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>

            {/* Linear */}
            <label className="flex items-center justify-between cursor-pointer rounded border border-subtle bg-surface-1 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-white/50" />
                <div>
                  <p className="text-xs text-foreground">Linear</p>
                  <div className="flex items-center gap-1.5">
                    <StatusDot variant={linearConnected ? "online" : "offline"} size="xs" />
                    <p className="text-2xs text-muted-foreground">
                      {linearConnected ? "Connected" : "Not connected"}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setLinearConnected((v) => !v)}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  linearConnected ? "bg-ping-purple" : "bg-surface-3"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    linearConnected ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>

            {/* Slack */}
            <label className="flex items-center justify-between cursor-pointer rounded border border-subtle bg-surface-1 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 text-white/50" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.52-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.522 2.522v6.312zm-2.522 10.124a2.528 2.528 0 0 1 2.522 2.52A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.521-2.522v-2.52h2.521zm0-1.271a2.527 2.527 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.522h-6.313z" />
                </svg>
                <div>
                  <p className="text-xs text-foreground">Slack</p>
                  <div className="flex items-center gap-1.5">
                    <StatusDot variant={slackConnected ? "online" : "offline"} size="xs" />
                    <p className="text-2xs text-muted-foreground">
                      {slackConnected ? "Connected" : "Not connected"}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSlackConnected((v) => !v)}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  slackConnected ? "bg-ping-purple" : "bg-surface-3"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    slackConnected ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        {/* Save */}
        <div className="pt-2">
          <Button
            className="h-8 w-full bg-ping-purple text-xs text-white hover:bg-ping-purple-hover"
            onClick={handleSave}
          >
            Save changes
          </Button>
        </div>

        {/* Danger Zone */}
        <div className="pt-4">
          <label className="mb-2 block text-2xs font-medium uppercase tracking-widest text-white/40">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" />
              Danger zone
            </span>
          </label>
          <div className="rounded border border-status-danger/30 bg-status-danger/5 px-3 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">Archive workspace</p>
                <p className="text-2xs text-muted-foreground">
                  This will disable all integrations and hide the workspace
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={() => toast("Workspace archived", "error")}
              >
                Archive
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
