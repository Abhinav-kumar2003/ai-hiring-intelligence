/**
 * Centralized API client. All fetch calls go through here.
 * Handles auth, JSON parsing, and error normalization.
 */
import type {
  User, Candidate, PredictionResult, PredictionWithExplanations,
  DashboardStats, AnalyticsData, ModelMetrics, FeatureImportance, ModelInfo,
  ParsedResume, Notification,
} from "@/types";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include",
  });
  let body: any;
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) {
    throw new ApiError(body?.error || `Request failed (${res.status})`, res.status, body?.details);
  }
  return body as T;
}

const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: data === undefined ? undefined : JSON.stringify(data) }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data === undefined ? undefined : JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<{ user: User }>("/api/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post<{ user: User }>("/api/auth/login", data),
  logout: () => api.post<{ success: boolean }>("/api/auth/logout"),
  me: () => api.get<{ user: User }>("/api/auth/me"),
};

// ---------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------
export interface CandidateListParams {
  search?: string;
  prediction?: string;
  jobRole?: string;
  experience?: string;
  probability?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export const candidateApi = {
  list: (params: CandidateListParams = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") q.set(k, String(v));
    });
    return api.get<{ candidates: Candidate[]; total: number; page: number; pageSize: number; totalPages: number }>(
      `/api/candidates?${q.toString()}`
    );
  },
  get: (id: string) =>
    api.get<{ candidate: Candidate & { predictions: PredictionWithExplanations[]; resumeFile?: any } }>(`/api/candidates/${id}`),
  create: (data: Partial<Candidate>) =>
    api.post<{ candidate: Candidate }>("/api/candidates", data),
  update: (id: string, data: Partial<Candidate>) =>
    api.put<{ candidate: Candidate }>(`/api/candidates/${id}`, data),
  delete: (id: string) =>
    api.delete<{ success: boolean }>(`/api/candidates/${id}`),
};

// ---------------------------------------------------------------------
// Predictions
// ---------------------------------------------------------------------
export interface PredictInput {
  name?: string;
  email?: string;
  phone?: string;
  skills: string;
  experience: number;
  education: string;
  certifications: string;
  jobRole: string;
  salaryExpectation: number;
  projectsCount: number;
}

export const predictionApi = {
  predict: (input: PredictInput, candidateId?: string, save = true) =>
    api.post<PredictionResult>("/api/predict", { input, candidateId, save }),
  list: (params: { prediction?: string; model?: string; page?: number; pageSize?: number; sortBy?: string; sortDir?: "asc" | "desc" } = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") q.set(k, String(v));
    });
    return api.get<{ predictions: PredictionWithExplanations[]; total: number; page: number; pageSize: number; totalPages: number }>(
      `/api/predictions?${q.toString()}`
    );
  },
  get: (id: string) =>
    api.get<{ prediction: PredictionWithExplanations }>(`/api/predictions/${id}`),
};

// ---------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------
export const dashboardApi = {
  stats: () => api.get<DashboardStats>("/api/dashboard/stats"),
};

// ---------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------
export interface AnalyticsParams {
  jobRole?: string;
  education?: string;
  experience?: string;
  prediction?: string;
  days?: number;
}

export const analyticsApi = {
  get: (params: AnalyticsParams = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") q.set(k, String(v));
    });
    return api.get<AnalyticsData>(`/api/analytics?${q.toString()}`);
  },
};

// ---------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------
export const modelApi = {
  metrics: () => api.get<ModelMetrics>("/api/model/metrics"),
  features: () => api.get<FeatureImportance>("/api/model/features"),
  info: () => api.get<ModelInfo>("/api/model/info"),
};

// ---------------------------------------------------------------------
// Resumes
// ---------------------------------------------------------------------
export const resumeApi = {
  upload: (data: { mode?: "text" | "sample"; text?: string; sampleType?: "strong" | "weak"; fileName?: string; fileSize?: number; mimeType?: string }) =>
    api.post<{ resumeId: string; parsed: ParsedResume }>("/api/resumes/upload", data),
};

// ---------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------
export const notificationApi = {
  list: () => api.get<{ notifications: Notification[]; unreadCount: number }>("/api/notifications"),
  markRead: (ids?: string[], all = false) =>
    api.post<{ success: boolean }>("/api/notifications", { ids, all }),
};

// ---------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------
export const profileApi = {
  update: (data: { name?: string; avatarUrl?: string }) =>
    api.put<{ user: User }>("/api/profile", data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch<{ success: boolean }>("/api/profile", { currentPassword, newPassword }),
};

export { api };
