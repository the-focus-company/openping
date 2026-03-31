import { ReactNode, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useConvexAuth } from "convex/react";
import { WorkspaceContext, useWorkspaceData } from "@/hooks/useWorkspace";
import type { Id } from "@convex/_generated/dataModel";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const { workspaces, isLoading } = useWorkspaceData();
  const [selectedId, setSelectedId] = useState<Id<"workspaces"> | null>(null);

  const switchWorkspace = useCallback((id: Id<"workspaces">) => {
    setSelectedId(id);
  }, []);

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  if (!workspaces || workspaces.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>No workspace found</Text>
        <Text style={styles.subtext}>
          Please join a workspace from the web app first.
        </Text>
      </View>
    );
  }

  const workspace =
    (selectedId && workspaces.find((w) => w.workspaceId === selectedId)) ||
    workspaces[0];

  return (
    <WorkspaceContext.Provider
      value={{
        workspaceId: workspace.workspaceId,
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
        role: workspace.role,
        switchWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  text: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  subtext: {
    color: "#888",
    fontSize: 14,
  },
});
