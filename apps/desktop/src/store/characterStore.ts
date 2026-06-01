import { create } from "zustand";

export type GenerationStatus = "pending" | "ready" | "failed";
export type ModelTaskType = "text" | "image";

export interface Character {
  id: string;
  name: string;
  modelPath?: string;
  modelRemoteUrl?: string;
  modelTaskType: ModelTaskType;
  idleAnimPath?: string;
  sleepAnimPath?: string;
  generationStatus: GenerationStatus;
  meshyTaskId?: string;
  rigTaskId?: string;
  idleMeshyTaskId?: string;
  sleepMeshyTaskId?: string;
  idleSpeechBubble?: string;
  serverId?: string;
  createdAt: number;
  updatedAt: number;
  syncedAt?: number;
}

interface CharacterState {
  character: Character | null;
  isLoading: boolean;
  setCharacter: (character: Character | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useCharacterStore = create<CharacterState>((set) => ({
  character: null,
  isLoading: false,
  setCharacter: (character) => set({ character }),
  setLoading: (isLoading) => set({ isLoading }),
}));
