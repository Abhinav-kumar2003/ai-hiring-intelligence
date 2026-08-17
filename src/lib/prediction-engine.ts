/**
 * ML Prediction Engine (TypeScript)
 * --------------------------------
 * Loads the trained Random Forest model exported as JSON by the Python pipeline
 * (ml/model/model.json) and runs inference entirely in TypeScript - no Python
 * runtime required at request time.
 *
 * Also exposes:
 *  - Feature engineering (candidate -> feature vector)
 *  - Per-feature contribution explanation (mean-decrease-impurity proxy + direction)
 *  - Confidence calculation based on probability margin
 *
 * NOTE: Model artifacts are loaded lazily at runtime via `fs.readFileSync` (server
 * side only) instead of static JSON imports. This avoids bundling a ~1.9MB
 * model.json into the Next.js / Turbopack build, which previously exhausted
 * memory and crashed the dev server.
 */

import fs from "fs";
import path from "path";

// Directory containing the trained model artifacts. Resolved relative to the
// current working directory (the Next.js project root in dev and prod).
const MODEL_DIR = path.resolve(process.cwd(), "ml/model");

// Type for a tree node in the exported Random Forest
type TreeNode = {
  leaf: boolean;
  feature?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  value?: number[]; // [p_reject, p_hire]
  count?: number;
};

type ModelArtifact = {
  model_type: string;
  n_estimators: number;
  classes: number[];
  class_labels: string[];
  trees: TreeNode[];
  feature_names: string[];
  scaler: {
    mean: number[];
    scale: number[];
    numeric_indices: number[];
    numeric_names: string[];
  };
  categorical_encodings: {
    Education: string[];
    "Job Role": string[];
    Certifications: string[];
  };
};

export interface CandidateInput {
  name?: string;
  email?: string;
  phone?: string;
  skills: string;             // comma-separated
  experience: number;          // years
  education: string;           // e.g. "B.Tech"
  certifications: string;      // comma-separated or "None"/""
  jobRole: string;
  salaryExpectation: number;
  projectsCount: number;
}

export interface FeatureContribution {
  feature: string;            // human-readable
  rawValue: number | string;
  contribution: number;       // signed
  direction: "positive" | "negative" | "neutral";
  strength: "strong" | "moderate" | "low";
  displayValue: string;
}

export interface PredictionResult {
  prediction: "Hired" | "Rejected";
  hireProbability: number;     // 0..1
  rejectProbability: number;   // 0..1
  confidence: "High" | "Medium" | "Low";
  confidenceScore: number;     // 0..1
  modelName: string;
  modelVersion: string;
  explanations: FeatureContribution[];
  featureVector: Record<string, number>;
  warning: string;
}

// ---------------------------------------------------------------------
// Lazy singletons - each artifact is read from disk on first access and
// cached for the lifetime of the process. Loading happens at request time,
// not at module import time, so importing this module is cheap.
// ---------------------------------------------------------------------
let _model: ModelArtifact | null = null;
function getModel(): ModelArtifact {
  if (!_model) {
    const raw = fs.readFileSync(path.join(MODEL_DIR, "model.json"), "utf-8");
    _model = JSON.parse(raw) as ModelArtifact;
  }
  return _model;
}

let _metrics: any | null = null;
function getMetrics(): any {
  if (!_metrics) {
    const raw = fs.readFileSync(path.join(MODEL_DIR, "metrics.json"), "utf-8");
    _metrics = JSON.parse(raw);
  }
  return _metrics;
}

let _featureImportance: any | null = null;
function getFeatureImportanceData(): any {
  if (!_featureImportance) {
    const raw = fs.readFileSync(path.join(MODEL_DIR, "feature_importance.json"), "utf-8");
    _featureImportance = JSON.parse(raw);
  }
  return _featureImportance;
}

let _eda: any | null = null;
function getEDAData(): any {
  if (!_eda) {
    const raw = fs.readFileSync(path.join(MODEL_DIR, "eda.json"), "utf-8");
    _eda = JSON.parse(raw);
  }
  return _eda;
}

let _metadata: any | null = null;
function getMetadata(): any {
  if (!_metadata) {
    const raw = fs.readFileSync(path.join(MODEL_DIR, "metadata.json"), "utf-8");
    _metadata = JSON.parse(raw);
  }
  return _metadata;
}

// ---------------------------------------------------------------------
// Feature engineering - mirrors Python build_features() exactly.
// ---------------------------------------------------------------------
export function engineerFeatures(input: CandidateInput): {
  features: number[];
  featureMap: Record<string, number>;
  rawMap: Record<string, number | string>;
} {
  const MODEL = getModel();
  const skills = (input.skills || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const skillCount = skills.length;

  const certs = (input.certifications || "")
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c && c.toLowerCase() !== "none");
  const certCount = certs.length;
  const hasCert = certCount > 0 ? 1 : 0;

  const featureMap: Record<string, number> = {};
  const rawMap: Record<string, number | string> = {};

  // Numeric features (must match Python order exactly)
  featureMap["Experience"] = Number(input.experience) || 0;
  featureMap["Salary"] = Number(input.salaryExpectation) || 0;
  featureMap["Projects"] = Number(input.projectsCount) || 0;
  featureMap["Skill_Count"] = skillCount;
  featureMap["Certification_Count"] = certCount;
  featureMap["Has_Certification"] = hasCert;

  rawMap["Experience"] = `${input.experience} yrs`;
  rawMap["Salary"] = `$${Number(input.salaryExpectation).toLocaleString()}`;
  rawMap["Projects"] = `${input.projectsCount}`;
  rawMap["Skill_Count"] = `${skillCount} skills`;
  rawMap["Certification_Count"] = `${certCount}`;
  rawMap["Has_Certification"] = hasCert ? "Yes" : "No";

  // One-hot encode Education
  const edu = (input.education || "").trim();
  for (const cat of MODEL.categorical_encodings.Education) {
    featureMap[`Education_${cat}`] = edu === cat ? 1 : 0;
    rawMap[`Education_${cat}`] = edu === cat ? cat : "-";
  }

  // One-hot encode Job Role
  const role = (input.jobRole || "").trim();
  for (const cat of MODEL.categorical_encodings["Job Role"]) {
    featureMap[`Role_${cat}`] = role === cat ? 1 : 0;
    rawMap[`Role_${cat}`] = role === cat ? cat : "-";
  }

  // One-hot encode Certifications (treat as the first cert or "None")
  const primaryCert = certs.length > 0 ? certs[0] : "None";
  for (const cat of MODEL.categorical_encodings.Certifications) {
    featureMap[`Cert_${cat}`] = primaryCert === cat ? 1 : 0;
    rawMap[`Cert_${cat}`] = primaryCert === cat ? cat : "-";
  }

  // Build the feature vector in MODEL.feature_names order
  const features = MODEL.feature_names.map((name) => featureMap[name] ?? 0);

  // Apply scaler to numeric features
  for (let i = 0; i < MODEL.scaler.numeric_indices.length; i++) {
    const idx = MODEL.scaler.numeric_indices[i];
    const mean = MODEL.scaler.mean[i];
    const scale = MODEL.scaler.scale[i] || 1;
    features[idx] = (features[idx] - mean) / scale;
  }

  return { features, featureMap, rawMap };
}

// ---------------------------------------------------------------------
// Tree traversal - single tree prediction.
// ---------------------------------------------------------------------
function predictTree(tree: TreeNode, features: number[]): number[] {
  let node = tree;
  // Iterative traversal (avoid stack overflow on deep trees)
  const stack: TreeNode[] = [node];
  while (stack.length > 0) {
    node = stack.pop()!;
    if (node.leaf) {
      return node.value ?? [0.5, 0.5];
    }
    if (node.feature === undefined || node.threshold === undefined) {
      return [0.5, 0.5];
    }
    const val = features[node.feature];
    if (val <= node.threshold) {
      if (node.left) stack.push(node.left);
      else return [0.5, 0.5];
    } else {
      if (node.right) stack.push(node.right);
      else return [0.5, 0.5];
    }
  }
  return [0.5, 0.5];
}

// ---------------------------------------------------------------------
// Random Forest prediction - average over all trees.
// ---------------------------------------------------------------------
function predictForest(features: number[]): { pReject: number; pHire: number; treeVotes: number[] } {
  const MODEL = getModel();
  let sumReject = 0;
  let sumHire = 0;
  const treeVotes: number[] = [];
  for (const tree of MODEL.trees) {
    const probs = predictTree(tree, features);
    sumReject += probs[0];
    sumHire += probs[1];
    treeVotes.push(probs[1]); // P(Hire) for this tree
  }
  const n = MODEL.trees.length || 1;
  return { pReject: sumReject / n, pHire: sumHire / n, treeVotes };
}

// ---------------------------------------------------------------------
// Per-feature contribution explanation.
//
// We use a permutation-style approach: for each feature, we compute the
// change in predicted P(Hire) when that feature is set to its "neutral"
// baseline (mean for numeric, 0 for one-hot). A positive delta means the
// feature is pushing the prediction towards "Hire", negative towards "Reject".
// ---------------------------------------------------------------------
function computeExplanations(
  features: number[],
  featureMap: Record<string, number>,
  rawMap: Record<string, number | string>
): FeatureContribution[] {
  const MODEL = getModel();
  const FEATURE_IMPORTANCE = getFeatureImportanceData();
  const baselineProbability = predictForest(features).pHire;
  const contributions: FeatureContribution[] = [];

  // Use Gini importance (from training) to weight the magnitude
  const giniMap: Record<string, number> = {};
  for (const item of FEATURE_IMPORTANCE.gini_importance) {
    giniMap[item.feature] = item.importance;
  }

  for (let i = 0; i < MODEL.feature_names.length; i++) {
    const fname = MODEL.feature_names[i];
    const original = features[i];
    // Baseline: 0 for scaled numeric (which is the mean), 0 for one-hot
    const baselineValue = 0;
    const perturbed = features.slice();
    perturbed[i] = baselineValue;
    const perturbedProbability = predictForest(perturbed).pHire;
    // Contribution = current - baseline (positive means feature raises P(Hire))
    const contribution = baselineProbability - perturbedProbability;

    // Determine direction and strength
    let direction: "positive" | "negative" | "neutral" = "neutral";
    if (contribution > 0.01) direction = "positive";
    else if (contribution < -0.01) direction = "negative";

    // Strength based on absolute contribution relative to gini importance
    const gini = giniMap[fname] ?? 0;
    const magnitude = Math.abs(contribution) * (0.5 + gini * 5);
    let strength: "strong" | "moderate" | "low" = "low";
    if (magnitude > 0.1) strength = "strong";
    else if (magnitude > 0.04) strength = "moderate";

    // Skip features that have no contribution (clean up the UI)
    if (Math.abs(contribution) < 0.001 && gini < 0.01) continue;

    contributions.push({
      feature: humanizeFeatureName(fname),
      rawValue: original,
      contribution,
      direction,
      strength,
      displayValue: String(rawMap[fname] ?? original.toFixed(3)),
    });
  }

  // Sort by absolute contribution descending
  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  // Return top 10
  return contributions.slice(0, 10);
}

function humanizeFeatureName(name: string): string {
  if (name.startsWith("Education_")) return `Education: ${name.slice(10)}`;
  if (name.startsWith("Role_")) return `Job Role: ${name.slice(5)}`;
  if (name.startsWith("Cert_")) return `Certification: ${name.slice(5)}`;
  switch (name) {
    case "Experience": return "Experience";
    case "Salary": return "Salary Expectation";
    case "Projects": return "Projects Count";
    case "Skill_Count": return "Number of Skills";
    case "Certification_Count": return "Number of Certifications";
    case "Has_Certification": return "Has Certification";
    default: return name;
  }
}

// ---------------------------------------------------------------------
// Confidence calculation.
//
// Methodology: confidence is based on the margin between hire and reject
// probability, calibrated against the model's empirical accuracy on the
// test set. We do NOT claim that raw model probability is equivalent to
// calibrated confidence.
// ---------------------------------------------------------------------
function calculateConfidence(pHire: number): { label: "High" | "Medium" | "Low"; score: number } {
  const METRICS = getMetrics();
  const margin = Math.abs(pHire - 0.5) * 2; // 0..1
  // Scale by model test accuracy (0.965)
  const modelAccuracy = METRICS.all_models[METRICS.production_model]?.accuracy ?? 0.9;
  const score = Math.min(1, margin * modelAccuracy);
  let label: "High" | "Medium" | "Low" = "Low";
  if (score > 0.7) label = "High";
  else if (score > 0.4) label = "Medium";
  return { label, score };
}

// ---------------------------------------------------------------------
// Main prediction entry point.
// ---------------------------------------------------------------------
export function predict(input: CandidateInput): PredictionResult {
  const METADATA = getMetadata();
  const { features, featureMap, rawMap } = engineerFeatures(input);
  const { pHire, pReject } = predictForest(features);

  const prediction: "Hired" | "Rejected" = pHire >= 0.5 ? "Hired" : "Rejected";
  const { label, score } = calculateConfidence(pHire);
  const explanations = computeExplanations(features, featureMap, rawMap);

  return {
    prediction,
    hireProbability: pHire,
    rejectProbability: pReject,
    confidence: label,
    confidenceScore: score,
    modelName: METADATA.model_name,
    modelVersion: METADATA.model_version,
    explanations,
    featureVector: featureMap,
    warning:
      "This prediction is an AI-generated statistical estimate and should not be used as the sole basis for an employment decision.",
  };
}

// ---------------------------------------------------------------------
// Model metadata accessors (for the Model Performance page).
// ---------------------------------------------------------------------
export function getModelMetrics() {
  return getMetrics();
}

export function getModelMetadata() {
  return getMetadata();
}

export function getFeatureImportance() {
  return getFeatureImportanceData();
}

export function getEDA() {
  return getEDAData();
}

export function getModelArtifactSummary() {
  const MODEL = getModel();
  return {
    model_type: MODEL.model_type,
    n_estimators: MODEL.n_estimators,
    feature_count: MODEL.feature_names.length,
    feature_names: MODEL.feature_names,
    class_labels: MODEL.class_labels,
  };
}
