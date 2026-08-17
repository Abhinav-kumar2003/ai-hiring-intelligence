"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { candidateApi } from "@/services/api";
import { useAppStore } from "@/store/app-store";
import type { Candidate, PredictionWithExplanations } from "@/types";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { LoadingState, EmptyState } from "@/components/shared/states";
import { toast } from "sonner";
import {
  GitCompare, Plus, Trash2, X, Users, Crown, ArrowLeft,
} from "lucide-react";
import { format } from "date-fns";

// ---- helpers ---------------------------------------------------------------
function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}
function splitTags(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}
function predictionBadgeClass(pred?: string | null): string {
  if (pred === "Hired") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900";
  if (pred === "Rejected") return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-900";
  return "text-muted-foreground";
}

// ---- types -----------------------------------------------------------------
type CandidateWithPreds = Candidate & { predictions: PredictionWithExplanations[]; resumeFile?: any };

interface RowDef {
  key: string;
  label: string;
  render: (c: CandidateWithPreds) => React.ReactNode;
  best: (c: CandidateWithPreds) => number; // higher = better
  format?: (val: number) => string;
}

// ---- main view -------------------------------------------------------------
export function ComparisonView() {
  const { compareCandidateIds, toggleCompareCandidate, clearCompare, navigate } = useAppStore();
  const [candidates, setCandidates] = useState<CandidateWithPreds[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [searchList, setSearchList] = useState<Candidate[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const load = useCallback(async () => {
    if (compareCandidateIds.length === 0) {
      setCandidates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const results = await Promise.all(
        compareCandidateIds.map((id) => candidateApi.get(id).then((r) => r.candidate).catch(() => null))
      );
      setCandidates(results.filter(Boolean) as CandidateWithPreds[]);
    } catch {
      toast.error("Failed to load some candidates");
    } finally {
      setLoading(false);
    }
  }, [compareCandidateIds]);

  useEffect(() => { load(); }, [load]);

  // Search candidates to add
  const fetchSearch = useCallback(async () => {
    setSearchLoading(true);
    try {
      const res = await candidateApi.list({ pageSize: 100 });
      setSearchList(res.candidates);
    } catch {
      setSearchList([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleOpenAdd = (open: boolean) => {
    setAddOpen(open);
    if (open && searchList.length === 0) fetchSearch();
  };

  const handleAddCandidate = (id: string) => {
    if (compareCandidateIds.includes(id)) return;
    if (compareCandidateIds.length >= 5) {
      toast.warning("Compare limit reached", { description: "Maximum 5 candidates can be compared." });
      return;
    }
    toggleCompareCandidate(id);
  };

  const handleRemove = (id: string) => {
    toggleCompareCandidate(id);
  };

  // Row definitions for comparison table
  const rows: RowDef[] = useMemo(() => [
    {
      key: "name",
      label: "Name",
      best: () => 0,
      render: (c) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-semibold text-white">
              {getInitials(c.name)}
            </AvatarFallback>
          </Avatar>
          <button
            className="text-left font-medium hover:text-primary hover:underline"
            onClick={() => navigate("candidate-details", { candidateId: c.id })}
          >
            {c.name}
          </button>
        </div>
      ),
    },
    {
      key: "jobRole",
      label: "Job Role",
      best: () => 0,
      render: (c) => <span className="text-sm">{c.jobRole}</span>,
    },
    {
      key: "experience",
      label: "Experience",
      best: (c) => c.experience,
      format: (v) => `${v} yrs`,
      render: (c) => <span className="text-sm tabular-nums">{c.experience} yrs</span>,
    },
    {
      key: "education",
      label: "Education",
      best: () => 0,
      render: (c) => <span className="text-sm">{c.education}</span>,
    },
    {
      key: "skillsCount",
      label: "Skills",
      best: (c) => splitTags(c.skills).length,
      format: (v) => `${v}`,
      render: (c) => {
        const count = splitTags(c.skills).length;
        return <span className="text-sm tabular-nums">{count}</span>;
      },
    },
    {
      key: "certsCount",
      label: "Certifications",
      best: (c) => splitTags(c.certifications).length,
      format: (v) => `${v}`,
      render: (c) => {
        const count = splitTags(c.certifications).length;
        return <span className="text-sm tabular-nums">{count}</span>;
      },
    },
    {
      key: "projectsCount",
      label: "Projects",
      best: (c) => c.projectsCount,
      format: (v) => `${v}`,
      render: (c) => <span className="text-sm tabular-nums">{c.projectsCount}</span>,
    },
    {
      key: "salary",
      label: "Salary Expectation",
      best: () => 0,
      render: (c) => <span className="text-sm tabular-nums">${c.salaryExpectation.toLocaleString()}</span>,
    },
    {
      key: "prediction",
      label: "Prediction",
      best: () => 0,
      render: (c) => c.latestPrediction ? (
        <Badge variant="secondary" className={predictionBadgeClass(c.latestPrediction.prediction)}>
          {c.latestPrediction.prediction}
        </Badge>
      ) : <Badge variant="outline" className="text-muted-foreground">PENDING</Badge>,
    },
    {
      key: "hireProbability",
      label: "Hire Probability",
      best: (c) => c.latestPrediction?.hireProbability ?? -1,
      format: (v) => v >= 0 ? `${(v * 100).toFixed(1)}%` : "—",
      render: (c) => {
        const prob = c.latestPrediction?.hireProbability;
        if (prob === undefined || prob === null) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div className="flex items-center gap-2">
            <Progress value={prob * 100} className="h-1.5 w-16" />
            <span className="text-xs font-medium tabular-nums">{(prob * 100).toFixed(0)}%</span>
          </div>
        );
      },
    },
    {
      key: "confidence",
      label: "Confidence",
      best: () => 0,
      render: (c) => c.latestPrediction ? (
        <Badge variant="outline" className="text-xs">{c.latestPrediction.confidence}</Badge>
      ) : <span className="text-xs text-muted-foreground">—</span>,
    },
  ], [navigate]);

  // For each row, find best candidate id (for highlight)
  const bestIds: Record<string, string | null> = useMemo(() => {
    const out: Record<string, string | null> = {};
    for (const row of rows) {
      if (row.best(candidates[0]) === 0 && candidates.every((c) => row.best(c) === 0)) {
        out[row.key] = null;
        continue;
      }
      let bestId: string | null = null;
      let bestVal = -Infinity;
      for (const c of candidates) {
        const v = row.best(c);
        if (v > bestVal) { bestVal = v; bestId = c.id; }
      }
      out[row.key] = bestVal > -Infinity && bestVal > 0 ? bestId : null;
    }
    return out;
  }, [rows, candidates]);

  // Empty state
  if (compareCandidateIds.length === 0) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={GitCompare}
              title="No candidates selected for comparison"
              description="Select up to 5 candidates from the candidates list to compare them side by side."
              actionLabel="Browse Candidates"
              onAction={() => navigate("candidates")}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Compare Candidates</h1>
          <p className="text-sm text-muted-foreground">Select up to 5 candidates to compare side by side.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("candidates")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Candidates
          </Button>
          <Button variant="outline" onClick={clearCompare} disabled={loading}>
            <Trash2 className="mr-2 h-4 w-4" /> Clear All
          </Button>
        </div>
      </div>

      {/* Selector area */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Selected Candidates ({candidates.length}/5)</CardTitle>
          <CardDescription>Add or remove candidates for comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {candidates.map((c) => (
              <div key={c.id} className="group flex items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-3">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-semibold text-white">
                    {getInitials(c.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-xs">
                  <p className="font-medium leading-tight">{c.name}</p>
                  <p className="text-muted-foreground leading-tight">{c.jobRole}</p>
                </div>
                <button
                  onClick={() => handleRemove(c.id)}
                  className="ml-1 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${c.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {candidates.length < 5 && (
              <Popover open={addOpen} onOpenChange={handleOpenAdd}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-full">
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add Candidate
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <div className="border-b p-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {searchLoading ? "Loading..." : `${searchList.length - candidates.length} available`}
                    </p>
                  </div>
                  <div className="max-h-72 overflow-y-auto p-1">
                    {searchLoading ? (
                      <div className="space-y-2 p-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="h-7 w-7 animate-pulse rounded-full bg-muted" />
                            <div className="flex-1 space-y-1">
                              <div className="h-2.5 w-24 animate-pulse rounded bg-muted" />
                              <div className="h-2 w-16 animate-pulse rounded bg-muted" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      searchList
                        .filter((c) => !compareCandidateIds.includes(c.id))
                        .map((c) => (
                          <button
                            key={c.id}
                            onClick={() => { handleAddCandidate(c.id); }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                          >
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-semibold text-white">
                                {getInitials(c.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-xs">
                              <p className="font-medium leading-tight">{c.name}</p>
                              <p className="text-muted-foreground leading-tight">{c.jobRole}</p>
                            </div>
                            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        ))
                    )}
                    {!searchLoading && searchList.filter((c) => !compareCandidateIds.includes(c.id)).length === 0 && (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        No more candidates to add
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comparison table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detailed Comparison</CardTitle>
          <CardDescription>
            <span className="inline-flex items-center gap-1">
              <Crown className="h-3 w-3 text-amber-500" />
              Best value in each row is highlighted
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <LoadingState message="Loading comparison data..." />
          ) : candidates.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No candidates to compare"
              description="Add candidates using the selector above."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="sticky left-0 z-10 bg-muted/40 pl-4 min-w-[140px]">Attribute</TableHead>
                    {candidates.map((c) => (
                      <TableHead key={c.id} className="min-w-[180px] pr-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-semibold text-white">
                                {getInitials(c.name)}
                              </AvatarFallback>
                            </Avatar>
                            <button
                              className="text-left font-medium hover:text-primary hover:underline"
                              onClick={() => navigate("candidate-details", { candidateId: c.id })}
                            >
                              {c.name}
                            </button>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemove(c.id)}
                          >
                            <X className="mr-1 h-3 w-3" /> Remove
                          </Button>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="sticky left-0 z-10 bg-background pl-4 font-medium">
                        {row.label}
                      </TableCell>
                      {candidates.map((c) => {
                        const isBest = bestIds[row.key] === c.id;
                        return (
                          <TableCell
                            key={c.id}
                            className={`pr-4 text-center ${isBest ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <span>{row.render(c)}</span>
                              {isBest && <Crown className="h-3 w-3 text-amber-500" aria-label="Best" />}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  {/* Created date row */}
                  <TableRow>
                    <TableCell className="sticky left-0 z-10 bg-background pl-4 font-medium">Added</TableCell>
                    {candidates.map((c) => (
                      <TableCell key={c.id} className="pr-4 text-center text-xs text-muted-foreground">
                        {format(new Date(c.createdAt), "PP")}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary footer */}
      {!loading && candidates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
            <CardDescription>Quick insights from the comparison</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Most Experienced</p>
              <p className="text-sm font-medium">
                {candidates.reduce((a, b) => b.experience > a.experience ? b : a).name}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Most Likely to Hire</p>
              <p className="text-sm font-medium">
                {(() => {
                  const withPred = candidates.filter((c) => c.latestPrediction);
                  if (withPred.length === 0) return "—";
                  return withPred.reduce((a, b) =>
                    (b.latestPrediction!.hireProbability > a.latestPrediction!.hireProbability) ? b : a
                  ).name;
                })()}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Most Projects</p>
              <p className="text-sm font-medium">
                {candidates.reduce((a, b) => b.projectsCount > a.projectsCount ? b : a).name}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Most Skills</p>
              <p className="text-sm font-medium">
                {candidates.reduce((a, b) =>
                  splitTags(b.skills).length > splitTags(a.skills).length ? b : a
                ).name}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
