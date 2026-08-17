/**
 * TypeScript types for the AI Hiring Prediction System.
 */

export type UserRole = "recruiter" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
  createdAt?: string;
}

export interface LatestPrediction {
  id: string;
  prediction: "Hired" | "Rejected";
  hireProbability: number;
  rejectProbability: number;
  confidence: string;
  modelName: string;
  modelVersion: string;
  createdAt: string;
}

export interface Candidate {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  skills: string;
  experience: number;
  education: string;
  certifications: string;
  jobRole: string;
  salaryExpectation: number;
  projectsCount: number;
  source: string;
  createdAt: string;
  updatedAt: string;
  latestPrediction?: LatestPrediction | null;
}

export interface FeatureExplanation {
  feature: string;
  value: number;
  contribution: number;
  direction: "positive" | "negative" | "neutral";
  strength: "strong" | "moderate" | "low";
}

export interface FeatureContribution {
  feature: string;
  rawValue: number | string;
  contribution: number;
  direction: "positive" | "negative" | "neutral";
  strength: "strong" | "moderate" | "low";
  displayValue: string;
}

export interface PredictionResult {
  predictionId?: string;
  prediction: "Hired" | "Rejected";
  hireProbability: number;
  rejectProbability: number;
  confidence: "High" | "Medium" | "Low";
  confidenceScore: number;
  modelName: string;
  modelVersion: string;
  explanations: FeatureContribution[];
  warning: string;
  metadata: {
    modelType: string;
    trainingDate: string;
    trainingSamples: number;
    features: number;
  };
}

export interface PredictionWithExplanations {
  id: string;
  candidateId: string | null;
  modelName: string;
  modelVersion: string;
  prediction: "Hired" | "Rejected";
  hireProbability: number;
  rejectProbability: number;
  confidence: string;
  inputData: string;
  createdAt: string;
  explanations: FeatureExplanation[];
  candidate?: {
    id: string;
    name: string;
    jobRole: string;
    email?: string | null;
    experience?: number;
    education?: string;
    skills?: string;
    certifications?: string;
    salaryExpectation?: number;
    projectsCount?: number;
  } | null;
}

export interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  skills: string[];
  certifications: string[];
  education: string;
  experienceYears: number;
  jobRole: string;
  projectsCount: number;
  salaryExpectation: number;
  rawText: string;
}

export interface DashboardStats {
  stats: {
    totalCandidates: number;
    totalPredictions: number;
    hired: number;
    rejected: number;
    pending: number;
    avgHireProbability: number;
    hireRate: number;
  };
  trend: { date: string; total: number; hired: number; rejected: number }[];
  hiringByRole: { role: string; total: number; hired: number; rejected: number }[];
  experienceDistribution: { range: string; count: number }[];
  recentCandidates: {
    id: string;
    name: string;
    jobRole: string;
    experience: number;
    education: string;
    skills: string;
    prediction: string | null;
    hireProbability: number | null;
    createdAt: string;
  }[];
}

export interface AnalyticsData {
  cards: {
    totalCandidates: number;
    hiringRate: number;
    averageExperience: number;
    averageProjects: number;
    averageSalary: number;
    averageHireProbability: number;
  };
  hiringDistribution: { name: string; value: number; color: string }[];
  hiringByRole: { role: string; total: number; hired: number; rejected: number }[];
  hiringByEducation: { education: string; total: number; hired: number; rejected: number }[];
  experienceVsHiring: { range: string; total: number; hired: number; rejected: number; hireRate: number }[];
  certVsHiring: { name: string; total: number; hired: number }[];
  projectsVsHiring: { range: string; total: number; hired: number; rejected: number; hireRate: number }[];
  salaryVsHiring: { range: string; total: number; hired: number; rejected: number; hireRate: number }[];
  topSkills: { skill: string; count: number }[];
  eda: any;
  filters: { jobRole: string; education: string; experience: string; prediction: string; days: number };
}

export interface ModelMetrics {
  production_model: string;
  all_models: Record<string, {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    roc_auc: number;
  }>;
  confusion_matrix: {
    tn: number; fp: number; fn: number; tp: number;
    labels: string[]; matrix: number[][];
  };
  roc_curve: { fpr: number[]; tpr: number[]; thresholds: number[]; auc: number };
  best_params: Record<string, any>;
  cv_best_score: number;
  test_size: number;
  train_size: number;
}

export interface FeatureImportance {
  permutation_importance: { feature: string; importance_mean: number; importance_std: number }[];
  gini_importance: { feature: string; importance: number }[];
  feature_names: string[];
}

export interface ModelInfo {
  model_name: string;
  model_version: string;
  production_model: string;
  training_date: string;
  dataset_size: number;
  training_samples: number;
  test_samples: number;
  features_count: number;
  features: string[];
  target: string;
  training_methodology: string;
  cross_validation: string;
  best_params: Record<string, any>;
  scaler: string;
  categorical_encoding: string;
  performance: { accuracy: number; precision: number; recall: number; f1: number; roc_auc: number };
  responsible_ai_warning: string;
  excluded_features: string[];
  exclusion_reasons: Record<string, string>;
  ethical_notes: string[];
  model_type: string;
  n_estimators: number;
  class_labels: string[];
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export type ViewName =
  | "login"
  | "dashboard"
  | "candidates"
  | "candidate-details"
  | "screening"
  | "prediction-result"
  | "predictions"
  | "comparison"
  | "analytics"
  | "model-performance"
  | "settings"
  | "profile";
