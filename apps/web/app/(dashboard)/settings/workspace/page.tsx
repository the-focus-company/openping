"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function WorkspaceSettingsPage() {
  const workspace = useQuery(api.workspaces.get);
  const updateWorkspace = useMutation(api.workspaces.update);

  const [workspaceName, setWorkspaceName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (workspace) {
      setWorkspaceName(workspace.name);
    }
  }, [workspace]);

  const handleSave = async () => {
    if (!workspaceName.trim()) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      await updateWorkspace({ name: workspaceName.trim() });
      setSaveMessage("Settings saved.");
    } catch {
      setSaveMessage("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (workspace === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (workspace === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Workspace not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-foreground">
        Workspace Settings
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your workspace name and integrations.
      </p>

      <section className="mt-8">
        <label
          htmlFor="workspace-name"
          className="block text-sm font-medium text-foreground"
        >
          Workspace name
        </label>
        <Input
          id="workspace-name"
          className="mt-2 max-w-sm"
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">Integrations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect third-party services to your workspace.
        </p>

        <div className="mt-4 space-y-3">
          <IntegrationRow
            name="GitHub"
            description="Sync pull requests and issues"
          />
          <IntegrationRow
            name="Linear"
            description="Sync tickets and projects"
          />
          <IntegrationRow
            name="Slack"
            description="Import channels and messages"
          />
        </div>
      </section>

      <div className="mt-10 flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !workspaceName.trim()}>
          {saving ? "Saving..." : "Save"}
        </Button>
        {saveMessage && (
          <span className="text-sm text-muted-foreground">{saveMessage}</span>
        )}
      </div>
    </div>
  );
}

function IntegrationRow({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Button variant="outline" size="sm" disabled>
        Coming soon
      </Button>
    </div>
  );
}
