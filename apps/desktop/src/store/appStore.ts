import { create } from "zustand";

export type Page = "setup" | "main" | "settings" | "action-panel" | "action-form";

interface AppState {
  currentPage: Page;
  editingActionId: string | null; // action-form에서 수정 시 사용
  isAlwaysOnTop: boolean;
  setPage: (page: Page) => void;
  openActionForm: (actionId?: string) => void;
  setAlwaysOnTop: (value: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: "main",
  editingActionId: null,
  isAlwaysOnTop: false,
  setPage: (page) => set({ currentPage: page }),
  openActionForm: (actionId) =>
    set({ currentPage: "action-form", editingActionId: actionId ?? null }),
  setAlwaysOnTop: (value) => set({ isAlwaysOnTop: value }),
}));
