"use client";
import { useEffect, Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAppStore } from "@/store/app-store";
import { DashboardView } from "@/components/views/dashboard-view";
import { CandidatesView } from "@/components/views/candidates-view";
import { CandidateDetailsView } from "@/components/views/candidate-details-view";
import { ScreeningView } from "@/components/views/screening-view";
import { PredictionResultView } from "@/components/views/prediction-result-view";
import { PredictionsView } from "@/components/views/predictions-view";
import { AnalyticsView } from "@/components/views/analytics-view";
import { ModelPerformanceView } from "@/components/views/model-performance-view";
import { ComparisonView } from "@/components/views/comparison-view";
import { SettingsView } from "@/components/views/settings-view";
import { ProfileView } from "@/components/views/profile-view";
import { LoadingState } from "@/components/shared/states";
import { useTheme } from "next-themes";

function ViewRouter() {
  const view = useAppStore((s) => s.view);

  switch (view) {
    case "dashboard": return <DashboardView />;
    case "candidates": return <CandidatesView />;
    case "candidate-details": return <CandidateDetailsView />;
    case "screening": return <ScreeningView />;
    case "prediction-result": return <PredictionResultView />;
    case "predictions": return <PredictionsView />;
    case "analytics": return <AnalyticsView />;
    case "model-performance": return <ModelPerformanceView />;
    case "comparison": return <ComparisonView />;
    case "settings": return <SettingsView />;
    case "profile": return <ProfileView />;
    default: return <DashboardView />;
  }
}

export default function Home() {
  const { theme } = useTheme();
  // Ensure chart colors re-render when theme changes
  useEffect(() => {}, [theme]);

  return (
    <AppShell>
      <Suspense fallback={<LoadingState message="Loading view..." />}>
        <ViewRouter />
      </Suspense>
    </AppShell>
  );
}
