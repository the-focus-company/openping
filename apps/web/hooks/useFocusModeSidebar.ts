import { useEffect, useRef } from "react";
import { useSidebar } from "@/hooks/useSidebar";

/** Collapse sidebar when focus mode activates, restore on exit. */
export function useFocusModeSidebar(focusMode: boolean) {
  const { setSidebarOpen } = useSidebar();
  const prevSidebarRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (focusMode) {
      if (prevSidebarRef.current === null) prevSidebarRef.current = true;
      setSidebarOpen(false);
    } else {
      if (prevSidebarRef.current !== null) {
        setSidebarOpen(prevSidebarRef.current);
        prevSidebarRef.current = null;
      }
    }
  }, [focusMode, setSidebarOpen]);
}
