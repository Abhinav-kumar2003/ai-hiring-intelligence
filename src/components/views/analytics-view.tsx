"use client";
import { useCallback, useEffect, useState } from "react";
import { analyticsApi } from "@/services/api";
import type { AnalyticsData } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/states";
import { StatCard } from "@/components/shared/stat-card";
import {
  Users,
  TrendingUp,
  Clock,
  FolderKanban,
  DollarSign,
  Target,
  Filter,
  X,
  BarChart3,
  Briefcase,
  GraduationCap,
  Award,
  FolderGit2,
  DollarSign as DollarIcon,
  Sparkles,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Line,
} from "recharts";

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------
const HIRE_COLOR = "#10b981"; // emerald-500
const REJECT_COLOR = "#ef4444"; // red-500
const HIRE_RATE_COLOR = "#f59e0b"; // amber-500 (line on composed chart)

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--card-foreground))",
};

const ROLE_OPTIONS = ["AI Researcher", "Cybersecurity Analyst", "Data Scientist", "Software Engineer"];
const EDU_OPTIONS = ["B.Sc", "B.Tech", "M.Tech", "MBA", "PhD"];
const EXP_OPTIONS = ["0-2", "3-5", "6-10", "10+"];
const PRED_OPTIONS = ["Hired", "Rejected"];

const DATE_RANGES = [
  { value: "30", label: "30D" },
  { value: "90", label: "90D" },
  { value: "365", label: "1Y" },
];

interface FilterState {
  jobRole: string;
  education: string;
  experience: string;
  prediction: string;
  days: number;
}

const DEFAULT_FILTERS: FilterState = {
  jobRole: "all",
  education: "all",
  experience: "all",
  prediction: "all",
  days: 90,
};

// ----------------------------------------------------------------------------
// Small helpers
// ----------------------------------------------------------------------------
function ChartCard({
  title,
  description,
  children,
  action,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`overflow-hidden ${className ?? ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return <Skeleton className="h-72 w-full rounded-md" />;
}

function truncate(value: string, max = 14) {
  return value.length > max ? value.slice(0, max) + "…" : value;
}

function formatCurrency(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

// ----------------------------------------------------------------------------
// Filter bar
// ----------------------------------------------------------------------------
function FiltersBar({
  filters,
  onChange,
  onClear,
  hasFilters,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onClear: () => void;
  hasFilters: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            {/* Date Range */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Date Range</label>
              <ToggleGroup
                type="single"
                value={String(filters.days)}
                onValueChange={(v) => {
                  if (v) onChange({ ...filters, days: parseInt(v, 10) });
                }}
                variant="outline"
                size="sm"
              >
                {DATE_RANGES.map((d) => (
                  <ToggleGroupItem key={d.value} value={d.value} aria-label={d.label}>
                    {d.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {/* Job Role */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Job Role</label>
              <Select
                value={filters.jobRole}
                onValueChange={(v) => onChange({ ...filters, jobRole: v })}
              >
                <SelectTrigger className="h-9 w-[170px]">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Education */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Education</label>
              <Select
                value={filters.education}
                onValueChange={(v) => onChange({ ...filters, education: v })}
              >
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder="All education" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Education</SelectItem>
                  {EDU_OPTIONS.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Experience */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Experience</label>
              <Select
                value={filters.experience}
                onValueChange={(v) => onChange({ ...filters, experience: v })}
              >
                <SelectTrigger className="h-9 w-[130px]">
                  <SelectValue placeholder="All experience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Experience</SelectItem>
                  {EXP_OPTIONS.map((e) => (
                    <SelectItem key={e} value={e}>{e} yrs</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Prediction */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Prediction</label>
              <Select
                value={filters.prediction}
                onValueChange={(v) => onChange({ ...filters, prediction: v })}
              >
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder="All predictions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Predictions</SelectItem>
                  {PRED_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p.toLowerCase()}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={onClear} disabled={!hasFilters} className="shrink-0">
            <X className="mr-1.5 h-3.5 w-3.5" /> Clear Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Custom legend for hiring distribution donut
// ----------------------------------------------------------------------------
function HiringLegend({
  hired,
  rejected,
}: {
  hired: number;
  rejected: number;
}) {
  const total = hired + rejected;
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
      <div className="flex items-center justify-center gap-2 rounded-md bg-emerald-50 py-2 dark:bg-emerald-950/40">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: HIRE_COLOR }} />
        <span className="font-medium">Hired</span>
        <span className="text-muted-foreground">
          {hired} {total > 0 && `(${((hired / total) * 100).toFixed(1)}%)`}
        </span>
      </div>
      <div className="flex items-center justify-center gap-2 rounded-md bg-red-50 py-2 dark:bg-red-950/40">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: REJECT_COLOR }} />
        <span className="font-medium">Rejected</span>
        <span className="text-muted-foreground">
          {rejected} {total > 0 && `(${((rejected / total) * 100).toFixed(1)}%)`}
        </span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Main view
// ----------------------------------------------------------------------------
export function AnalyticsView() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await analyticsApi.get(filters);
      setData(result);
    } catch (e: any) {
      setError(e?.message || "Failed to load analytics data.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const hasFilters =
    filters.jobRole !== "all" ||
    filters.education !== "all" ||
    filters.experience !== "all" ||
    filters.prediction !== "all" ||
    filters.days !== DEFAULT_FILTERS.days;

  const cards = data?.cards;
  const hiringDistribution = data?.hiringDistribution ?? [];
  const hiredCount = hiringDistribution.find((d) => d.name === "Hired")?.value ?? 0;
  const rejectedCount = hiringDistribution.find((d) => d.name === "Rejected")?.value ?? 0;

  const roleData = (data?.hiringByRole ?? []).map((r) => ({
    role: truncate(r.role, 14),
    Hired: r.hired,
    Rejected: r.rejected,
  }));

  const eduData = (data?.hiringByEducation ?? []).map((e) => ({
    education: truncate(e.education, 12),
    Hired: e.hired,
    Rejected: e.rejected,
  }));

  const experienceData = (data?.experienceVsHiring ?? []).map((e) => ({
    range: e.range,
    Hired: e.hired,
    Rejected: e.rejected,
    "Hire Rate": +(e.hireRate * 100).toFixed(1),
  }));

  const certData = (data?.certVsHiring ?? []).map((c) => {
    const rejected = c.total - c.hired;
    return {
      name: truncate(c.name, 14),
      Hired: c.hired,
      Rejected: rejected,
    };
  });

  const projectsData = (data?.projectsVsHiring ?? []).map((p) => ({
    range: p.range,
    Hired: p.hired,
    Rejected: p.rejected,
    "Hire Rate": +(p.hireRate * 100).toFixed(1),
  }));

  const salaryData = (data?.salaryVsHiring ?? []).map((s) => ({
    range: s.range,
    Hired: s.hired,
    Rejected: s.rejected,
    "Hire Rate": +(s.hireRate * 100).toFixed(1),
  }));

  const skillsData = (data?.topSkills ?? []).slice(0, 12).map((s) => ({
    skill: s.skill,
    count: s.count,
  }));

  const totalCandidates = cards?.totalCandidates ?? 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <BarChart3 className="h-7 w-7 text-emerald-600" />
            Hiring Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Understand candidate trends and hiring patterns.
          </p>
        </div>
        {data && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>
              Last {filters.days} days · {totalCandidates} candidates
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <FiltersBar
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters(DEFAULT_FILTERS)}
        hasFilters={hasFilters}
      />

      {/* Loading */}
      {loading && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-7 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-60" />
                </CardHeader>
                <CardContent>
                  <ChartSkeleton />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <ErrorState
          title="Couldn't load analytics"
          message={error}
          onRetry={load}
        />
      )}

      {/* Content */}
      {!loading && !error && data && totalCandidates === 0 && (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={Filter}
              title="No candidates match these filters"
              description="Try widening the date range, clearing individual filters, or resetting all filters at once."
              actionLabel="Clear all filters"
              onAction={() => setFilters(DEFAULT_FILTERS)}
              className="py-8"
            />
          </CardContent>
        </Card>
      )}

      {!loading && !error && data && totalCandidates > 0 && (
        <>
          {/* Analytics cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              icon={Users}
              label="Total Candidates"
              value={cards?.totalCandidates ?? 0}
              iconColor="text-blue-600"
              iconBg="bg-blue-100 dark:bg-blue-950"
            />
            <StatCard
              icon={TrendingUp}
              label="Hiring Rate"
              value={`${((cards?.hiringRate ?? 0) * 100).toFixed(1)}%`}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-100 dark:bg-emerald-950"
            />
            <StatCard
              icon={Clock}
              label="Avg Experience"
              value={`${(cards?.averageExperience ?? 0).toFixed(1)} yrs`}
              iconColor="text-amber-600"
              iconBg="bg-amber-100 dark:bg-amber-950"
            />
            <StatCard
              icon={FolderKanban}
              label="Avg Projects"
              value={(cards?.averageProjects ?? 0).toFixed(1)}
              iconColor="text-purple-600"
              iconBg="bg-purple-100 dark:bg-purple-950"
            />
            <StatCard
              icon={DollarSign}
              label="Avg Salary Expectation"
              value={formatCurrency(cards?.averageSalary ?? 0)}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-100 dark:bg-emerald-950"
            />
            <StatCard
              icon={Target}
              label="Avg Hiring Probability"
              value={`${((cards?.averageHireProbability ?? 0) * 100).toFixed(1)}%`}
              iconColor="text-rose-600"
              iconBg="bg-rose-100 dark:bg-rose-950"
            />
          </div>

          {/* Charts grid */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* 1. Hiring Distribution (donut) */}
            <ChartCard
              title="Hiring Distribution"
              description="Overall hired vs rejected counts"
            >
              <div className="relative h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={hiringDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={92}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {hiringDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: any, name: any) => [`${value} candidates`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold">{totalCandidates}</span>
                  <span className="text-xs text-muted-foreground">Total Candidates</span>
                </div>
              </div>
              <HiringLegend hired={hiredCount} rejected={rejectedCount} />
            </ChartCard>

            {/* 2. Hiring by Job Role */}
            <ChartCard
              title="Hiring by Job Role"
              description="Hired vs rejected per role"
              action={<Briefcase className="h-4 w-4 text-muted-foreground" />}
            >
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={roleData} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                    <XAxis dataKey="role" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Hired" stackId="a" fill={HIRE_COLOR} />
                    <Bar dataKey="Rejected" stackId="a" fill={REJECT_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* 3. Hiring by Education */}
            <ChartCard
              title="Hiring by Education"
              description="Hired vs rejected per education level"
              action={<GraduationCap className="h-4 w-4 text-muted-foreground" />}
            >
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={eduData} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                    <XAxis dataKey="education" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Hired" stackId="a" fill={HIRE_COLOR} />
                    <Bar dataKey="Rejected" stackId="a" fill={REJECT_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* 4. Experience vs Hiring (composed: bars + line) */}
            <ChartCard
              title="Experience vs Hiring"
              description="Counts and hire rate per experience range"
              action={<Clock className="h-4 w-4 text-muted-foreground" />}
            >
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={experienceData} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" interval={0} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                      formatter={(value: any, name: any) =>
                        name === "Hire Rate" ? [`${value}%`, name] : [`${value} candidates`, name]
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="left" dataKey="Hired" stackId="a" fill={HIRE_COLOR} />
                    <Bar yAxisId="left" dataKey="Rejected" stackId="a" fill={REJECT_COLOR} radius={[4, 4, 0, 0]} />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="Hire Rate"
                      stroke={HIRE_RATE_COLOR}
                      strokeWidth={2}
                      dot={{ r: 3, fill: HIRE_RATE_COLOR }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* 5. Certifications vs Hiring */}
            <ChartCard
              title="Certifications vs Hiring"
              description="Hired vs rejected by certification status"
              action={<Award className="h-4 w-4 text-muted-foreground" />}
            >
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={certData} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Hired" stackId="a" fill={HIRE_COLOR} />
                    <Bar dataKey="Rejected" stackId="a" fill={REJECT_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* 6. Projects vs Hiring */}
            <ChartCard
              title="Projects vs Hiring"
              description="Hired vs rejected per project count range"
              action={<FolderGit2 className="h-4 w-4 text-muted-foreground" />}
            >
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectsData} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                      formatter={(value: any, name: any) =>
                        name === "Hire Rate" ? [`${value}%`, name] : [`${value} candidates`, name]
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Hired" stackId="a" fill={HIRE_COLOR} />
                    <Bar dataKey="Rejected" stackId="a" fill={REJECT_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* 7. Salary vs Hiring */}
            <ChartCard
              title="Salary vs Hiring"
              description="Hired vs rejected per salary range"
              action={<DollarIcon className="h-4 w-4 text-muted-foreground" />}
            >
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salaryData} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                      formatter={(value: any, name: any) =>
                        name === "Hire Rate" ? [`${value}%`, name] : [`${value} candidates`, name]
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Hired" stackId="a" fill={HIRE_COLOR} />
                    <Bar dataKey="Rejected" stackId="a" fill={REJECT_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            {/* 8. Top Skills (horizontal bar) */}
            <ChartCard
              title="Top Skills"
              description="Most common skills across candidates"
              action={<Sparkles className="h-4 w-4 text-muted-foreground" />}
              className="lg:col-span-2"
            >
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={skillsData}
                    layout="vertical"
                    margin={{ left: 20, right: 20, top: 4, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="skill"
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      width={140}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                      formatter={(value: any) => [`${value} candidates`, "Count"]}
                    />
                    <Bar dataKey="count" name="Candidates" fill={HIRE_COLOR} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
