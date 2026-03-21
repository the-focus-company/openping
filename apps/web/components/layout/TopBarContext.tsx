"use client";

import { createContext, ReactNode, useState, useCallback, useMemo } from "react";

export interface TopBarContextValue {
  title: ReactNode | null;
  setTitle: (title: ReactNode | null) => void;
  subtitle: ReactNode | null;
  setSubtitle: (subtitle: ReactNode | null) => void;
}

export const TopBarContext = createContext<TopBarContextValue | null>(null);

export function TopBarProvider({ children }: { children: ReactNode }) {
  const [title, setTitleState] = useState<ReactNode | null>(null);
  const [subtitle, setSubtitleState] = useState<ReactNode | null>(null);

  const setTitle = useCallback((t: ReactNode | null) => setTitleState(t), []);
  const setSubtitle = useCallback((s: ReactNode | null) => setSubtitleState(s), []);

  const value = useMemo(
    () => ({ title, setTitle, subtitle, setSubtitle }),
    [title, setTitle, subtitle, setSubtitle],
  );

  return (
    <TopBarContext.Provider value={value}>{children}</TopBarContext.Provider>
  );
}
