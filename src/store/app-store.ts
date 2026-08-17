/**
 * Global app state - auth, current view, navigation, theme.
 * Since the app exposes only the `/` route, we manage "pages" via view state.
 */
import { create } from "zustand";
import type { User, ViewName, PredictionResult, Candidate } from "@/types";
import { authApi } from "@/services/api";

interface AppState {
  // Auth
  user: User | null;
  authLoading: boolean;
  authInitialized: boolean;

  // Navigation
  view: ViewName;
  selectedCandidateId: string | null;
  selectedPredictionId: string | null;
  lastPrediction: PredictionResult | null;
  compareCandidateIds: string[];

  // Sidebar (mobile)
  sidebarOpen: boolean;

  // Actions
  initializeAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;

  navigate: (view: ViewName, opts?: { candidateId?: string; predictionId?: string }) => void;
  setLastPrediction: (p: PredictionResult | null) => void;
  toggleCompareCandidate: (id: string) => void;
  clearCompare: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  authLoading: false,
  authInitialized: false,

  view: "login",
  selectedCandidateId: null,
  selectedPredictionId: null,
  lastPrediction: null,
  compareCandidateIds: [],

  sidebarOpen: false,

  initializeAuth: async () => {
    if (get().authInitialized) return;
    set({ authLoading: true });
    try {
      const { user } = await authApi.me();
      set({ user, view: user ? "dashboard" : "login", authLoading: false, authInitialized: true });
    } catch {
      set({ user: null, view: "login", authLoading: false, authInitialized: true });
    }
  },

  login: async (email, password) => {
    set({ authLoading: true });
    try {
      const { user } = await authApi.login({ email, password });
      set({ user, view: "dashboard", authLoading: false, authInitialized: true });
    } catch (e) {
      set({ authLoading: false });
      throw e;
    }
  },

  register: async (name, email, password) => {
    set({ authLoading: true });
    try {
      const { user } = await authApi.register({ name, email, password });
      set({ user, view: "dashboard", authLoading: false, authInitialized: true });
    } catch (e) {
      set({ authLoading: false });
      throw e;
    }
  },

  logout: async () => {
    try { await authApi.logout(); } catch {}
    set({ user: null, view: "login", selectedCandidateId: null, selectedPredictionId: null, lastPrediction: null, sidebarOpen: false });
  },

  setUser: (user) => set({ user }),

  navigate: (view, opts) => {
    set({
      view,
      ...(opts?.candidateId !== undefined ? { selectedCandidateId: opts.candidateId } : {}),
      ...(opts?.predictionId !== undefined ? { selectedPredictionId: opts.predictionId } : {}),
      sidebarOpen: false,
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  },

  setLastPrediction: (p) => set({ lastPrediction: p }),

  toggleCompareCandidate: (id) => {
    const ids = get().compareCandidateIds;
    if (ids.includes(id)) {
      set({ compareCandidateIds: ids.filter((x) => x !== id) });
    } else if (ids.length < 5) {
      set({ compareCandidateIds: [...ids, id] });
    }
  },

  clearCompare: () => set({ compareCandidateIds: [] }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
