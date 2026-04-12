"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRouter } from "next/navigation";
import { WorkspaceProvider } from "@/components/workspace/WorkspaceProvider";
import { LoadingState } from "@/components/ui/loading-state";

interface Props {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}

function useIsSubdomain(slug: string): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  // If the hostname starts with the slug and is not localhost bare, we're in subdomain mode
  return hostname.startsWith(`${slug}.`);
}

export default function WorkspaceLayout({ children, params }: Props) {
  const { workspaceSlug } = use(params);
  const router = useRouter();
  const isSubdomain = useIsSubdomain(workspaceSlug);

  const workspace = useQuery(api.workspaces.getBySlug, { slug: workspaceSlug });
  const myWorkspaces = useQuery(api.workspaceMembers.listMyWorkspaces);

  // Loading state
  if (workspace === undefined || myWorkspaces === undefined || myWorkspaces === null) {
    return (
      <LoadingState
        isLoading
        variant="inline"
        message="Loading workspace\u2026"
        timeoutMs={12_000}
        timeoutMessage="Could not load this workspace."
        onRetry={() => window.location.reload()}
        onSignOut={() => { window.location.href = "/sign-out"; }}
      />
    );
  }

  // Workspace not found
  if (workspace === null) {
    router.push("/");
    return null;
  }

  // Find membership for this workspace
  const membership = myWorkspaces.find((w) => w.workspaceId === workspace._id);
  if (!membership) {
    router.push("/");
    return null;
  }

  return (
    <WorkspaceProvider
      workspaceId={workspace._id}
      workspaceSlug={workspaceSlug}
      workspaceName={workspace.name}
      role={membership.role}
      isSubdomain={isSubdomain}
    >
      {children}
    </WorkspaceProvider>
  );
}
