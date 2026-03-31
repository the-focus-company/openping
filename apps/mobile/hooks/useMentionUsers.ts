import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useWorkspace } from "@/hooks/useWorkspace";

export function useMentionUsers() {
  const { workspaceId } = useWorkspace();
  const users = useQuery(api.users.listAll, { workspaceId });
  return users ?? [];
}
