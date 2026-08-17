"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { predictionApi } from "@/services/api";
import { useAppStore } from "@/store/app-store";
import type { PredictionWithExplanations } from "@/types";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/states";
import { toast } from "sonner";
import {
  Zap, Eye, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, History,
  CheckCircle2, AlertTriangle, User as UserIcon, ChevronRight,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

const PAGE_SIZE = 15;

// ---- helpers ---------------------------------------------------------------
function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}
function predictionBadgeClass(pred?: string | null): string {
  if (pred === "Hired") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900";
  if (pred === "Rejected") return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-900";
  return "text-muted-foreground";
}
function confidenceClass(c: string): string {
  if (c === "High") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400";
  if (c === "Medium") return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
  return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
}

// ---- main view -------------------------------------------------------------
export function PredictionsView() {
  const { navigate } = useAppStore();
  const [predictions, setPredictions] = useState<PredictionWithExplanations[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [prediction, setPrediction] = useState("all");
  const [model, setModel] = useState("all");
  const [sortBy, setSortBy] = useState<"createdAt" | "hireProbability">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await predictionApi.list({
        prediction: prediction === "all" ? undefined : prediction,
        model: model === "all" ? undefined : model,
        page,
        pageSize: PAGE_SIZE,
        sortBy,
        sortDir,
      });
      setPredictions(res.predictions);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err?.message || "Failed to load predictions");
      toast.error("Failed to load predictions", { description: err?.message });
    } finally {
      setLoading(false);
    }
  }, [prediction, model, page, sortBy, sortDir]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [prediction, model, sortBy, sortDir]);

  const clearFilters = () => {
    setPrediction("all");
    setModel("all");
    setSortBy("createdAt");
    setSortDir("desc");
    setPage(1);
  };

  const hasActiveFilters = prediction !== "all" || model !== "all" || sortBy !== "createdAt" || sortDir !== "desc";

  const toggleSortDir = () => setSortDir((d) => (d === "asc" ? "desc" : "asc"));

  // Page numbers for pagination
  const pageItems = useMemo(() => {
    const items: (number | "ellipsis")[] = [];
    const push = (n: number | "ellipsis") => items.push(n);
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) push(i);
    } else {
      push(1);
      if (page > 3) push("ellipsis");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) push(i);
      if (page < totalPages - 2) push("ellipsis");
      push(totalPages);
    }
    return items;
  }, [page, totalPages]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Predictions</h1>
          <p className="text-sm text-muted-foreground">View all prediction history.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("screening")}>
            <Zap className="mr-2 h-4 w-4" /> New Prediction
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={prediction} onValueChange={setPrediction}>
                <SelectTrigger className="w-full sm:w-44">
                  <Filter className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Prediction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Predictions</SelectItem>
                  <SelectItem value="Hired">Hired</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Models</SelectItem>
                  <SelectItem value="Random Forest">Random Forest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as "createdAt" | "hireProbability")}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Date</SelectItem>
                  <SelectItem value="hireProbability">Probability</SelectItem>
                </SelectContent>
              </Select>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={toggleSortDir} aria-label="Toggle sort direction">
                      {sortDir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Sort {sortDir === "asc" ? "ascending" : "descending"} (click to toggle)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
                  <X className="mr-1.5 h-3.5 w-3.5" /> Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">
              {loading ? "Loading predictions…" : `${total} prediction${total === 1 ? "" : "s"}`}
            </CardTitle>
            <CardDescription className="text-xs">
              {hasActiveFilters ? "Filtered results" : "Showing all predictions"}
            </CardDescription>
          </div>
          {predictions.length > 0 && (
            <Badge variant="outline" className="text-xs">
              Page {page} of {totalPages || 1}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : predictions.length === 0 ? (
            <EmptyState
              icon={History}
              title={hasActiveFilters ? "No predictions match your filters" : "No predictions yet"}
              description={hasActiveFilters
                ? "Try adjusting or clearing the filters to see more results."
                : "Run your first prediction to see it appear here."}
              actionLabel={hasActiveFilters ? "Clear Filters" : "Run Prediction"}
              onAction={hasActiveFilters ? clearFilters : () => navigate("screening")}
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="pl-4">Candidate</TableHead>
                      <TableHead>Prediction</TableHead>
                      <TableHead>Probability</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="pr-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {predictions.map((p) => {
                      const prob = p.prediction === "Hired" ? p.hireProbability : p.rejectProbability;
                      const isHired = p.prediction === "Hired";
                      const candidateName = p.candidate?.name || "Anonymous";
                      const candidateRole = p.candidate?.jobRole || "—";
                      return (
                        <TableRow key={p.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate("prediction-result", { predictionId: p.id })}>
                          <TableCell className="pl-4">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className={`text-xs font-semibold text-white ${isHired ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-red-500 to-rose-600"}`}>
                                  {p.candidate ? getInitials(candidateName) : "?"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="truncate font-medium leading-tight">{candidateName}</div>
                                <div className="text-xs text-muted-foreground">{candidateRole}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={predictionBadgeClass(p.prediction)}>
                              {isHired ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <AlertTriangle className="mr-1 h-3 w-3" />}
                              {p.prediction}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={isHired ? "h-full bg-emerald-500" : "h-full bg-red-500"}
                                  style={{ width: `${prob * 100}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium tabular-nums">{(prob * 100).toFixed(1)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={confidenceClass(p.confidence)}>{p.confidence}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{p.modelName}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.modelVersion}</TableCell>
                          <TableCell className="text-xs text-muted-foreground" title={format(new Date(p.createdAt), "PPpp")}>
                            {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8"
                                onClick={() => navigate("prediction-result", { predictionId: p.id })}
                              >
                                <Eye className="mr-1 h-3.5 w-3.5" /> View
                              </Button>
                              {p.candidateId && p.candidate && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0"
                                        onClick={() => navigate("candidate-details", { candidateId: p.candidateId! })}
                                        aria-label="View candidate"
                                      >
                                        <UserIcon className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>View candidate profile</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Tablet / mobile cards */}
              <div className="space-y-3 p-4 lg:hidden">
                {predictions.map((p) => {
                  const prob = p.prediction === "Hired" ? p.hireProbability : p.rejectProbability;
                  const isHired = p.prediction === "Hired";
                  const candidateName = p.candidate?.name || "Anonymous";
                  const candidateRole = p.candidate?.jobRole || "—";
                  return (
                    <Card
                      key={p.id}
                      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
                      onClick={() => navigate("prediction-result", { predictionId: p.id })}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className={`text-xs font-semibold text-white ${isHired ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-red-500 to-rose-600"}`}>
                              {p.candidate ? getInitials(candidateName) : "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate font-medium">{candidateName}</p>
                                <p className="truncate text-xs text-muted-foreground">{candidateRole}</p>
                              </div>
                              <Badge variant="secondary" className={predictionBadgeClass(p.prediction)}>
                                {p.prediction}
                              </Badge>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={isHired ? "h-full bg-emerald-500" : "h-full bg-red-500"}
                                  style={{ width: `${prob * 100}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium tabular-nums">{(prob * 100).toFixed(0)}%</span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <Badge variant="outline" className={confidenceClass(p.confidence)}>{p.confidence}</Badge>
                              <span>{p.modelName} v{p.modelVersion}</span>
                              <span title={format(new Date(p.createdAt), "PPpp")}>
                                {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                            <div className="mt-3 flex gap-2">
                              <Button size="sm" variant="outline" className="h-7 flex-1" onClick={(e) => { e.stopPropagation(); navigate("prediction-result", { predictionId: p.id }); }}>
                                <Eye className="mr-1.5 h-3 w-3" /> View
                              </Button>
                              {p.candidateId && p.candidate && (
                                <Button size="sm" variant="ghost" className="h-7" onClick={(e) => { e.stopPropagation(); navigate("candidate-details", { candidateId: p.candidateId! }); }}>
                                  <UserIcon className="mr-1 h-3 w-3" /> Candidate
                                </Button>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="border-t p-4">
                  <Pagination className="justify-between sm:justify-center">
                    <PaginationContent className="flex-wrap gap-1">
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setPage(Math.max(1, page - 1))}
                          className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {pageItems.map((p, idx) =>
                        p === "ellipsis" ? (
                          <PaginationItem key={`e-${idx}`}>
                            <span className="flex h-9 w-9 items-center justify-center text-muted-foreground">…</span>
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={p}>
                            <PaginationLink
                              isActive={p === page}
                              onClick={() => setPage(p)}
                              className="cursor-pointer"
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      )}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setPage(Math.min(totalPages, page + 1))}
                          className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Sort hint footer */}
      {!loading && predictions.length > 0 && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5" />
            Sorted by {sortBy === "createdAt" ? "date" : "hire probability"} ({sortDir})
          </span>
          <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
        </div>
      )}
    </div>
  );
}
