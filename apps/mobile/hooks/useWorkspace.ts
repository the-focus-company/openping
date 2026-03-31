import { createContext, useContext } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export interface WorkspaceContextValue {
  workspaceId: Id<"workspaces">;
  workspaceName: string;
  workspaceSlug: string;
  role: "admin" | "member" | "guest";
  switchWorkspace: (workspaceId: Id<"workspaces">) => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null,
);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    // Return a placeholder — screens will be redirected to login before rendering
    return {
      workspaceId: "" as Id<"workspaces">,
      workspaceName: "",
      workspaceSlug: "",
      role: "member",
      switchWorkspace: () => {},
    };
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
