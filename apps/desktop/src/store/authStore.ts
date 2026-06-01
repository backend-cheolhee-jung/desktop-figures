import { create } from "zustand";
import type { Me } from "@/lib/authApi";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  me: Me | null;
  setSession: (accessToken: string, refreshToken: string, me: Me) => void;
  clear: () => void;
  isApproved: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  me: null,
  setSession: (accessToken, refreshToken, me) => set({ accessToken, refreshToken, me }),
  clear: () => set({ accessToken: null, refreshToken: null, me: null }),
  isApproved: () => get().me?.status === "APPROVED" && get().accessToken !== null,
}));
