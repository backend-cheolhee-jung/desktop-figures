import { create } from "zustand";

export type Page = "setup" | "main" | "settings";

interface AppState {
  currentPage: Page;
  isAlwaysOnTop: boolean;
  setPage: (page: Page) => void;
  setAlwaysOnTop: (value: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: "main",
  isAlwaysOnTop: false,
  setPage: (page) => set({ currentPage: page }),
  setAlwaysOnTop: (value) => set({ isAlwaysOnTop: value }),
}));
