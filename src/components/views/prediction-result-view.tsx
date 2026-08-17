"use client";
import { useEffect, useMemo, useState } from "react";
import { predictionApi, candidateApi } from "@/services/api";
import { useAppStore } from "@/store/app-store";
import type {
  PredictionResult, PredictionWithExplanations, FeatureContribution, FeatureExplanation,
} from "@/types";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Alert, AlertTitle, AlertDescription,
} from "@/components/ui/alert";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/states";
import { CircularProgress } from "@/components/shared/circular-progress";
import { toast } from "sonner";
import {
  ArrowLeft, Zap, FileText, Save, Eye, AlertTriangle, Info, TrendingUp,
  TrendingDown, Sparkles, Download, ThumbsUp, ThumbsDown,
  CheckCircle2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell,
} from "recharts";

const HIRE_COLOR = "#10b981";
const REJECT_COLOR = "#ef4444";

// ---- unified factor shape --------------------------------------------------
interface DisplayFactor {
  feature: string;
  contribution: number;
  direction: "positive" | "negative" | "neutral";
  strength: "strong" | "moderate" | "low";
  displayValue: string;
}

function humanizeFeature(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function normalizeFactors(exps: (FeatureContribution | FeatureExplanation)[] | undefined): DisplayFactor[] {
  if (!exps || exps.length === 0) return [];
  return exps.map((e) => {
    let displayValue = (e as FeatureContribution).displayValue;
    if (!displayValue) {
      const v = (e as FeatureExplanation).value;
      if (typeof v === "number") {
        displayValue = Number.isInteger(v) ? String(v) : v.toFixed(2);
      } else {
        displayValue = String(v ?? "");
      }
    }
    return {
      feature: e.feature,
      contribution: e.contribution,
      direction: e.direction,
      strength: e.strength,
      displayValue,
    };
  });
}

function confidenceClass(c: string): string {
  if (c === "High") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900";
  if (c === "Medium") return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-900";
  return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-900";
}

function strengthLabel(s: string): string {
  if (s === "strong") return "Strong";
  if (s === "moderate") return "Moderate";
  return "Low";
}

function strengthColor(s: string): string {
  if (s === "strong") return "text-emerald-600 dark:text-emerald-400";
  if (s === "moderate") return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

// ---- main view -------------------------------------------------------------
export function PredictionResultView() {
  const { lastPrediction, selectedPredictionId, navigate, setLastPrediction } = useAppStore();

  const [fetched, setFetched] = useState<PredictionWithExplanations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savingCandidate, setSavingCandidate] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const usingLastPrediction = !!lastPrediction && (!selectedPredictionId || lastPrediction.predictionId === selectedPredictionId);

  useEffect(() => {
    if (usingLastPrediction) {
      setFetched(null);
      setError("");
      setLoading(false);
      return;
    }
    if (!selectedPredictionId) return;
    setLoading(true);
    setError("");
    setFetched(null);
    predictionApi.get(selectedPredictionId)
      .then(({ prediction }) => setFetched(prediction))
      .catch((e) => setError(e?.message || "Failed to load prediction"))
      .finally(() => setLoading(false));
  }, [selectedPredictionId, usingLastPrediction]);

  // ---- unified data --------------------------------------------------------
  const data: {
    predictionId?: string;
    prediction: "Hired" | "Rejected";
    hireProbability: number;
    rejectProbability: number;
    confidence: string;
    modelName: string;
    modelVersion: string;
    explanations: DisplayFactor[];
    warning?: string;
    metadata?: PredictionResult["metadata"];
    createdAt?: string;
    candidateId?: string | null;
    inputData?: string;
    candidate?: PredictionWithExplanations["candidate"];
  } | null = useMemo(() => {
    if (usingLastPrediction && lastPrediction) {
      return {
        predictionId: lastPrediction.predictionId,
        prediction: lastPrediction.prediction,
        hireProbability: lastPrediction.hireProbability,
        rejectProbability: lastPrediction.rejectProbability,
        confidence: lastPrediction.confidence,
        modelName: lastPrediction.modelName,
        modelVersion: lastPrediction.modelVersion,
        explanations: normalizeFactors(lastPrediction.explanations),
        warning: lastPrediction.warning,
        metadata: lastPrediction.metadata,
      };
    }
    if (fetched) {
      return {
        predictionId: fetched.id,
        prediction: fetched.prediction,
        hireProbability: fetched.hireProbability,
        rejectProbability: fetched.rejectProbability,
        confidence: fetched.confidence,
        modelName: fetched.modelName,
        modelVersion: fetched.modelVersion,
        explanations: normalizeFactors(fetched.explanations as any),
        createdAt: fetched.createdAt,
        candidateId: fetched.candidateId,
        inputData: fetched.inputData,
        candidate: fetched.candidate,
      };
    }
    return null;
  }, [usingLastPrediction, lastPrediction, fetched]);

  // ---- helpers -------------------------------------------------------------
  const positiveFactors = useMemo(
    () => data?.explanations.filter((e) => e.direction === "positive").sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)) ?? [],
    [data]
  );
  const negativeFactors = useMemo(
    () => data?.explanations.filter((e) => e.direction === "negative").sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)) ?? [],
    [data]
  );
  const topFeatures = useMemo(
    () => [...(data?.explanations ?? [])].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 8),
    [data]
  );

  const maxAbsContribution = useMemo(() => {
    if (!data?.explanations?.length) return 1;
    const m = Math.max(...data.explanations.map((e) => Math.abs(e.contribution)));
    return m > 0 ? m : 1;
  }, [data]);

  // ---- actions -------------------------------------------------------------
  const handleSaveCandidate = async () => {
    if (!data) return;
    setSavingCandidate(true);
    try {
      // Need input data; fetch by id if we don't have it locally
      let input: any = null;
      if (data.inputData) {
        try { input = JSON.parse(data.inputData); } catch { input = null; }
      } else if (data.predictionId) {
        const { prediction } = await predictionApi.get(data.predictionId);
        try { input = JSON.parse(prediction.inputData); } catch { input = null; }
      }
      if (!input) {
        toast.error("Cannot save candidate", { description: "Input data is no longer available." });
        return;
      }
      const { candidate } = await candidateApi.create({
        name: input.name || "Unnamed Candidate",
        email: input.email || "",
        phone: input.phone || "",
        skills: input.skills || "",
        experience: Number(input.experience ?? 0),
        education: input.education || "",
        certifications: input.certifications || "",
        jobRole: input.jobRole || "",
        salaryExpectation: Number(input.salaryExpectation ?? 0),
        projectsCount: Number(input.projectsCount ?? 0),
        source: "manual",
      });
      toast.success("Candidate saved", { description: `${candidate.name} has been added to your candidate list.` });
      navigate("candidate-details", { candidateId: candidate.id });
    } catch (err: any) {
      toast.error("Failed to save candidate", { description: err?.message || "Please try again." });
    } finally {
      setSavingCandidate(false);
    }
  };

  const handleDownload = () => {
    if (!data) return;
    setDownloading(true);
    try {
      const lines: string[] = [];
      lines.push("AI HIRING PREDICTION REPORT");
      lines.push("=".repeat(60));
      lines.push("");
      lines.push(`Prediction ID : ${data.predictionId ?? "—"}`);
      lines.push(`Generated At  : ${new Date().toISOString()}`);
      if (data.createdAt) lines.push(`Recorded At   : ${data.createdAt}`);
      if (data.candidate) {
        lines.push(`Candidate     : ${data.candidate.name}`);
        lines.push(`Job Role      : ${data.candidate.jobRole}`);
        if (data.candidate.email) lines.push(`Email         : ${data.candidate.email}`);
      }
      lines.push("");
      lines.push("PREDICTION RESULT");
      lines.push("-".repeat(60));
      lines.push(`Prediction        : ${data.prediction}`);
      lines.push(`Hire Probability  : ${(data.hireProbability * 100).toFixed(2)}%`);
      lines.push(`Reject Probability: ${(data.rejectProbability * 100).toFixed(2)}%`);
      lines.push(`Confidence        : ${data.confidence}`);
      lines.push("");
      lines.push("MODEL");
      lines.push("-".repeat(60));
      lines.push(`Name    : ${data.modelName}`);
      lines.push(`Version : ${data.modelVersion}`);
      if (data.metadata) {
        lines.push(`Type    : ${data.metadata.modelType}`);
        lines.push(`Trained : ${data.metadata.trainingDate}`);
        lines.push(`Samples : ${data.metadata.trainingSamples}`);
        lines.push(`Features: ${data.metadata.features}`);
      }
      lines.push("");
      lines.push("FEATURE CONTRIBUTIONS");
      lines.push("-".repeat(60));
      if (data.explanations.length === 0) {
        lines.push("(no explanation data available)");
      } else {
        const sorted = [...data.explanations].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
        for (const e of sorted) {
          const sign = e.contribution >= 0 ? "+" : " ";
          lines.push(`${humanizeFeature(e.feature).padEnd(28)} ${sign}${(e.contribution * 100).toFixed(2)}%  [${e.direction}, ${e.strength}]  value=${e.displayValue}`);
        }
      }
      lines.push("");
      lines.push("RESPONSIBLE AI WARNING");
      lines.push("-".repeat(60));
      lines.push(data.warning || "This prediction is an AI-generated statistical estimate and should not be used as the sole basis for an employment decision.");
      lines.push("");
      lines.push("=".repeat(60));
      const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prediction-report-${data.predictionId ?? Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Report downloaded", { description: "The prediction report has been saved to your downloads." });
    } catch (err: any) {
      toast.error("Failed to download report", { description: err?.message });
    } finally {
      setDownloading(false);
    }
  };

  // ---- empty / loading / error states -------------------------------------
  if (loading) return <LoadingState message="Loading prediction..." />;
  if (error) return <ErrorState message={error} onRetry={() => selectedPredictionId && predictionApi.get(selectedPredictionId).then(({ prediction }) => setFetched(prediction)).catch(() => {})} />;
  if (!data) {
    return (
      <div className="p-4 md:p-6">
        <EmptyState
          icon={FileText}
          title="No prediction yet"
          description="Run a prediction to see the AI's analysis, contributing factors, and probability score."
          actionLabel="Screen a Candidate"
          onAction={() => navigate("screening")}
        />
      </div>
    );
  }

  const isHired = data.prediction === "Hired";
  const gaugeColor = isHired ? "success" : "danger";
  const hirePct = (data.hireProbability * 100).toFixed(1);
  const rejectPct = (data.rejectProbability * 100).toFixed(1);

  // chart data
  const chartData = topFeatures.map((e) => ({
    name: humanizeFeature(e.feature).length > 22 ? humanizeFeature(e.feature).slice(0, 22) + "…" : humanizeFeature(e.feature),
    fullName: humanizeFeature(e.feature),
    contribution: Number((e.contribution * 100).toFixed(2)),
    direction: e.direction,
  }));

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("predictions")} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">AI Hiring Prediction</h1>
            <p className="text-sm text-muted-foreground">
              {data.candidate
                ? <>Candidate: <span className="font-medium text-foreground">{data.candidate.name}</span> · {data.candidate.jobRole}</>
                : "Prediction result generated by the Random Forest model."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("screening")}>
            <Zap className="mr-2 h-4 w-4" /> Run Again
          </Button>
          <Button variant="outline" onClick={handleDownload} disabled={downloading}>
            {downloading ? <span className="mr-1 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Download className="mr-2 h-4 w-4" />}
            Download Report
          </Button>
        </div>
      </div>

      {/* Main result card */}
      <Card className="overflow-hidden">
        <CardContent className="p-4 md:p-8">
          <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Gauge */}
            <div className="flex flex-col items-center">
              <CircularProgress
                value={data.hireProbability}
                size={240}
                strokeWidth={16}
                color={gaugeColor}
              >
                <div className="flex flex-col items-center">
                  <div className={`text-4xl font-bold ${isHired ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {hirePct}%
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Hire Probability</div>
                </div>
              </CircularProgress>
              <div className="mt-4">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-base font-bold uppercase tracking-wide ${
                    isHired
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                      : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                  }`}
                >
                  {isHired ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {data.prediction}
                </span>
              </div>
            </div>

            {/* Right column - probabilities & meta */}
            <div className="flex-1 space-y-5 lg:max-w-md">
              {/* Probability bars */}
              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                      <TrendingUp className="h-3.5 w-3.5" /> Hired
                    </span>
                    <span className="font-semibold tabular-nums">{hirePct}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-1000" style={{ width: `${hirePct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-medium text-red-700 dark:text-red-400">
                      <TrendingDown className="h-3.5 w-3.5" /> Rejected
                    </span>
                    <span className="font-semibold tabular-nums">{rejectPct}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-red-500 transition-all duration-1000" style={{ width: `${rejectPct}%` }} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Confidence + model info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Confidence
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" aria-label="Confidence explanation" className="text-muted-foreground hover:text-foreground">
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Confidence is derived from the margin between the hire and reject probabilities. A wider margin indicates higher model certainty.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </p>
                  <Badge variant="outline" className={confidenceClass(data.confidence)}>
                    {data.confidence}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Model</p>
                  <p className="text-sm font-medium">{data.modelName}</p>
                  <p className="text-xs text-muted-foreground">Version: {data.modelVersion}</p>
                </div>
              </div>

              <Separator />

              {/* Prediction summary */}
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-sm">
                  The model predicts that this candidate has a{" "}
                  <span className={`font-semibold ${isHired ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>{hirePct}%</span>{" "}
                  probability of being classified as <span className="font-semibold">Hired</span>.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions row */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <span>Next steps:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.candidateId ? (
              <Button variant="outline" onClick={() => navigate("candidate-details", { candidateId: data.candidateId! })}>
                <Eye className="mr-2 h-4 w-4" /> View Candidate
              </Button>
            ) : (
              <Button onClick={handleSaveCandidate} disabled={savingCandidate}>
                {savingCandidate ? <span className="mr-1 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Save className="mr-2 h-4 w-4" />}
                Save Candidate
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate("screening")}>
              <Zap className="mr-2 h-4 w-4" /> Run New Prediction
            </Button>
            <Button variant="ghost" onClick={handleDownload} disabled={downloading}>
              <Download className="mr-2 h-4 w-4" /> Download Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            Why did the AI make this prediction?
          </CardTitle>
          <CardDescription>
            Top contributing factors, sorted by absolute contribution strength.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.explanations.length === 0 ? (
            <EmptyState
              icon={Info}
              title="No explanation data"
              description="Detailed feature contributions are not available for this prediction."
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Positive factors */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    <ThumbsUp className="h-3.5 w-3.5" /> Positive Factors
                  </h4>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{positiveFactors.length}</Badge>
                </div>
                {positiveFactors.length === 0 ? (
                  <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">No positive factors detected.</p>
                ) : (
                  <ul className="space-y-3">
                    {positiveFactors.map((f) => (
                      <li key={f.feature} className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium">{humanizeFeature(f.feature)}</span>
                          <span className="text-xs text-muted-foreground">{f.displayValue}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${Math.max(3, (Math.abs(f.contribution) / maxAbsContribution) * 100)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-medium ${strengthColor(f.strength)}`}>{strengthLabel(f.strength)} impact</span>
                          <span className="tabular-nums text-emerald-700 dark:text-emerald-400">+{(f.contribution * 100).toFixed(2)}%</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Negative factors */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-1.5 text-sm font-semibold text-red-700 dark:text-red-400">
                    <ThumbsDown className="h-3.5 w-3.5" /> Negative Factors
                  </h4>
                  <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">{negativeFactors.length}</Badge>
                </div>
                {negativeFactors.length === 0 ? (
                  <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">No negative factors detected.</p>
                ) : (
                  <ul className="space-y-3">
                    {negativeFactors.map((f) => (
                      <li key={f.feature} className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium">{humanizeFeature(f.feature)}</span>
                          <span className="text-xs text-muted-foreground">{f.displayValue}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-red-500"
                            style={{ width: `${Math.max(3, (Math.abs(f.contribution) / maxAbsContribution) * 100)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-medium ${strengthColor(f.strength)}`}>{strengthLabel(f.strength)} impact</span>
                          <span className="tabular-nums text-red-700 dark:text-red-400">{(f.contribution * 100).toFixed(2)}%</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feature importance chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feature Importance</CardTitle>
            <CardDescription>Top contributing features to this prediction. Green bars push toward hire, red bars push toward reject.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v) => `${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    width={130}
                  />
                  <RTooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number) => [`${value.toFixed(2)}%`, "Contribution"]}
                    labelFormatter={(_label, payload) => (payload?.[0]?.payload?.fullName as string) ?? ""}
                  />
                  <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.direction === "positive" ? HIRE_COLOR : REJECT_COLOR} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prediction summary card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prediction Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            The model predicts that this candidate has a{" "}
            <span className={`font-semibold ${isHired ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>{hirePct}%</span>{" "}
            probability of being classified as <span className="font-semibold">{data.prediction}</span>.
          </p>
          {data.candidate && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-xs sm:grid-cols-4">
              <div>
                <p className="text-muted-foreground">Candidate</p>
                <p className="font-medium">{data.candidate.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Job Role</p>
                <p className="font-medium">{data.candidate.jobRole}</p>
              </div>
              {data.candidate.experience !== undefined && (
                <div>
                  <p className="text-muted-foreground">Experience</p>
                  <p className="font-medium">{data.candidate.experience} yrs</p>
                </div>
              )}
              {data.candidate.education && (
                <div>
                  <p className="text-muted-foreground">Education</p>
                  <p className="font-medium">{data.candidate.education}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Responsible AI warning */}
      <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-900 dark:text-amber-200">Responsible AI Notice</AlertTitle>
        <AlertDescription className="text-amber-800 dark:text-amber-300">
          {data.warning || "This prediction is an AI-generated statistical estimate and should not be used as the sole basis for an employment decision. Always consider additional context, interviews, and human judgment when evaluating candidates."}
        </AlertDescription>
      </Alert>
    </div>
  );
}
