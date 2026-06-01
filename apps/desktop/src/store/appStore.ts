import { create } from "zustand";

export type Page = "loading" | "setup" | "main" | "settings" | "action-panel" | "action-form";

interface AppState {
  currentPage: Page;
  editingActionId: string | null;
  isAlwaysOnTop: boolean;
  setPage: (page: Page) => void;
  openActionForm: (actionId?: string) => void;
  setAlwaysOnTop: (value: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: "loading",
  editingActionId: null,
  isAlwaysOnTop: false,
  setPage: (page) => set({ currentPage: page }),
  openActionForm: (actionId) =>
    set({ currentPage: "action-form", editingActionId: actionId ?? null }),
  setAlwaysOnTop: (value) => set({ isAlwaysOnTop: value }),
}));
