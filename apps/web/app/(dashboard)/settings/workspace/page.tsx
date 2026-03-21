"use client";

import { useContext, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { WorkspaceContext } from "@/components/workspace/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Github, Unplug, Plug } from "lucide-react";
import { LinearIcon } from "@/components/icons/LinearIcon";

export default function WorkspaceSettingsPage() {
  const wsCtx = useContext(WorkspaceContext);

  if (!wsCtx) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading workspace...
      </div>
    );
  }

  return <WorkspaceSettingsContent />;
}

function WorkspaceSettingsContent() {
  const wsCtx = useContext(WorkspaceContext)!;
  const workspace = useQuery(api.workspaces.get, {
    workspaceId: wsCtx.workspaceId,
  });
  const connectIntegration = useMutation(api.workspaces.connectIntegration);
  const disconnectIntegration = useMutation(api.workspaces.disconnectIntegration);

  const [connectDialog, setConnectDialog] = useState<"github" | "linear" | null>(null);
  const [accountName, setAccountName] = useState("");
  const [connecting, setConnecting] = useState(false);

  const githubConfig = workspace?.integrationConfig?.github;
  const linearConfig = workspace?.integrationConfig?.linear;

  const isAdmin = wsCtx.role === "admin";

  async function handleConnect() {
    if (!connectDialog || !accountName.trim()) return;
    setConnecting(true);
    try {
      await connectIntegration({
        workspaceId: wsCtx.workspaceId,
        provider: connectDialog,
        accountName: accountName.trim(),
      });
      setConnectDialog(null);
      setAccountName("");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect(provider: "github" | "linear") {
    await disconnectIntegration({
      workspaceId: wsCtx.workspaceId,
      provider,
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold">Workspace Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage integrations and workspace configuration for{" "}
          <strong>{wsCtx.workspaceName}</strong>.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Integrations</h2>

        <Card>
          <CardHeader className="flex flex-row items-center gap-4 space-y-0">
            <Github className="h-8 w-8 shrink-0" />
            <div className="flex-1">
              <CardTitle className="text-base">GitHub</CardTitle>
              <CardDescription>
                Sync pull requests and repository activity into PING channels.
              </CardDescription>
            </div>
            {githubConfig?.connected ? (
              <Badge variant="secondary">Connected</Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </CardHeader>
          <CardContent>
            {githubConfig?.connected ? (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Connected to{" "}
                  <span className="font-medium text-foreground">
                    {githubConfig.accountName}
                  </span>
                  {githubConfig.connectedAt && (
                    <span>
                      {" "}
                      since{" "}
                      {new Date(githubConfig.connectedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDisconnect("github")}
                  >
                    <Unplug className="mr-1 h-4 w-4" />
                    Disconnect
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Connect your GitHub organization to start syncing PRs.
                </span>
                {isAdmin && (
                  <Button size="sm" onClick={() => setConnectDialog("github")}>
                    <Plug className="mr-1 h-4 w-4" />
                    Connect GitHub
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-4 space-y-0">
            <LinearIcon className="h-7 w-7 shrink-0" />
            <div className="flex-1">
              <CardTitle className="text-base">Linear</CardTitle>
              <CardDescription>
                Track Linear tickets and project updates directly in PING.
              </CardDescription>
            </div>
            {linearConfig?.connected ? (
              <Badge variant="secondary">Connected</Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </CardHeader>
          <CardContent>
            {linearConfig?.connected ? (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Connected to{" "}
                  <span className="font-medium text-foreground">
                    {linearConfig.orgName}
                  </span>
                  {linearConfig.connectedAt && (
                    <span>
                      {" "}
                      since{" "}
                      {new Date(linearConfig.connectedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDisconnect("linear")}
                  >
                    <Unplug className="mr-1 h-4 w-4" />
                    Disconnect
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Connect your Linear workspace to sync tickets.
                </span>
                {isAdmin && (
                  <Button size="sm" onClick={() => setConnectDialog("linear")}>
                    <Plug className="mr-1 h-4 w-4" />
                    Connect Linear
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={connectDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConnectDialog(null);
            setAccountName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Connect {connectDialog === "github" ? "GitHub" : "Linear"}
            </DialogTitle>
            <DialogDescription>
              {connectDialog === "github"
                ? "Enter your GitHub organization or account name. In production this will redirect to GitHub OAuth."
                : "Enter your Linear organization name. In production this will redirect to Linear OAuth."}
            </DialogDescription>
          </DialogHeader>

          <Input
            placeholder={
              connectDialog === "github"
                ? "e.g. my-org"
                : "e.g. My Team"
            }
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConnect();
            }}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConnectDialog(null);
                setAccountName("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConnect}
              disabled={!accountName.trim() || connecting}
            >
              {connecting ? "Connecting..." : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
