import { create } from "zustand";
import type { GenerationStatus } from "@/store/characterStore";

export type WidgetStatus = "idle" | "active";

export interface Action {
  id: string;
  characterId: string;
  name: string;
  animationPath?: string;
  generationStatus: GenerationStatus;
  meshyTaskId?: string;
  speechBubble?: string;
  voiceFilePath?: string;
  voiceLoopStart?: number;
  voiceLoopEnd?: number;
  scheduledAt?: number;
  durationMinutes?: number;
  createdAt: number;
  updatedAt: number;
  syncedAt?: number;
}

interface ActionState {
  actions: Action[];
  currentAction: Action | null;
  status: WidgetStatus;
  actionEndTime: number | null;
  setActions: (actions: Action[]) => void;
  addAction: (action: Action) => void;
  startAction: (action: Action, endTime: number) => void;
  stopAction: () => void;
  updateSpeechBubble: (text: string) => void;
}

export const useActionStore = create<ActionState>((set) => ({
  actions: [],
  currentAction: null,
  status: "idle",
  actionEndTime: null,

  setActions: (actions) => set({ actions }),

  addAction: (action) =>
    set((state) => ({ actions: [...state.actions, action] })),

  startAction: (action, endTime) =>
    set({ currentAction: action, status: "active", actionEndTime: endTime }),

  stopAction: () =>
    set({ currentAction: null, status: "idle", actionEndTime: null }),

  updateSpeechBubble: (text) =>
    set((state) =>
      state.currentAction
        ? { currentAction: { ...state.currentAction, speechBubble: text } }
        : {}
    ),
}));
