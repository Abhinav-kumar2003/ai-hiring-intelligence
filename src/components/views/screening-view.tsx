"use client";
import { useCallback, useRef, useState } from "react";
import { resumeApi, predictionApi, type PredictInput } from "@/services/api";
import { useAppStore } from "@/store/app-store";
import type { ParsedResume, PredictionResult } from "@/types";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import { LoadingState, ErrorState } from "@/components/shared/states";
import { toast } from "sonner";
import {
  Upload, FileText, X, Zap, Sparkles, CheckCircle2, Circle, Pencil, Eye,
  Briefcase, GraduationCap, Wrench, Award, DollarSign, FolderGit2,
  Mail, Phone, User as UserIcon, FileSearch, ArrowRight, AlertCircle,
} from "lucide-react";
import { z } from "zod";

// ---- constants -------------------------------------------------------------
const JOB_ROLES = ["AI Researcher", "Cybersecurity Analyst", "Data Scientist", "Software Engineer"];
const EDUCATION_OPTIONS = ["B.Sc", "B.Tech", "M.Tech", "MBA", "PhD"];
const MAX_FILE_MB = 10;

const PROCESSING_STEPS = [
  { id: "reading", label: "Reading document" },
  { id: "skills", label: "Extracting skills" },
  { id: "education", label: "Detecting education" },
  { id: "experience", label: "Analyzing experience" },
  { id: "certs", label: "Detecting certifications" },
  { id: "preparing", label: "Preparing prediction" },
] as const;

// ---- validation schema -----------------------------------------------------
const analysisSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email").or(z.literal("")),
  phone: z.string().optional(),
  experience: z.coerce.number().min(0, "Experience must be ≥ 0").max(50, "Experience must be ≤ 50"),
  education: z.string().min(1, "Education is required"),
  jobRole: z.string().min(1, "Job role is required"),
  salaryExpectation: z.coerce.number().min(0, "Salary must be ≥ 0"),
  projectsCount: z.coerce.number().int().min(0, "Projects must be ≥ 0"),
});

// ---- TagInput (inline) -----------------------------------------------------
interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  accent?: "emerald" | "teal";
}
function TagInput({ value, onChange, placeholder = "Type and press Enter", accent = "emerald" }: TagInputProps) {
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
  const accentClasses = accent === "teal"
    ? "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-sm focus-within:ring-2 focus-within:ring-ring/40">
      {value.map((tag) => (
        <span key={tag} className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${accentClasses}`}>
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="opacity-70 hover:opacity-100"
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

// ---- Processing Animation --------------------------------------------------
function ProcessingAnimation({ currentStep }: { currentStep: number }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          AI is analyzing the resume
        </CardTitle>
        <CardDescription>This usually takes a few seconds.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {PROCESSING_STEPS.map((step, idx) => {
            const state = idx < currentStep ? "done" : idx === currentStep ? "active" : "pending";
            return (
              <li key={step.id} className="flex items-center gap-3">
                {state === "done" ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                ) : state === "active" ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent dark:border-emerald-400" />
                  </span>
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Circle className="h-4 w-4" />
                  </span>
                )}
                <span
                  className={
                    state === "done"
                      ? "text-sm font-medium text-foreground"
                      : state === "active"
                      ? "text-sm font-medium text-emerald-700 dark:text-emerald-400"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---- Resume Analysis Form --------------------------------------------------
interface AnalysisFormProps {
  parsed: ParsedResume | null;
  predicting: boolean;
  onPredict: (input: PredictInput) => Promise<void>;
  hasUploadedResume: boolean;
}
function AnalysisForm({ parsed, predicting, onPredict, hasUploadedResume }: AnalysisFormProps) {
  // This component is keyed by the parent (via `key` prop) so that a fresh parsed
  // resume always initializes the form state through useState initializers,
  // avoiding cascading setState-in-effect renders.
  const [editMode, setEditMode] = useState(hasUploadedResume ? false : true);
  const [name, setName] = useState(parsed?.name ?? "");
  const [email, setEmail] = useState(parsed?.email ?? "");
  const [phone, setPhone] = useState(parsed?.phone ?? "");
  const [experience, setExperience] = useState(String(parsed?.experienceYears ?? 0));
  const [education, setEducation] = useState(parsed?.education ?? "");
  const [jobRole, setJobRole] = useState(parsed?.jobRole ?? "");
  const [salaryExpectation, setSalaryExpectation] = useState(String(parsed?.salaryExpectation ?? 0));
  const [projectsCount, setProjectsCount] = useState(String(parsed?.projectsCount ?? 0));
  const [skills, setSkills] = useState<string[]>(parsed?.skills ?? []);
  const [certifications, setCertifications] = useState<string[]>(parsed?.certifications ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedValues = analysisSchema.safeParse({
      name, email, phone, experience, education, jobRole, salaryExpectation, projectsCount,
    });
    if (!parsedValues.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsedValues.error.issues) {
        if (issue.path[0]) fe[String(issue.path[0])] = issue.message;
      }
      setErrors(fe);
      toast.error("Please fix the highlighted fields", { description: "Some required fields are missing or invalid." });
      return;
    }
    const input: PredictInput = {
      ...parsedValues.data,
      email: parsedValues.data.email || "",
      phone: parsedValues.data.phone || "",
      skills: skills.join(", "),
      certifications: certifications.join(", "),
    };
    await onPredict(input);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Resume Analysis</CardTitle>
          <CardDescription>
            {hasUploadedResume
              ? "Review the AI-extracted information and edit if needed."
              : "Enter candidate details manually to run a prediction."}
          </CardDescription>
        </div>
        {hasUploadedResume && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={editMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditMode((v) => !v)}
                >
                  {editMode ? <><Eye className="mr-1.5 h-3.5 w-3.5" /> View</> : <><Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit</>}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{editMode ? "Switch to read-only view" : "Edit extracted fields"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Info */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold">Personal Information</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
                {editMode ? (
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Doe" />
                ) : (
                  <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm">{name || "—"}</div>
                )}
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
                {editMode ? (
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
                ) : (
                  <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm">{email || "—"}</div>
                )}
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone</Label>
                {editMode ? (
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0100" />
                ) : (
                  <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm">{phone || "—"}</div>
                )}
              </div>
            </div>
          </section>

          <Separator />

          {/* Professional Info */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold">Professional Information</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="experience" className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> Experience (years) <span className="text-destructive">*</span></Label>
                {editMode ? (
                  <Input id="experience" type="number" min={0} max={50} value={experience} onChange={(e) => setExperience(e.target.value)} />
                ) : (
                  <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm">{experience} yrs</div>
                )}
                {errors.experience && <p className="text-xs text-destructive">{errors.experience}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jobRole" className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> Job Role <span className="text-destructive">*</span></Label>
                {editMode ? (
                  <Select value={jobRole} onValueChange={setJobRole}>
                    <SelectTrigger id="jobRole" className="w-full"><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      {JOB_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm">{jobRole || "—"}</div>
                )}
                {errors.jobRole && <p className="text-xs text-destructive">{errors.jobRole}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="education" className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> Education <span className="text-destructive">*</span></Label>
                {editMode ? (
                  <Select value={education} onValueChange={setEducation}>
                    <SelectTrigger id="education" className="w-full"><SelectValue placeholder="Select education" /></SelectTrigger>
                    <SelectContent>
                      {EDUCATION_OPTIONS.map((ed) => <SelectItem key={ed} value={ed}>{ed}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm">{education || "—"}</div>
                )}
                {errors.education && <p className="text-xs text-destructive">{errors.education}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="salary" className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Salary Expectation ($) <span className="text-destructive">*</span></Label>
                {editMode ? (
                  <Input id="salary" type="number" min={0} value={salaryExpectation} onChange={(e) => setSalaryExpectation(e.target.value)} />
                ) : (
                  <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm">${Number(salaryExpectation || 0).toLocaleString()}</div>
                )}
                {errors.salaryExpectation && <p className="text-xs text-destructive">{errors.salaryExpectation}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="projects" className="flex items-center gap-1.5"><FolderGit2 className="h-3.5 w-3.5" /> Projects Count <span className="text-destructive">*</span></Label>
                {editMode ? (
                  <Input id="projects" type="number" min={0} value={projectsCount} onChange={(e) => setProjectsCount(e.target.value)} />
                ) : (
                  <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm">{projectsCount}</div>
                )}
                {errors.projectsCount && <p className="text-xs text-destructive">{errors.projectsCount}</p>}
              </div>
            </div>
          </section>

          <Separator />

          {/* Skills */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold">Skills</h3>
              {skills.length > 0 && <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{skills.length}</Badge>}
            </div>
            {editMode ? (
              <TagInput value={skills} onChange={setSkills} placeholder="Type a skill and press Enter" accent="emerald" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {skills.length === 0 ? <span className="text-sm text-muted-foreground">—</span> :
                  skills.map((s) => <Badge key={s} variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{s}</Badge>)}
              </div>
            )}
          </section>

          <Separator />

          {/* Certifications */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold">Certifications</h3>
              {certifications.length > 0 && <Badge variant="secondary" className="bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">{certifications.length}</Badge>}
            </div>
            {editMode ? (
              <TagInput value={certifications} onChange={setCertifications} placeholder="Type a certification and press Enter" accent="teal" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {certifications.length === 0 ? <span className="text-sm text-muted-foreground">—</span> :
                  certifications.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}
              </div>
            )}
          </section>

          <Separator />

          {/* Submit */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              The AI model will analyze these inputs and produce a hire probability score with explanations.
            </p>
            <Button type="submit" size="lg" disabled={predicting} className="sm:w-auto">
              {predicting ? (
                <>
                  <span className="mr-1 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Analyzing candidate...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" /> Analyze Candidate
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---- Main ScreeningView ----------------------------------------------------
export function ScreeningView() {
  const { navigate, setLastPrediction } = useAppStore();
  const [mode, setMode] = useState<"upload" | "manual">("upload");

  // Upload state
  const [pasteText, setPasteText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Processing animation
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [parsed, setParsed] = useState<ParsedResume | null>(null);

  // Prediction
  const [predicting, setPredicting] = useState(false);

  const hasUploadedResume = parsed !== null;

  // ---- run processing animation, call API in parallel ---------------------
  const runProcessing = useCallback(async (uploadFn: () => Promise<ParsedResume>) => {
    setProcessing(true);
    setProcessingStep(0);
    setUploadError("");
    // Fire the API call immediately, sequentially reveal steps at 400-600ms intervals
    const start = performance.now();
    const apiPromise = uploadFn();
    const stepTimers: number[] = [];
    let cumulativeDelay = 0;
    for (let i = 0; i < PROCESSING_STEPS.length; i++) {
      const delay = 400 + Math.round(Math.random() * 200);
      cumulativeDelay += delay;
      const t = window.setTimeout(() => setProcessingStep(i + 1), cumulativeDelay);
      stepTimers.push(t);
    }
    try {
      const result = await apiPromise;
      // Ensure all steps completed visually before showing results
      const elapsed = performance.now() - start;
      const msRemaining = Math.max(0, cumulativeDelay - elapsed + 200);
      if (msRemaining > 0) await new Promise<void>((r) => window.setTimeout(r, msRemaining));
      setParsed(result);
      toast.success("Resume parsed", { description: "Review the extracted information below." });
    } catch (err: any) {
      setUploadError(err?.message || "Failed to parse resume.");
      toast.error("Resume parsing failed", { description: err?.message || "Please try again." });
    } finally {
      stepTimers.forEach((t) => window.clearTimeout(t));
      setProcessing(false);
      setProcessingStep(0);
    }
  }, []);

  // ---- file handling -------------------------------------------------------
  const handleFile = useCallback((file: File) => {
    const isTxt = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");
    if (!isTxt) {
      toast.error("Unsupported file type", { description: "Only .txt resume files are supported in this demo." });
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error("File too large", { description: `Maximum file size is ${MAX_FILE_MB}MB.` });
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setUploading(false);
      runProcessing(async () => {
        const res = await resumeApi.upload({
          mode: "text",
          text,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "text/plain",
        });
        return res.parsed;
      });
    };
    reader.onerror = () => {
      setUploading(false);
      toast.error("Failed to read file", { description: "Could not read the selected file." });
    };
    reader.readAsText(file);
  }, [runProcessing]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleBrowse = () => fileInputRef.current?.click();

  const handlePasteSubmit = () => {
    const text = pasteText.trim();
    if (text.length < 20) {
      toast.error("Resume text too short", { description: "Please paste at least 20 characters of resume content." });
      return;
    }
    runProcessing(async () => {
      const res = await resumeApi.upload({ mode: "text", text });
      return res.parsed;
    });
  };

  const handleSample = (sampleType: "strong" | "weak") => {
    runProcessing(async () => {
      const res = await resumeApi.upload({ mode: "sample", sampleType });
      return res.parsed;
    });
  };

  // ---- run prediction ------------------------------------------------------
  const handlePredict = async (input: PredictInput) => {
    setPredicting(true);
    try {
      const result = await predictionApi.predict(input, undefined, true) as PredictionResult;
      setLastPrediction(result);
      toast.success("Prediction completed", {
        description: `Result: ${result.prediction} (${(result.hireProbability * 100).toFixed(1)}% hire probability)`,
      });
      if (result.predictionId) {
        navigate("prediction-result", { predictionId: result.predictionId });
      } else {
        navigate("prediction-result");
      }
    } catch (err: any) {
      toast.error("Prediction failed", { description: err?.message || "Please try again." });
    } finally {
      setPredicting(false);
    }
  };

  const handleReset = () => {
    setParsed(null);
    setPasteText("");
    setUploadError("");
  };

  // ---- render --------------------------------------------------------------
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">AI Resume Screening</h1>
          <p className="text-sm text-muted-foreground">Upload a resume and let the AI analyze the candidate.</p>
        </div>
        <div className="flex gap-2">
          {hasUploadedResume && (
            <Button variant="outline" onClick={handleReset}>
              <Upload className="mr-2 h-4 w-4" /> Upload Another
            </Button>
          )}
        </div>
      </div>

      {/* Mode toggle (only visible before/after upload, not during processing) */}
      {!processing && !hasUploadedResume && (
        <Tabs value={mode} onValueChange={(v) => setMode(v as "upload" | "manual")}>
          <TabsList className="w-full max-w-md">
            <TabsTrigger value="upload" className="flex-1">
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload Resume
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex-1">
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Manual Entry
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Upload mode: drop zone / processing / analysis */}
      {mode === "upload" && !hasUploadedResume && (
        processing ? (
          <ProcessingAnimation currentStep={processingStep} />
        ) : (
          <div className="space-y-6">
            {/* Drop zone */}
            <Card>
              <CardContent className="p-4 md:p-6">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
                    dragActive
                      ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20"
                      : "border-muted-foreground/30 hover:border-emerald-400/60 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                    {uploading ? (
                      <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                    ) : (
                      <Upload className="h-6 w-6" />
                    )}
                  </div>
                  <p className="mt-4 text-base font-medium">Drag and drop a resume here</p>
                  <p className="mt-1 text-xs text-muted-foreground">PDF or DOCX · Max {MAX_FILE_MB}MB · Accepts .txt files</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = "";
                    }}
                  />
                  <Button className="mt-4" onClick={handleBrowse} disabled={uploading}>
                    <FileText className="mr-2 h-4 w-4" /> Browse Files
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Paste text */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-emerald-600" /> Or paste resume text
                </CardTitle>
                <CardDescription>Paste the raw text content of a resume (e.g. copied from a PDF).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste resume text here..."
                  className="min-h-[160px] font-mono text-xs"
                />
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">{pasteText.length} characters</p>
                  <Button onClick={handlePasteSubmit} disabled={pasteText.trim().length < 20 || uploading}>
                    <Sparkles className="mr-2 h-4 w-4" /> Parse Text
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Samples */}
            <Card className="border-emerald-200/60 dark:border-emerald-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-emerald-600" /> Try a sample resume
                </CardTitle>
                <CardDescription>Use a pre-built resume to see how the screening works end-to-end.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Button variant="outline" className="h-auto justify-start py-3" onClick={() => handleSample("strong")}>
                  <div className="flex w-full items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold">Try Sample Resume (Strong)</p>
                      <p className="text-xs text-muted-foreground">Highly qualified candidate likely to be hired.</p>
                    </div>
                    <ArrowRight className="mt-2 h-4 w-4 text-muted-foreground" />
                  </div>
                </Button>
                <Button variant="outline" className="h-auto justify-start py-3" onClick={() => handleSample("weak")}>
                  <div className="flex w-full items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
                      <AlertCircle className="h-4 w-4" />
                    </span>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold">Try Sample Resume (Weak)</p>
                      <p className="text-xs text-muted-foreground">Candidate with gaps that may lead to rejection.</p>
                    </div>
                    <ArrowRight className="mt-2 h-4 w-4 text-muted-foreground" />
                  </div>
                </Button>
              </CardContent>
            </Card>

            {uploadError && <ErrorState message={uploadError} onRetry={() => setUploadError("")} />}
          </div>
        )
      )}

      {/* Resume analysis (upload mode after parsing OR manual entry mode) */}
      {(mode === "manual" || hasUploadedResume) && (
        <AnalysisForm
          key={parsed?.rawText ?? "manual"}
          parsed={parsed}
          predicting={predicting}
          onPredict={handlePredict}
          hasUploadedResume={hasUploadedResume}
        />
      )}

      {/* Footer hint card (only when manual mode and nothing entered yet) */}
      {mode === "manual" && !hasUploadedResume && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                <FileSearch className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-medium">Want to skip manual entry?</p>
                <p className="text-xs text-muted-foreground">Upload a resume and the AI will pre-fill the form for you.</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setMode("upload")}>
              <Upload className="mr-2 h-4 w-4" /> Switch to Upload
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
