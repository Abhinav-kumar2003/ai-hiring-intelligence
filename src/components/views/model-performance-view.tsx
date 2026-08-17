"use client";
import { useEffect, useState } from "react";
import { modelApi } from "@/services/api";
import type { ModelMetrics, FeatureImportance, ModelInfo } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { LoadingState, ErrorState } from "@/components/shared/states";
import {
  Target,
  Crosshair,
  Activity,
  Zap,
  TrendingUp,
  Cpu,
  Calendar,
  Database,
  Boxes,
  ShieldAlert,
  ChevronDown,
  SlidersHorizontal,
  GitBranch,
  Layers,
  ListChecks,
  Sparkles,
  Gauge,
  FileWarning,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from "recharts";

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------
const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--card-foreground))",
};

// Fixed color per model (deterministic, not order-based) so the legend stays
// stable across renders. Emerald reserved for the production model.
const MODEL_COLORS: Record<string, string> = {
  "Random Forest (Tuned)": "#10b981", // emerald
  "Random Forest": "#14b8a6",         // teal
  "Gradient Boosting": "#8b5cf6",     // purple
  "Logistic Regression": "#f59e0b",   // amber
  "Decision Tree": "#06b6d4",         // cyan
  KNN: "#ec4899",                     // pink
  "Dummy (Most Frequent)": "#94a3b8", // slate
};
const FALLBACK_PALETTE = ["#10b981", "#14b8a6", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#94a3b8"];

const METRIC_KEYS = [
  { key: "accuracy", label: "Accuracy" },
  { key: "precision", label: "Precision" },
  { key: "recall", label: "Recall" },
  { key: "f1", label: "F1 Score" },
  { key: "roc_auc", label: "ROC-AUC" },
] as const;

const METRIC_META: Record<string, { icon: typeof Target; color: string; bg: string }> = {
  accuracy: { icon: Target, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950" },
  precision: { icon: Crosshair, color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-950" },
  recall: { icon: Activity, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-950" },
  f1: { icon: Zap, color: "text-rose-600", bg: "bg-rose-100 dark:bg-rose-950" },
  roc_auc: { icon: TrendingUp, color: "text-teal-600", bg: "bg-teal-100 dark:bg-teal-950" },
};

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function pct(v: number | undefined, digits = 1) {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

function modelColor(name: string, idx: number) {
  return MODEL_COLORS[name] ?? FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
}

function humanizeFeature(name: string) {
  return name
    .replace(/_/g, " ")
    .replace(/^(Role|Education|Cert)\s+/, "$1: ")
    .trim();
}

// ----------------------------------------------------------------------------
// Model info mini-card
// ----------------------------------------------------------------------------
function InfoMiniCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Cpu;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-950">
        <Icon className="h-4 w-4 text-emerald-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-base font-semibold">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Performance metric card with progress bar
// ----------------------------------------------------------------------------
function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: number;
  icon: typeof Target;
  color: string;
  bg: string;
}) {
  const pctVal = value * 100;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{pct(value)}</p>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          <Progress value={pctVal} className="h-2" />
          <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Section card with title + description + icon
// ----------------------------------------------------------------------------
function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: typeof Cpu;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            {Icon && (
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-950">
                <Icon className="h-4 w-4 text-emerald-600" />
              </div>
            )}
            <div className="space-y-1">
              <CardTitle className="text-base">{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Loading skeleton
// ----------------------------------------------------------------------------
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Confusion matrix cell
// ----------------------------------------------------------------------------
function MatrixCell({
  label,
  value,
  total,
  max,
  isCorrect,
}: {
  label: string;
  value: number;
  total: number;
  max: number;
  isCorrect: boolean;
}) {
  const intensity = max > 0 ? 0.18 + 0.62 * (value / max) : 0.18;
  const bg = isCorrect
    ? `rgba(16, 185, 129, ${intensity})`
    : `rgba(239, 68, 68, ${intensity})`;
  const pctVal = total > 0 ? (value / total) * 100 : 0;
  const lightText = intensity > 0.45;
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg p-4 text-center transition-colors"
      style={{ backgroundColor: bg }}
    >
      <span className={`text-xs font-medium uppercase tracking-wide ${lightText ? "text-white/80" : "text-muted-foreground"}`}>
        {label}
      </span>
      <span className={`mt-1 text-2xl font-bold ${lightText ? "text-white" : ""}`}>
        {value}
      </span>
      <span className={`text-xs ${lightText ? "text-white/80" : "text-muted-foreground"}`}>
        {pctVal.toFixed(1)}%
      </span>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Main view
// ----------------------------------------------------------------------------
export function ModelPerformanceView() {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [features, setFeatures] = useState<FeatureImportance | null>(null);
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [m, f, i] = await Promise.all([
        modelApi.metrics(),
        modelApi.features(),
        modelApi.info(),
      ]);
      setMetrics(m);
      setFeatures(f);
      setInfo(i);
    } catch (e: any) {
      setError(e?.message || "Failed to load model performance data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ------------------------------------------------------------------
  // Derived data
  // ------------------------------------------------------------------
  const productionModel = metrics?.production_model ?? info?.production_model ?? "";
  const prodMetrics = metrics?.all_models?.[productionModel];

  const modelNames = metrics ? Object.keys(metrics.all_models) : [];

  // Grouped bar chart data: one entry per metric, one bar per model
  const comparisonData = METRIC_KEYS.map(({ key, label }) => {
    const row: Record<string, any> = { metric: label };
    modelNames.forEach((name) => {
      row[name] = +(metrics!.all_models[name][key] * 100).toFixed(2);
    });
    return row;
  });

  // Confusion matrix
  const cm = metrics?.confusion_matrix;
  const cmTotal = cm ? cm.tn + cm.fp + cm.fn + cm.tp : 0;
  const cmMax = cm ? Math.max(cm.tn, cm.fp, cm.fn, cm.tp, 1) : 1;

  // ROC curve data
  const rocData = metrics
    ? metrics.roc_curve.fpr.map((fpr, i) => ({
        fpr,
        tpr: metrics.roc_curve.tpr[i],
      }))
    : [];
  const auc = metrics?.roc_curve.auc ?? 0;

  // Feature importance (gini), top 15
  const topFeatures = features
    ? [...features.gini_importance]
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 15)
        .map((f) => ({
          feature: humanizeFeature(f.feature),
          raw: f.feature,
          importance: +(f.importance * 100).toFixed(2),
        }))
        // reverse so largest renders on top in horizontal bar
        .reverse()
    : [];

  // Training date
  const trainingDate = info?.training_date ? new Date(info.training_date) : null;

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <Gauge className="h-7 w-7 text-emerald-600" />
            Model Performance
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor model accuracy, metrics, and feature importance.
          </p>
        </div>
        {info && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              <Sparkles className="mr-1 h-3 w-3" />
              {info.model_name}
            </Badge>
            <Badge variant="outline">v{info.model_version}</Badge>
            {trainingDate && (
              <Badge variant="outline" className="text-muted-foreground">
                <Calendar className="mr-1 h-3 w-3" />
                Trained {formatDistanceToNow(trainingDate, { addSuffix: true })}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && <LoadingSkeleton />}

      {/* Error */}
      {error && !loading && (
        <ErrorState
          title="Couldn't load model performance"
          message={error}
          onRetry={load}
        />
      )}

      {/* Content */}
      {!loading && !error && metrics && info && features && (
        <>
          {/* Model information */}
          <SectionCard
            title="Model Information"
            description="Production model metadata and training configuration"
            icon={Cpu}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <InfoMiniCard
                icon={Sparkles}
                label="Current Model"
                value={info.model_name}
              />
              <InfoMiniCard
                icon={GitBranch}
                label="Version"
                value={`v${info.model_version}`}
              />
              <InfoMiniCard
                icon={Database}
                label="Training Samples"
                value={info.training_samples.toLocaleString()}
                sub={`${info.dataset_size.toLocaleString()} total dataset`}
              />
              <InfoMiniCard
                icon={ListChecks}
                label="Test Samples"
                value={info.test_samples.toLocaleString()}
                sub={`${info.dataset_size > 0 ? ((info.test_samples / info.dataset_size) * 100).toFixed(0) : 0}% held-out`}
              />
              <InfoMiniCard
                icon={Layers}
                label="Features"
                value={info.features_count}
                sub={`${info.n_estimators ?? 0} estimators`}
              />
              <InfoMiniCard
                icon={Calendar}
                label="Training Date"
                value={trainingDate ? format(trainingDate, "MMM d, yyyy") : "—"}
                sub={trainingDate ? format(trainingDate, "HH:mm:ss") : ""}
              />
            </div>
          </SectionCard>

          {/* Performance metrics */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Performance Metrics</h2>
                <p className="text-sm text-muted-foreground">
                  Production model: <span className="font-medium text-foreground">{productionModel}</span>
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {METRIC_KEYS.map(({ key, label }) => {
                const meta = METRIC_META[key];
                const value = prodMetrics?.[key] ?? 0;
                return (
                  <MetricCard
                    key={key}
                    label={label}
                    value={value}
                    icon={meta.icon}
                    color={meta.color}
                    bg={meta.bg}
                  />
                );
              })}
            </div>
          </div>

          {/* Model comparison */}
          <SectionCard
            title="Model Comparison"
            description="Grouped metrics across all trained models"
            icon={TrendingUp}
          >
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <XAxis dataKey="metric" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                    formatter={(value: any, name: any) => [`${value}%`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
                  {modelNames.map((name, idx) => (
                    <Bar
                      key={name}
                      dataKey={name}
                      fill={modelColor(name, idx)}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={28}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Comparison table */}
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Model</TableHead>
                    {METRIC_KEYS.map(({ label }) => (
                      <TableHead key={label} className="text-right">{label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelNames.map((name) => {
                    const m = metrics.all_models[name];
                    const isProd = name === productionModel;
                    return (
                      <TableRow
                        key={name}
                        className={isProd ? "bg-emerald-50 dark:bg-emerald-950/30" : ""}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: modelColor(name, modelNames.indexOf(name)) }}
                            />
                            {name}
                            {isProd && (
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                                Production
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        {METRIC_KEYS.map(({ key }) => (
                          <TableCell key={key} className="text-right tabular-nums">
                            {pct(m[key])}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </SectionCard>

          {/* Confusion Matrix + ROC Curve */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Confusion Matrix */}
            <SectionCard
              title="Confusion Matrix"
              description={`Production model · ${cmTotal} test samples`}
              icon={Crosshair}
            >
              {cm && (
                <div className="space-y-3">
                  <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
                    {/* Top-left empty corner */}
                    <div />
                    {/* Column headers */}
                    <div className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Predicted: {cm.labels[0]}
                    </div>
                    <div className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Predicted: {cm.labels[1]}
                    </div>

                    {/* Row 1: Actual Reject */}
                    <div className="flex items-center justify-end pr-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <span className="rotate-0 text-right">Actual: {cm.labels[0]}</span>
                    </div>
                    <MatrixCell
                      label="TN"
                      value={cm.tn}
                      total={cmTotal}
                      max={cmMax}
                      isCorrect
                    />
                    <MatrixCell
                      label="FP"
                      value={cm.fp}
                      total={cmTotal}
                      max={cmMax}
                      isCorrect={false}
                    />

                    {/* Row 2: Actual Hire */}
                    <div className="flex items-center justify-end pr-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Actual: {cm.labels[1]}
                    </div>
                    <MatrixCell
                      label="FN"
                      value={cm.fn}
                      total={cmTotal}
                      max={cmMax}
                      isCorrect={false}
                    />
                    <MatrixCell
                      label="TP"
                      value={cm.tp}
                      total={cmTotal}
                      max={cmMax}
                      isCorrect
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                    <div className="rounded-md border p-2">
                      <span className="font-semibold text-emerald-600">TN</span> · {cm.tn} correctly rejected
                    </div>
                    <div className="rounded-md border p-2">
                      <span className="font-semibold text-red-600">FP</span> · {cm.fp} false hires
                    </div>
                    <div className="rounded-md border p-2">
                      <span className="font-semibold text-red-600">FN</span> · {cm.fn} missed hires
                    </div>
                    <div className="rounded-md border p-2">
                      <span className="font-semibold text-emerald-600">TP</span> · {cm.tp} correctly hired
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>

            {/* ROC Curve */}
            <SectionCard
              title={`ROC Curve · AUC = ${auc.toFixed(4)}`}
              description="True positive rate vs false positive rate"
              icon={TrendingUp}
            >
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={rocData} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rocFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis
                      type="number"
                      dataKey="fpr"
                      domain={[0, 1]}
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v) => v.toFixed(1)}
                      label={{ value: "False Positive Rate", position: "insideBottom", offset: -2, style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }}
                    />
                    <YAxis
                      type="number"
                      dataKey="tpr"
                      domain={[0, 1]}
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v) => v.toFixed(1)}
                      label={{ value: "True Positive Rate", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))", textAnchor: "middle" } }}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: any, name: any) => [
                        value.toFixed(3),
                        name === "tpr" ? "TPR" : name,
                      ]}
                      labelFormatter={(label: any) => `FPR: ${Number(label).toFixed(3)}`}
                    />
                    <ReferenceLine
                      segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
                      stroke="#94a3b8"
                      strokeDasharray="4 4"
                      ifOverflow="extendDomain"
                    />
                    <Area
                      type="monotone"
                      dataKey="tpr"
                      name="ROC"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#rocFill)"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="inline-block h-2 w-4 align-middle" style={{ background: "repeating-linear-gradient(90deg, #94a3b8 0 4px, transparent 4px 8px)" }} />
                {"  "}Dashed line: random classifier (AUC = 0.5). Higher curve = better discrimination.
              </p>
            </SectionCard>
          </div>

          {/* Feature importance */}
          <SectionCard
            title="Feature Importance"
            description="Top 15 features by Gini importance"
            icon={SlidersHorizontal}
          >
            <div className="h-[28rem] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topFeatures}
                  layout="vertical"
                  margin={{ left: 20, right: 30, top: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v) => `${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="feature"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    width={170}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                    formatter={(value: any) => [`${value}%`, "Gini Importance"]}
                  />
                  <Bar
                    dataKey="importance"
                    name="Gini Importance"
                    fill="#10b981"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          {/* Model details (collapsible) */}
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer pb-2 transition-colors hover:bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-950">
                        <Boxes className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-base">Model Details</CardTitle>
                        <CardDescription>
                          Training methodology, parameters, and ethical considerations
                        </CardDescription>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
                      />
                    </Button>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-5 pt-2">
                  {/* Methodology */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <h4 className="flex items-center gap-2 text-sm font-semibold">
                        <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-600" />
                        Training Methodology
                      </h4>
                      <p className="text-sm text-muted-foreground">{info.training_methodology}</p>
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="flex items-center gap-2 text-sm font-semibold">
                        <GitBranch className="h-3.5 w-3.5 text-emerald-600" />
                        Cross-Validation
                      </h4>
                      <p className="text-sm text-muted-foreground">{info.cross_validation}</p>
                      <p className="text-xs text-muted-foreground">
                        Best CV score:{" "}
                        <span className="font-medium text-foreground">
                          {pct(metrics.cv_best_score)}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Best params + scaler + encoding */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <h4 className="flex items-center gap-2 text-sm font-semibold">
                        <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-600" />
                        Best Parameters
                      </h4>
                      <div className="space-y-1">
                        {Object.entries(info.best_params ?? {}).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs">
                            <span className="font-mono text-muted-foreground">{k}</span>
                            <span className="font-medium tabular-nums">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="flex items-center gap-2 text-sm font-semibold">
                        <Layers className="h-3.5 w-3.5 text-emerald-600" />
                        Scaler
                      </h4>
                      <p className="text-sm text-muted-foreground">{info.scaler}</p>
                      <h4 className="mt-3 flex items-center gap-2 text-sm font-semibold">
                        <Boxes className="h-3.5 w-3.5 text-emerald-600" />
                        Categorical Encoding
                      </h4>
                      <p className="text-sm text-muted-foreground">{info.categorical_encoding}</p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="flex items-center gap-2 text-sm font-semibold">
                        <FileWarning className="h-3.5 w-3.5 text-amber-600" />
                        Excluded Features
                      </h4>
                      <div className="space-y-1.5">
                        {(info.excluded_features ?? []).map((f) => (
                          <div key={f} className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 dark:border-amber-900 dark:bg-amber-950/30">
                            <p className="text-xs font-medium">{f}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {info.exclusion_reasons?.[f] ?? "Excluded from training."}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Ethical notes */}
                  <div className="space-y-2">
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                      <ShieldAlert className="h-3.5 w-3.5 text-emerald-600" />
                      Ethical Notes
                    </h4>
                    <ul className="space-y-1.5">
                      {(info.ethical_notes ?? []).map((note, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Responsible AI warning */}
          <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-900 dark:text-amber-200">Responsible AI Notice</AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-300">
              {info.responsible_ai_warning}
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}
