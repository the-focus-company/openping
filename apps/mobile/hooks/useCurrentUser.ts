import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

export function useCurrentUser() {
  const user = useQuery(api.users.getMe);
  return {
    user: user ?? null,
    isLoading: user === undefined,
  };
}
