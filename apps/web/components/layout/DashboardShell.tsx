"use client";

import { ReactNode, useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { SIDEBAR_WIDTH } from "@/lib/constants";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed z-30 h-full transition-transform duration-200 md:relative md:z-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full md:-translate-x-full"
        }`}
        style={{ width: SIDEBAR_WIDTH }}
      >
        <Sidebar />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
