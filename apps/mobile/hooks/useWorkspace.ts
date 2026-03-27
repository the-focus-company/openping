import { createContext, useContext } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export interface WorkspaceContextValue {
  workspaceId: Id<"workspaces">;
  workspaceName: string;
  workspaceSlug: string;
  role: "admin" | "member";
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null,
);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}

export function useWorkspaceData() {
  const workspaces = useQuery(api.workspaceMembers.listMyWorkspaces);
  return {
    workspaces: workspaces ?? null,
    isLoading: workspaces === undefined,
  };
}
