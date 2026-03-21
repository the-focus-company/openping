"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRouter } from "next/navigation";
import { WorkspaceProvider } from "@/components/workspace/WorkspaceProvider";
import { Loader2 } from "lucide-react";

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
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-white/20" />
      </div>
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
