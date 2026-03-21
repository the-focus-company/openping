"use client";

import {
  createContext,
  ReactNode,
  useEffect,
  useState,
} from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";

interface User {
  _id: Id<"users">;
  workosUserId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: "admin" | "member";
  workspaceId: Id<"workspaces">;
  status: "active" | "invited" | "deactivated";
  lastSeenAt?: number;
}

interface AuthContextValue {
  currentUser: User | null;
  isLoading: boolean;
  workspaceId: Id<"workspaces"> | null;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue>({
  currentUser: null,
  isLoading: true,
  workspaceId: null,
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const currentUser = useQuery(api.users.getMe) as User | null | undefined;
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (currentUser !== undefined) {
      setIsLoading(false);
    }
  }, [currentUser]);

  const logout = () => {
    window.location.href = "/sign-out";
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser: currentUser ?? null,
        isLoading,
        workspaceId: currentUser?.workspaceId ?? null,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
