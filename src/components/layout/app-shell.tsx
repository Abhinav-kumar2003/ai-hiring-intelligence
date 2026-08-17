"use client";
import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import { Sidebar } from "./sidebar";
import { Navbar } from "./navbar";
import { LoginView } from "@/components/views/login-view";
import { LoadingState } from "@/components/shared/states";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, authInitialized, authLoading, initializeAuth } = useAppStore();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  if (!authInitialized || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState message="Initializing AI Hiring Intelligence..." />
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col md:pl-64">
        <Navbar />
        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
        <footer className="border-t bg-card px-6 py-4 text-center text-xs text-muted-foreground">
          <p>
            AI Hiring Intelligence ·{" "}
            <span>Decision-support tool only — not an autonomous hiring system.</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
