"use client";

import { useContext } from "react";
import { TopBarContext, type TopBarContextValue } from "@/components/layout/TopBarContext";

export function useTopBar(): TopBarContextValue {
  const context = useContext(TopBarContext);
  if (!context) {
    throw new Error("useTopBar must be used within a TopBarProvider");
  }
  return context;
}
