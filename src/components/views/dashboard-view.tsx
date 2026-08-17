"use client";
import { useEffect, useState } from "react";
import { dashboardApi } from "@/services/api";
import { useAppStore } from "@/store/app-store";
import type { DashboardStats } from "@/types";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, UserX, TrendingUp, FileSearch, Plus, BarChart3, Upload, Zap, ArrowRight, Clock } from "lucide-react";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/states";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, AreaChart, Area,
} from "recharts";
import { formatDistanceToNow } from "date-fns";

const HIRE_COLOR = "#10b981";
const REJECT_COLOR = "#ef4444";

export function DashboardView() {
  const { user, navigate } = useAppStore();
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
      setError(e.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const trendData = (stats?.trend || []).map((t) => ({
    date: t.date.slice(5), // MM-DD
    Hired: t.hired,
    Rejected: t.rejected,
    Total: t.total,
  }));

  const hiringDistribution = stats ? [
    { name: "Hired", value: stats.stats.hired, color: HIRE_COLOR },
    { name: "Rejected", value: stats.stats.rejected, color: REJECT_COLOR },
  ] : [];

  const roleData = (stats?.hiringByRole || []).slice(0, 6).map((r) => ({
    role: r.role.length > 12 ? r.role.slice(0, 12) + "…" : r.role,
    Hired: r.hired,
    Rejected: r.rejected,
  }));

  const expData = (stats?.experienceDistribution || []).map((e) => ({
    range: e.range,
    count: e.count,
  }));

  if (loading) return <LoadingState message="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {user?.name?.split(" ")[0] || "Recruiter"}. Here&apos;s your hiring overview.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("screening")}>
            <FileSearch className="mr-2 h-4 w-4" /> Screen Resume
          </Button>
          <Button onClick={() => navigate("screening")}>
            <Plus className="mr-2 h-4 w-4" /> Add Candidate
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total Candidates"
          value={stats?.stats.totalCandidates ?? 0}
          trend="up"
          trendValue="+12%"
          trendLabel="this month"
          iconColor="text-blue-600"
          iconBg="bg-blue-100 dark:bg-blue-950"
          loading={!stats}
        />
        <StatCard
          icon={UserCheck}
          label="Hired"
          value={stats?.stats.hired ?? 0}
          trend="up"
          trendValue={`${((stats?.stats.hireRate ?? 0) * 100).toFixed(1)}%`}
          trendLabel="hire rate"
          iconColor="text-emerald-600"
          iconBg="bg-emerald-100 dark:bg-emerald-950"
          loading={!stats}
        />
        <StatCard
          icon={UserX}
          label="Rejected"
          value={stats?.stats.rejected ?? 0}
          trend="down"
          trendValue={`${stats?.stats.rejected ?? 0}`}
          trendLabel="total"
          iconColor="text-red-600"
          iconBg="bg-red-100 dark:bg-red-950"
          loading={!stats}
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Hiring Probability"
          value={`${((stats?.stats.avgHireProbability ?? 0) * 100).toFixed(1)}%`}
          trend="up"
          trendValue="+2.3%"
          trendLabel="vs last week"
          iconColor="text-amber-600"
          iconBg="bg-amber-100 dark:bg-amber-950"
          loading={!stats}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Hiring overview donut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hiring Overview</CardTitle>
            <CardDescription>Distribution of predictions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={hiringDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {hiringDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold">{stats?.stats.totalCandidates ?? 0}</span>
                <span className="text-xs text-muted-foreground">Total Candidates</span>
              </div>
            </div>
            <div className="mt-4 flex justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: HIRE_COLOR }} />
                <span>Hired ({stats?.stats.hired ?? 0})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: REJECT_COLOR }} />
                <span>Rejected ({stats?.stats.rejected ?? 0})</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hiring trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Hiring Trend</CardTitle>
              <CardDescription>Last 30 days</CardDescription>
            </div>
            <div className="flex gap-1 text-xs">
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">Hired</Badge>
              <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">Rejected</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorHired" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={HIRE_COLOR} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={HIRE_COLOR} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRejected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={REJECT_COLOR} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={REJECT_COLOR} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="Hired" stroke={HIRE_COLOR} strokeWidth={2} fill="url(#colorHired)" />
                  <Area type="monotone" dataKey="Rejected" stroke={REJECT_COLOR} strokeWidth={2} fill="url(#colorRejected)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Hiring by role */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hiring by Job Role</CardTitle>
            <CardDescription>Hired vs Rejected per role</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roleData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="role" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Hired" stackId="a" fill={HIRE_COLOR} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Rejected" stackId="a" fill={REJECT_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Experience distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Experience Distribution</CardTitle>
            <CardDescription>Candidates by experience range</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" name="Candidates" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Upload, title: "Upload Resume", desc: "Parse and screen a resume", view: "screening" as const, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-950" },
          { icon: Plus, title: "Add Candidate", desc: "Manually add a candidate", view: "screening" as const, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950" },
          { icon: Zap, title: "Run Prediction", desc: "Analyze a candidate", view: "screening" as const, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-950" },
          { icon: BarChart3, title: "View Analytics", desc: "Explore hiring insights", view: "analytics" as const, color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-950" },
        ].map((a) => (
          <Card
            key={a.title}
            className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
            onClick={() => navigate(a.view)}
          >
            <CardContent className="flex items-start gap-3 p-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${a.bg}`}>
                <a.icon className={`h-5 w-5 ${a.color}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent candidates */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent Candidates</CardTitle>
            <CardDescription>Latest added candidates</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("candidates")}>
            View all <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent className="overflow-hidden">
          {(stats?.recentCandidates?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Users}
              title="No candidates yet"
              description="Upload your first resume to start analyzing candidates."
              actionLabel="Upload Resume"
              onAction={() => navigate("screening")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Candidate</th>
                    <th className="pb-2 font-medium">Role</th>
                    <th className="hidden pb-2 font-medium md:table-cell">Experience</th>
                    <th className="pb-2 font-medium">Prediction</th>
                    <th className="pb-2 font-medium">Probability</th>
                    <th className="hidden pb-2 font-medium sm:table-cell">Date</th>
                    <th className="pb-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.recentCandidates.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-semibold text-white">
                            {c.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                          </div>
                          <span className="font-medium">{c.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-muted-foreground">{c.jobRole}</td>
                      <td className="hidden py-3 text-muted-foreground md:table-cell">{c.experience} yrs</td>
                      <td className="py-3">
                        {c.prediction ? (
                          <Badge variant="secondary" className={c.prediction === "Hired"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                            : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                          }>
                            {c.prediction}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">PENDING</Badge>
                        )}
                      </td>
                      <td className="py-3">
                        {c.hireProbability !== null ? `${(c.hireProbability * 100).toFixed(0)}%` : "—"}
                      </td>
                      <td className="hidden py-3 text-xs text-muted-foreground sm:table-cell">
                        <Clock className="mr-1 inline h-3 w-3" />
                        {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                      </td>
                      <td className="py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => navigate("candidate-details", { candidateId: c.id })}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
