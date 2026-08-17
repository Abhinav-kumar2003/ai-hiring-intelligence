"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { candidateApi, type CandidateListParams } from "@/services/api";
import { useAppStore } from "@/store/app-store";
import type { Candidate } from "@/types";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/states";
import { toast } from "sonner";
import { z } from "zod";
import {
  Plus, Upload, Search, Filter, X, Eye, Pencil, Trash2, Zap, MoreHorizontal,
  Users, GitCompare, AlertCircle,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// ---- constants -------------------------------------------------------------
const JOB_ROLES = ["AI Researcher", "Cybersecurity Analyst", "Data Scientist", "Software Engineer"];
const EDUCATION_OPTIONS = ["B.Sc", "B.Tech", "M.Tech", "MBA", "PhD"];
const PAGE_SIZE = 10;

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

// ---- validation schema -----------------------------------------------------
const candidateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email").or(z.literal("")),
  phone: z.string().optional(),
  experience: z.coerce.number().min(0, "Experience must be ≥ 0").max(50, "Experience must be ≤ 50"),
  education: z.string().min(1, "Education is required"),
  jobRole: z.string().min(1, "Job role is required"),
  salaryExpectation: z.coerce.number().min(0, "Salary must be ≥ 0"),
  projectsCount: z.coerce.number().int().min(0, "Projects must be ≥ 0"),
});
type CandidateFormValues = z.infer<typeof candidateSchema>;

// ---- tag input -------------------------------------------------------------
interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}
function TagInput({ value, onChange, placeholder = "Type and press Enter" }: TagInputProps) {
  const [input, setInput] = useState("");
  const addTag = () => {
    const tag = input.trim();
    if (!tag) return;
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) {
      setInput("");
      return;
    }
    onChange([...value, tag]);
    setInput("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-sm focus-within:ring-2 focus-within:ring-ring/40">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100"
            aria-label={`Remove ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag();
          } else if (e.key === "Backspace" && !input && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={addTag}
        placeholder={value.length === 0 ? placeholder : ""}
        className="min-w-[80px] flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

// ---- candidate form dialog -------------------------------------------------
interface CandidateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Candidate | null;
  onSaved: () => void;
}
function CandidateFormDialog({ open, onOpenChange, initial, onSaved }: CandidateFormDialogProps) {
  const isEdit = !!initial;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [experience, setExperience] = useState("0");
  const [education, setEducation] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [salaryExpectation, setSalaryExpectation] = useState("0");
  const [projectsCount, setProjectsCount] = useState("0");
  const [skills, setSkills] = useState<string[]>([]);
  const [certifications, setCertifications] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setEmail(initial?.email ?? "");
      setPhone(initial?.phone ?? "");
      setExperience(String(initial?.experience ?? 0));
      setEducation(initial?.education ?? "");
      setJobRole(initial?.jobRole ?? "");
      setSalaryExpectation(String(initial?.salaryExpectation ?? 0));
      setProjectsCount(String(initial?.projectsCount ?? 0));
      setSkills(splitTags(initial?.skills ?? ""));
      setCertifications(splitTags(initial?.certifications ?? ""));
      setErrors({});
    }
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = candidateSchema.safeParse({
      name, email, phone, experience, education, jobRole, salaryExpectation, projectsCount,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...parsed.data,
        email: parsed.data.email || "",
        phone: parsed.data.phone || "",
        skills: skills.join(", "),
        certifications: certifications.join(", "),
      };
      if (isEdit && initial) {
        await candidateApi.update(initial.id, payload);
        toast.success("Candidate updated", { description: `${parsed.data.name}'s profile has been saved.` });
      } else {
        await candidateApi.create(payload);
        toast.success("Candidate added", { description: `${parsed.data.name} has been added to your list.` });
      }
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error("Failed to save candidate", { description: err.message || "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Candidate" : "Add New Candidate"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update candidate profile information." : "Fill in the candidate's details to add them to your pipeline."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Doe" />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0100" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="experience">Experience (years) <span className="text-destructive">*</span></Label>
            <Input id="experience" type="number" min={0} max={50} value={experience} onChange={(e) => setExperience(e.target.value)} />
            {errors.experience && <p className="text-xs text-destructive">{errors.experience}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="education">Education <span className="text-destructive">*</span></Label>
            <Select value={education} onValueChange={setEducation}>
              <SelectTrigger id="education" className="w-full"><SelectValue placeholder="Select education" /></SelectTrigger>
              <SelectContent>
                {EDUCATION_OPTIONS.map((ed) => <SelectItem key={ed} value={ed}>{ed}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.education && <p className="text-xs text-destructive">{errors.education}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jobRole">Job Role <span className="text-destructive">*</span></Label>
            <Select value={jobRole} onValueChange={setJobRole}>
              <SelectTrigger id="jobRole" className="w-full"><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                {JOB_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.jobRole && <p className="text-xs text-destructive">{errors.jobRole}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="salary">Salary Expectation ($) <span className="text-destructive">*</span></Label>
            <Input id="salary" type="number" min={0} value={salaryExpectation} onChange={(e) => setSalaryExpectation(e.target.value)} />
            {errors.salaryExpectation && <p className="text-xs text-destructive">{errors.salaryExpectation}</p>}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Skills</Label>
            <TagInput value={skills} onChange={setSkills} placeholder="Type a skill and press Enter" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Certifications</Label>
            <TagInput value={certifications} onChange={setCertifications} placeholder="Type a certification and press Enter" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="projects">Projects Count <span className="text-destructive">*</span></Label>
            <Input id="projects" type="number" min={0} value={projectsCount} onChange={(e) => setProjectsCount(e.target.value)} />
            {errors.projectsCount && <p className="text-xs text-destructive">{errors.projectsCount}</p>}
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <span className="mr-1 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {isEdit ? "Save Changes" : "Add Candidate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- delete confirmation ---------------------------------------------------
function DeleteCandidateDialog({ open, onOpenChange, candidate, onDeleted }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  candidate: Candidate | null; onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const confirm = async () => {
    if (!candidate) return;
    setDeleting(true);
    try {
      await candidateApi.delete(candidate.id);
      toast.success("Candidate deleted", { description: `${candidate.name} has been removed.` });
      onOpenChange(false);
      onDeleted();
    } catch (err: any) {
      toast.error("Failed to delete", { description: err.message });
    } finally {
      setDeleting(false);
    }
  };
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete candidate?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <strong>{candidate?.name}</strong> and all associated predictions. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            disabled={deleting}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {deleting && <span className="mr-1 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---- skill chip list with overflow ----------------------------------------
function SkillChips({ skills, max = 3 }: { skills: string[]; max?: number }) {
  if (skills.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const visible = skills.slice(0, max);
  const extra = skills.length - max;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((s) => (
        <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{s}</span>
      ))}
      {extra > 0 && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">+{extra}</span>}
    </div>
  );
}

// ---- main view -------------------------------------------------------------
export function CandidatesView() {
  const { navigate, compareCandidateIds, toggleCompareCandidate } = useAppStore();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [prediction, setPrediction] = useState("all");
  const [jobRole, setJobRole] = useState("all");
  const [experience, setExperience] = useState("all");
  const [probability, setProbability] = useState("any");

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [deleting, setDeleting] = useState<Candidate | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: CandidateListParams = {
        page, pageSize: PAGE_SIZE, sortBy: "createdAt", sortDir: "desc",
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (prediction !== "all") params.prediction = prediction;
      if (jobRole !== "all") params.jobRole = jobRole;
      if (experience !== "all") params.experience = experience;
      if (probability !== "any") params.probability = probability;
      const res = await candidateApi.list(params);
      setCandidates(res.candidates);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err.message || "Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, prediction, jobRole, experience, probability]);

  useEffect(() => { load(); }, [load]);

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setPrediction("all");
    setJobRole("all");
    setExperience("all");
    setProbability("any");
    setPage(1);
  };

  const hasActiveFilters = debouncedSearch || prediction !== "all" || jobRole !== "all" || experience !== "all" || probability !== "any";

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (c: Candidate) => { setEditing(c); setFormOpen(true); };
  const openDelete = (c: Candidate) => { setDeleting(c); setDeleteOpen(true); };

  const handleRunPrediction = (c: Candidate) => {
    navigate("screening", { candidateId: c.id });
  };

  const compareCount = compareCandidateIds.length;
  const selectedAllOnPage = candidates.length > 0 && candidates.every((c) => compareCandidateIds.includes(c.id));

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
    <div className="space-y-6 p-4 md:p-6 pb-32">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Candidates</h1>
          <p className="text-sm text-muted-foreground">Manage and analyze all candidates.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("screening")}>
            <Upload className="mr-2 h-4 w-4" /> Upload Resume
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Candidate
          </Button>
        </div>
      </div>

      {/* Filters card */}
      <Card>
        <CardContent className="p-4 md:p-5">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, job role, or skills..."
                className="pl-9"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <Select value={prediction} onValueChange={(v) => { setPrediction(v); setPage(1); }}>
                <SelectTrigger className="w-full"><Filter className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" /><SelectValue placeholder="Prediction" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Predictions</SelectItem>
                  <SelectItem value="hired">Hired</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select value={jobRole} onValueChange={(v) => { setJobRole(v); setPage(1); }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Job Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {JOB_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={experience} onValueChange={(v) => { setExperience(v); setPage(1); }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Experience" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Experience</SelectItem>
                  <SelectItem value="0-2">0–2 years</SelectItem>
                  <SelectItem value="3-5">3–5 years</SelectItem>
                  <SelectItem value="6-10">6–10 years</SelectItem>
                  <SelectItem value="10+">10+ years</SelectItem>
                </SelectContent>
              </Select>
              <Select value={probability} onValueChange={(v) => { setProbability(v); setPage(1); }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Probability" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Probability</SelectItem>
                  <SelectItem value=">50">{">"}50%</SelectItem>
                  <SelectItem value=">70">{">"}70%</SelectItem>
                  <SelectItem value=">80">{">"}80%</SelectItem>
                  <SelectItem value=">90">{">"}90%</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" onClick={clearFilters} disabled={!hasActiveFilters} className="justify-start text-muted-foreground sm:justify-center">
                <X className="mr-1.5 h-3.5 w-3.5" /> Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">
              {loading ? "Loading candidates…" : `${total} candidate${total === 1 ? "" : "s"}`}
            </CardTitle>
            <CardDescription className="text-xs">
              {hasActiveFilters ? "Filtered results" : "Showing all candidates"}
            </CardDescription>
          </div>
          {candidates.length > 0 && (
            <Badge variant="outline" className="text-xs">
              Page {page} of {totalPages || 1}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : candidates.length === 0 ? (
            <EmptyState
              icon={Users}
              title={hasActiveFilters ? "No candidates match your filters" : "No candidates yet"}
              description={hasActiveFilters
                ? "Try adjusting or clearing the filters to see more results."
                : "Add your first candidate to start running predictions."}
              actionLabel={hasActiveFilters ? "Clear Filters" : "Add Candidate"}
              onAction={hasActiveFilters ? clearFilters : openCreate}
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-10 pl-4">
                        <Checkbox
                          checked={selectedAllOnPage}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const toAdd = candidates.filter((c) => !compareCandidateIds.includes(c.id));
                              const spaceLeft = 5 - compareCandidateIds.length;
                              if (toAdd.length > spaceLeft && spaceLeft > 0) {
                                toast.warning("Compare limit reached", { description: `Only ${spaceLeft} more candidate${spaceLeft === 1 ? "" : "s"} can be added.` });
                              } else if (spaceLeft === 0) {
                                toast.warning("Compare limit reached", { description: "Maximum 5 candidates can be compared." });
                                return;
                              }
                              toAdd.slice(0, spaceLeft).forEach((c) => toggleCompareCandidate(c.id));
                            } else {
                              candidates.forEach((c) => {
                                if (compareCandidateIds.includes(c.id)) toggleCompareCandidate(c.id);
                              });
                            }
                          }}
                          aria-label="Select all on page"
                        />
                      </TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Job Role</TableHead>
                      <TableHead>Experience</TableHead>
                      <TableHead>Education</TableHead>
                      <TableHead>Skills</TableHead>
                      <TableHead>Prediction</TableHead>
                      <TableHead>Probability</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="pr-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((c) => {
                      const isCompared = compareCandidateIds.includes(c.id);
                      const prob = c.latestPrediction
                        ? (c.latestPrediction.prediction === "Hired"
                          ? c.latestPrediction.hireProbability
                          : c.latestPrediction.rejectProbability)
                        : null;
                      return (
                        <TableRow key={c.id} className={isCompared ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""}>
                          <TableCell className="pl-4">
                            <Checkbox
                              checked={isCompared}
                              onCheckedChange={() => {
                                if (!isCompared && compareCandidateIds.length >= 5) {
                                  toast.warning("Compare limit reached", { description: "You can compare up to 5 candidates at once." });
                                  return;
                                }
                                toggleCompareCandidate(c.id);
                              }}
                              aria-label={`Compare ${c.name}`}
                            />
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => navigate("candidate-details", { candidateId: c.id })}
                              className="flex items-center gap-2.5 text-left"
                            >
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-semibold text-white">
                                  {getInitials(c.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium leading-tight hover:text-primary">{c.name}</div>
                                <div className="text-xs text-muted-foreground">{c.email || "—"}</div>
                              </div>
                            </button>
                          </TableCell>
                          <TableCell className="text-sm">{c.jobRole}</TableCell>
                          <TableCell className="text-sm">{c.experience} yrs</TableCell>
                          <TableCell className="text-sm">{c.education}</TableCell>
                          <TableCell><SkillChips skills={splitTags(c.skills)} /></TableCell>
                          <TableCell>
                            {c.latestPrediction ? (
                              <Badge variant="secondary" className={predictionBadgeClass(c.latestPrediction.prediction)}>
                                {c.latestPrediction.prediction}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">PENDING</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {prob !== null ? (
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className={c.latestPrediction?.prediction === "Hired" ? "h-full bg-emerald-500" : "h-full bg-red-500"}
                                    style={{ width: `${prob * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium tabular-nums">{(prob * 100).toFixed(0)}%</span>
                              </div>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground" title={format(new Date(c.createdAt), "PPpp")}>
                            {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="pr-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => navigate("candidate-details", { candidateId: c.id })}>
                                  <Eye className="mr-2 h-3.5 w-3.5" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEdit(c)}>
                                  <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRunPrediction(c)}>
                                  <Zap className="mr-2 h-3.5 w-3.5" /> Run Prediction
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => openDelete(c)}>
                                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 p-4 md:hidden">
                {candidates.map((c) => {
                  const isCompared = compareCandidateIds.includes(c.id);
                  const prob = c.latestPrediction
                    ? (c.latestPrediction.prediction === "Hired"
                      ? c.latestPrediction.hireProbability
                      : c.latestPrediction.rejectProbability)
                    : null;
                  return (
                    <Card key={c.id} className={isCompared ? "border-emerald-300 dark:border-emerald-800" : ""}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isCompared}
                            onCheckedChange={() => {
                              if (!isCompared && compareCandidateIds.length >= 5) {
                                toast.warning("Compare limit reached", { description: "Maximum 5 candidates can be compared." });
                                return;
                              }
                              toggleCompareCandidate(c.id);
                            }}
                            className="mt-1"
                            aria-label={`Compare ${c.name}`}
                          />
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-semibold text-white">
                              {getInitials(c.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate font-medium">{c.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{c.jobRole}</p>
                              </div>
                              {c.latestPrediction ? (
                                <Badge variant="secondary" className={predictionBadgeClass(c.latestPrediction.prediction)}>
                                  {c.latestPrediction.prediction}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">PENDING</Badge>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>{c.experience} yrs exp</span>
                              <span>·</span>
                              <span>{c.education}</span>
                              {prob !== null && (
                                <>
                                  <span>·</span>
                                  <span className="font-medium text-foreground">{(prob * 100).toFixed(0)}% prob</span>
                                </>
                              )}
                            </div>
                            <div className="mt-2">
                              <SkillChips skills={splitTags(c.skills)} />
                            </div>
                            <div className="mt-3 flex gap-2">
                              <Button size="sm" variant="outline" className="h-7 flex-1" onClick={() => navigate("candidate-details", { candidateId: c.id })}>
                                <Eye className="mr-1.5 h-3 w-3" /> View
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7" onClick={() => openEdit(c)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => openDelete(c)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
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

      {/* Floating compare bar */}
      {compareCount >= 2 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                <GitCompare className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">{compareCount} candidate{compareCount === 1 ? "" : "s"} selected</p>
                <p className="text-xs text-muted-foreground">Compare them side by side</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => useAppStore.getState().clearCompare()}>
                Clear
              </Button>
              <Button size="sm" onClick={() => navigate("comparison")}>
                <GitCompare className="mr-1.5 h-3.5 w-3.5" /> Compare Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Single selected hint */}
      {compareCount === 1 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <p className="text-sm text-muted-foreground">Select at least one more candidate to compare (max 5).</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => useAppStore.getState().clearCompare()}>Dismiss</Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <CandidateFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} onSaved={load} />
      <DeleteCandidateDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        candidate={deleting}
        onDeleted={load}
      />
    </div>
  );
}
