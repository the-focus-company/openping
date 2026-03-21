"use client";

import { createContext, ReactNode, useMemo } from "react";
import { Id } from "@convex/_generated/dataModel";

export interface WorkspaceContextValue {
  workspaceId: Id<"workspaces">;
  workspaceSlug: string;
  workspaceName: string;
  role: "admin" | "member";
  isSubdomain: boolean;
  /** Build a path for this workspace. In subdomain mode returns bare path, otherwise /app/{slug}/path */
  buildPath: (path: string) => string;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

interface WorkspaceProviderProps {
  children: ReactNode;
  workspaceId: Id<"workspaces">;
  workspaceSlug: string;
  workspaceName: string;
  role: "admin" | "member";
  isSubdomain?: boolean;
}

export function WorkspaceProvider({
  children,
  workspaceId,
  workspaceSlug,
  workspaceName,
  role,
  isSubdomain = false,
}: WorkspaceProviderProps) {
  const buildPath = useMemo(() => {
    if (isSubdomain) {
      return (path: string) => path.startsWith("/") ? path : `/${path}`;
    }
    return (path: string) => {
      const p = path.startsWith("/") ? path : `/${path}`;
      return `/app/${workspaceSlug}${p}`;
    };
  }, [isSubdomain, workspaceSlug]);

  return (
    <WorkspaceContext.Provider
      value={{ workspaceId, workspaceSlug, workspaceName, role, isSubdomain, buildPath }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
