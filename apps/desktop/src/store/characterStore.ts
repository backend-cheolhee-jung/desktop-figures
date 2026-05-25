import { create } from "zustand";

export interface Character {
  id: string;
  name: string;
  baseImagePath: string;
  sleepImagePath: string;
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
