"use client";
import { useCallback, useEffect, useState } from "react";
import { candidateApi, predictionApi } from "@/services/api";
import { useAppStore } from "@/store/app-store";
import type { Candidate, PredictionWithExplanations, PredictionResult } from "@/types";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/states";
import { CircularProgress } from "@/components/shared/circular-progress";
import { toast } from "sonner";
import { z } from "zod";
import {
  ArrowLeft, Pencil, Zap, Trash2, Download, GitCompare, User, Briefcase,
  GraduationCap, Wrench, Award, DollarSign, FolderGit2, FileText,
  CheckCircle2, Circle, Upload, X,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// ---- constants -------------------------------------------------------------
const JOB_ROLES = ["AI Researcher", "Cybersecurity Analyst", "Data Scientist", "Software Engineer"];
const EDUCATION_OPTIONS = ["B.Sc", "B.Tech", "M.Tech", "MBA", "PhD"];

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

// ---- TagInput (shared inline) ---------------------------------------------
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
      setInput(""); return;
    }
    onChange([...value, tag]);
    setInput("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-sm focus-within:ring-2 focus-within:ring-ring/40">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`Remove ${tag}`}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); }
          else if (e.key === "Backspace" && !input && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={addTag}
        placeholder={value.length === 0 ? placeholder : ""}
        className="min-w-[80px] flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

// ---- Edit dialog -----------------------------------------------------------
const editSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email").or(z.literal("")),
  phone: z.string().optional(),
  experience: z.coerce.number().min(0).max(50),
  education: z.string().min(1, "Education is required"),
  jobRole: z.string().min(1, "Job role is required"),
  salaryExpectation: z.coerce.number().min(0),
  projectsCount: z.coerce.number().int().min(0),
});
function EditCandidateDialog({ open, onOpenChange, candidate, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  candidate: Candidate | null; onSaved: () => void;
}) {
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
    if (open && candidate) {
      setName(candidate.name);
      setEmail(candidate.email ?? "");
      setPhone(candidate.phone ?? "");
      setExperience(String(candidate.experience));
      setEducation(candidate.education);
      setJobRole(candidate.jobRole);
      setSalaryExpectation(String(candidate.salaryExpectation));
      setProjectsCount(String(candidate.projectsCount));
      setSkills(splitTags(candidate.skills));
      setCertifications(splitTags(candidate.certifications));
      setErrors({});
    }
  }, [open, candidate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate) return;
    const parsed = editSchema.safeParse({
      name, email, phone, experience, education, jobRole, salaryExpectation, projectsCount,
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) if (issue.path[0]) fe[String(issue.path[0])] = issue.message;
      setErrors(fe); return;
    }
    setSaving(true);
    try {
      await candidateApi.update(candidate.id, {
        ...parsed.data,
        email: parsed.data.email || "",
        phone: parsed.data.phone || "",
        skills: skills.join(", "),
        certifications: certifications.join(", "),
      });
      toast.success("Candidate updated", { description: `${parsed.data.name}'s profile has been saved.` });
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error("Failed to update candidate", { description: err.message });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Candidate</DialogTitle>
          <DialogDescription>Update candidate profile information.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exp">Experience (years)</Label>
            <Input id="exp" type="number" min={0} max={50} value={experience} onChange={(e) => setExperience(e.target.value)} />
            {errors.experience && <p className="text-xs text-destructive">{errors.experience}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edu">Education</Label>
            <Select value={education} onValueChange={setEducation}>
              <SelectTrigger id="edu" className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {EDUCATION_OPTIONS.map((ed) => <SelectItem key={ed} value={ed}>{ed}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.education && <p className="text-xs text-destructive">{errors.education}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Job Role</Label>
            <Select value={jobRole} onValueChange={setJobRole}>
              <SelectTrigger id="role" className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {JOB_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.jobRole && <p className="text-xs text-destructive">{errors.jobRole}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sal">Salary Expectation ($)</Label>
            <Input id="sal" type="number" min={0} value={salaryExpectation} onChange={(e) => setSalaryExpectation(e.target.value)} />
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
            <Label htmlFor="proj">Projects Count</Label>
            <Input id="proj" type="number" min={0} value={projectsCount} onChange={(e) => setProjectsCount(e.target.value)} />
            {errors.projectsCount && <p className="text-xs text-destructive">{errors.projectsCount}</p>}
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <span className="mr-1 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Delete dialog ---------------------------------------------------------
function DeleteDialog({ open, onOpenChange, candidate, onDeleted }: {
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
    } finally { setDeleting(false); }
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
          <AlertDialogAction onClick={confirm} disabled={deleting} className="bg-destructive text-white hover:bg-destructive/90">
            {deleting && <span className="mr-1 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---- timeline entry --------------------------------------------------------
interface TimelineEntry {
  title: string;
  description: string;
  timestamp: Date;
  icon: typeof Upload;
  completed: boolean;
}

// ---- main view -------------------------------------------------------------
export function CandidateDetailsView() {
  const {
    selectedCandidateId, navigate, setLastPrediction, toggleCompareCandidate,
    compareCandidateIds,
  } = useAppStore();

  const [candidate, setCandidate] = useState<(Candidate & { predictions: PredictionWithExplanations[]; resumeFile?: any }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [predicting, setPredicting] = useState(false);

  const load = useCallback(async () => {
    if (!selectedCandidateId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { candidate: c } = await candidateApi.get(selectedCandidateId);
      setCandidate(c);
    } catch (err: any) {
      setError(err.message || "Failed to load candidate");
    } finally {
      setLoading(false);
    }
  }, [selectedCandidateId]);

  useEffect(() => { load(); }, [load]);

  const handleRunPrediction = async () => {
    if (!candidate) return;
    setPredicting(true);
    try {
      const result = await predictionApi.predict({
        name: candidate.name,
        email: candidate.email ?? undefined,
        phone: candidate.phone ?? undefined,
        skills: candidate.skills,
        experience: candidate.experience,
        education: candidate.education,
        certifications: candidate.certifications,
        jobRole: candidate.jobRole,
        salaryExpectation: candidate.salaryExpectation,
        projectsCount: candidate.projectsCount,
      }, candidate.id, true);
      setLastPrediction(result as PredictionResult);
      toast.success("Prediction completed", {
        description: `Result: ${result.prediction} (${(result.hireProbability * 100).toFixed(1)}% hire probability)`,
      });
      if (result.predictionId) {
        navigate("prediction-result", { predictionId: result.predictionId });
      } else {
        load();
      }
    } catch (err: any) {
      toast.error("Prediction failed", { description: err.message });
    } finally { setPredicting(false); }
  };

  const handleCompare = () => {
    if (!candidate) return;
    if (!compareCandidateIds.includes(candidate.id)) {
      if (compareCandidateIds.length >= 5) {
        toast.warning("Compare limit reached", { description: "Maximum 5 candidates can be compared." });
        return;
      }
      toggleCompareCandidate(candidate.id);
      toast.success("Added to comparison", { description: `${candidate.name} added (${compareCandidateIds.length + 1}/5).` });
    }
    navigate("comparison");
  };

  const handleDelete = () => {
    setCandidate(null);
    navigate("candidates");
  };

  // Loading / error / empty states
  if (!selectedCandidateId) {
    return (
      <div className="p-4 md:p-6">
        <EmptyState
          icon={User}
          title="No candidate selected"
          description="Choose a candidate from the list to view their profile and predictions."
          actionLabel="Back to Candidates"
          onAction={() => navigate("candidates")}
        />
      </div>
    );
  }
  if (loading) return <LoadingState message="Loading candidate profile..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!candidate) {
    return (
      <div className="p-4 md:p-6">
        <EmptyState
          icon={User}
          title="Candidate not found"
          description="The candidate you're looking for doesn't exist or has been deleted."
          actionLabel="Back to Candidates"
          onAction={() => navigate("candidates")}
        />
      </div>
    );
  }

  // Derived data
  const skills = splitTags(candidate.skills);
  const certifications = splitTags(candidate.certifications);
  const predictions = candidate.predictions || [];
  const latest = candidate.latestPrediction;
  const latestProb = latest
    ? (latest.prediction === "Hired" ? latest.hireProbability : latest.rejectProbability)
    : null;

  // Timeline derivation
  const timeline: TimelineEntry[] = [];
  timeline.push({
    title: "Candidate created",
    description: `Added to pipeline via ${candidate.source === "resume" ? "resume upload" : "manual entry"}`,
    timestamp: new Date(candidate.createdAt),
    icon: Upload,
    completed: true,
  });
  if (candidate.resumeFile) {
    timeline.push({
      title: "Resume uploaded",
      description: candidate.resumeFile.fileName || "Resume file attached",
      timestamp: new Date(candidate.resumeFile.uploadedAt || candidate.createdAt),
      icon: FileText,
      completed: true,
    });
  }
  if (predictions.length > 0) {
    timeline.push({
      title: "First prediction generated",
      description: `Model: ${predictions[predictions.length - 1].modelName}`,
      timestamp: new Date(predictions[predictions.length - 1].createdAt),
      icon: Zap,
      completed: true,
    });
    if (predictions.length > 1) {
      timeline.push({
        title: "Latest prediction",
        description: `${latest?.prediction} · ${(latestProb! * 100).toFixed(1)}% probability`,
        timestamp: new Date(latest!.createdAt),
        icon: CheckCircle2,
        completed: true,
      });
    }
  }
  if (new Date(candidate.updatedAt).getTime() > new Date(candidate.createdAt).getTime() + 1000) {
    timeline.push({
      title: "Profile updated",
      description: "Candidate information was modified",
      timestamp: new Date(candidate.updatedAt),
      icon: Pencil,
      completed: true,
    });
  }
  timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("candidates")} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-semibold text-white">
              {getInitials(candidate.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">{candidate.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {candidate.jobRole}</span>
              <span>·</span>
              <span>{candidate.experience} yrs experience</span>
              {candidate.email && (<><span>·</span><span>{candidate.email}</span></>)}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button onClick={handleRunPrediction} disabled={predicting}>
            {predicting
              ? <><span className="mr-1 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> Predicting...</>
              : <><Zap className="mr-2 h-4 w-4" /> Run Prediction</>}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Profile summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile Summary</CardTitle>
              <CardDescription>Candidate's professional background</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Experience</p>
                  <p className="flex items-center gap-1.5 text-sm font-medium"><Briefcase className="h-3.5 w-3.5 text-emerald-600" /> {candidate.experience} yrs</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Education</p>
                  <p className="flex items-center gap-1.5 text-sm font-medium"><GraduationCap className="h-3.5 w-3.5 text-emerald-600" /> {candidate.education}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Salary Expectation</p>
                  <p className="flex items-center gap-1.5 text-sm font-medium"><DollarSign className="h-3.5 w-3.5 text-emerald-600" /> ${candidate.salaryExpectation.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Projects</p>
                  <p className="flex items-center gap-1.5 text-sm font-medium"><FolderGit2 className="h-3.5 w-3.5 text-emerald-600" /> {candidate.projectsCount}</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-medium"><Wrench className="h-3.5 w-3.5 text-emerald-600" /> Skills</p>
                {skills.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No skills listed.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((s) => (
                      <Badge key={s} variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{s}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-medium"><Award className="h-3.5 w-3.5 text-emerald-600" /> Certifications</p>
                {certifications.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No certifications listed.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {certifications.map((c) => (
                      <Badge key={c} variant="outline">{c}</Badge>
                    ))}
                  </div>
                )}
              </div>
              {candidate.phone && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm">{candidate.phone}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Prediction history */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Prediction History</CardTitle>
                <CardDescription>{predictions.length} prediction{predictions.length === 1 ? "" : "s"} run</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("predictions")}>
                View All Predictions
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {predictions.length === 0 ? (
                <EmptyState
                  icon={Zap}
                  title="No predictions yet"
                  description="Run your first prediction to see results here."
                  actionLabel="Run Prediction"
                  onAction={handleRunPrediction}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="pl-4">Date</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Prediction</TableHead>
                      <TableHead>Probability</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead className="pr-4">Version</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {predictions.map((p) => {
                      const prob = p.prediction === "Hired" ? p.hireProbability : p.rejectProbability;
                      return (
                        <TableRow
                          key={p.id}
                          className="cursor-pointer"
                          onClick={() => navigate("prediction-result", { predictionId: p.id })}
                        >
                          <TableCell className="pl-4 text-xs text-muted-foreground" title={format(new Date(p.createdAt), "PPpp")}>
                            {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-xs">{p.modelName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={predictionBadgeClass(p.prediction)}>{p.prediction}</Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium tabular-nums">{(prob * 100).toFixed(1)}%</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{p.confidence}</Badge>
                          </TableCell>
                          <TableCell className="pr-4 text-xs text-muted-foreground font-mono">{p.modelVersion}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Timeline</CardTitle>
              <CardDescription>Key events for this candidate</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-5 border-l border-border pl-6">
                {timeline.map((entry, idx) => {
                  const Icon = entry.icon;
                  return (
                    <li key={idx} className="relative">
                      <span className="absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                        <Icon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      </span>
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-medium">{entry.title}</p>
                        <p className="text-xs text-muted-foreground" title={format(entry.timestamp, "PPpp")}>
                          {formatDistanceToNow(entry.timestamp, { addSuffix: true })}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">{entry.description}</p>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-6">
          {/* Prediction card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Latest Prediction</CardTitle>
              <CardDescription>
                {latest ? formatDistanceToNow(new Date(latest.createdAt), { addSuffix: true }) : "No prediction yet"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {latest && latestProb !== null ? (
                <>
                  <CircularProgress
                    value={latestProb}
                    size={180}
                    color={latest.prediction === "Hired" ? "success" : "danger"}
                    label="Hire Probability"
                    sublabel={latest.prediction}
                  />
                  <div className="grid w-full grid-cols-2 gap-3 text-center">
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Model</p>
                      <p className="text-sm font-medium">{latest.modelName}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Confidence</p>
                      <p className="text-sm font-medium">{latest.confidence}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("prediction-result", { predictionId: latest.id })}>
                    View Full Result
                  </Button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <Circle className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">No prediction yet</p>
                    <p className="text-xs text-muted-foreground">Run a prediction to see results</p>
                  </div>
                  <Button size="sm" onClick={handleRunPrediction} disabled={predicting}>
                    <Zap className="mr-1.5 h-3.5 w-3.5" /> Run Prediction
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
              <CardDescription>Manage this candidate</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={handleRunPrediction} disabled={predicting}>
                <Zap className="mr-2 h-4 w-4 text-emerald-600" /> Run New Prediction
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={handleCompare}>
                <GitCompare className="mr-2 h-4 w-4 text-emerald-600" /> Compare with Others
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block">
                    <Button variant="outline" className="w-full justify-start" disabled>
                      <Download className="mr-2 h-4 w-4 text-muted-foreground" /> Download Report
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Coming soon</TooltipContent>
              </Tooltip>
              <Separator className="my-2" />
              <Button variant="outline" className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete Candidate
              </Button>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <Badge variant="outline" className="capitalize">{candidate.source}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span title={format(new Date(candidate.createdAt), "PPpp")}>{format(new Date(candidate.createdAt), "PP")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span title={format(new Date(candidate.updatedAt), "PPpp")}>{format(new Date(candidate.updatedAt), "PP")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Predictions</span>
                <span className="font-medium">{predictions.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <EditCandidateDialog open={editOpen} onOpenChange={setEditOpen} candidate={candidate} onSaved={load} />
      <DeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} candidate={candidate} onDeleted={handleDelete} />
    </div>
  );
}
