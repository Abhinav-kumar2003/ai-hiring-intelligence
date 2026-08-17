"use client";

import { useEffect, useState } from "react";
import { dashboardApi } from "@/services/api";
import { useAppStore } from "@/store/app-store";
import type { DashboardStats } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Settings as SettingsIcon,
  LayoutDashboard,
  BarChart3,
  LogOut,
  Users,
  Brain,
  Calendar,
  Mail,
  User as UserIcon,
  Shield,
  Clock,
  Hash,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import { LoadingState } from "@/components/shared/states";

// =====================================================================
// ProfileView
// =====================================================================
export function ProfileView() {
  const { user, navigate, logout } = useAppStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await dashboardApi.stats();
      setStats(data);
    } catch (e: any) {
      // Don't fail the whole view if stats fail; show a soft warning.
      setError(e.message || "Failed to load profile stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const initials = (user?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const memberSince = user?.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "—";
  const memberSinceFull = user?.createdAt
    ? format(new Date(user.createdAt), "MMMM d, yyyy")
    : "—";

  const detailRows = [
    { icon: UserIcon, label: "Full Name", value: user?.name || "—" },
    { icon: Mail, label: "Email Address", value: user?.email || "—" },
    {
      icon: Shield,
      label: "Role",
      value: (
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "—"}
        </Badge>
      ),
    },
    { icon: Calendar, label: "Account Created", value: memberSince },
    { icon: Clock, label: "Last Updated", value: "Not available" },
    {
      icon: Hash,
      label: "User ID",
      value: user?.id ? (
        <span className="font-mono text-xs" title={user.id}>
          {user.id.length > 16 ? `${user.id.slice(0, 8)}…${user.id.slice(-4)}` : user.id}
        </span>
      ) : "—",
    },
  ];

  const quickActions = [
    {
      icon: SettingsIcon,
      title: "Edit Settings",
      description: "Manage your account preferences",
      onClick: () => navigate("settings"),
      color: "text-emerald-600",
      bg: "bg-emerald-100 dark:bg-emerald-950",
    },
    {
      icon: LayoutDashboard,
      title: "View Dashboard",
      description: "See your hiring overview",
      onClick: () => navigate("dashboard"),
      color: "text-teal-600",
      bg: "bg-teal-100 dark:bg-teal-950",
    },
    {
      icon: BarChart3,
      title: "View Analytics",
      description: "Explore hiring insights",
      onClick: () => navigate("analytics"),
      color: "text-amber-600",
      bg: "bg-amber-100 dark:bg-amber-950",
    },
    {
      icon: LogOut,
      title: "Logout",
      description: "Sign out of your account",
      onClick: () => logout(),
      color: "text-red-600",
      bg: "bg-red-100 dark:bg-red-950",
    },
  ];

  if (loading && !user) {
    return <LoadingState message="Loading profile..." />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Profile</h1>
        <p className="text-sm text-muted-foreground">View and manage your profile information.</p>
      </div>

      {/* Profile header card */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Gradient banner */}
          <div className="h-24 bg-gradient-to-r from-emerald-500 to-teal-600 sm:h-28" />
          {/* Avatar + info */}
          <div className="px-6 pb-6">
            <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end sm:gap-4">
                <Avatar className="h-24 w-24 ring-4 ring-background sm:h-28 sm:w-28">
                  {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} /> : null}
                  <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-2xl font-bold text-white sm:text-3xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="pb-1 text-center sm:text-left">
                  <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center">
                    <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                      {user?.name || "User"}
                    </h2>
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Recruiter"}
                    </Badge>
                  </div>
                  <p className="mt-1 flex items-center justify-center text-sm text-muted-foreground sm:justify-start">
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                    {user?.email || "—"}
                  </p>
                  <p className="mt-1 flex items-center justify-center text-xs text-muted-foreground sm:justify-start">
                    <Calendar className="mr-1.5 h-3 w-3" /> Member since {memberSinceFull}
                  </p>
                </div>
              </div>
              <Button onClick={() => navigate("settings")} variant="outline" className="w-full sm:w-auto">
                <SettingsIcon className="mr-2 h-4 w-4" /> Edit Profile
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main grid: stats + details (left) and quick actions (right) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: stats + details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Profile stats card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile Stats</CardTitle>
              <CardDescription>Your activity at a glance.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-lg border p-4">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <Skeleton className="mt-3 h-6 w-16" />
                      <Skeleton className="mt-1 h-3 w-20" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <AlertCircle className="h-8 w-8 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium">{error}</p>
                    <p className="text-xs text-muted-foreground">Stats could not be loaded.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={load}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatTile
                    icon={Users}
                    label="Candidates Managed"
                    value={stats?.stats.totalCandidates ?? 0}
                    color="text-emerald-600"
                    bg="bg-emerald-100 dark:bg-emerald-950"
                  />
                  <StatTile
                    icon={Brain}
                    label="Predictions Run"
                    value={stats?.stats.totalPredictions ?? 0}
                    color="text-teal-600"
                    bg="bg-teal-100 dark:bg-teal-950"
                  />
                  <StatTile
                    icon={Calendar}
                    label="Member Since"
                    value={memberSince}
                    color="text-amber-600"
                    bg="bg-amber-100 dark:bg-amber-950"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profile details card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile Details</CardTitle>
              <CardDescription>Your account information.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {detailRows.map((row, idx) => {
                  const Icon = row.icon;
                  return (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">{row.label}</p>
                        <div className="mt-0.5 truncate text-sm font-medium">
                          {row.value}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: quick actions */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
              <CardDescription>Navigate or sign out.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action, idx) => {
                const Icon = action.icon;
                return (
                  <div key={idx}>
                    <button
                      type="button"
                      onClick={action.onClick}
                      className="group flex w-full items-center gap-3 rounded-lg p-3 text-left transition-all hover:bg-muted/60"
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${action.bg}`}>
                        <Icon className={`h-4 w-4 ${action.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{action.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{action.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                    {idx < quickActions.length - 1 && <Separator className="my-0" />}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Stat tile helper component
// ---------------------------------------------------------------------
interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color: string;
  bg: string;
}

function StatTile({ icon: Icon, label, value, color, bg }: StatTileProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <p className="mt-3 text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
