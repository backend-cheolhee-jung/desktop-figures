import { invoke } from "@tauri-apps/api/core";

const API_KEY = import.meta.env.VITE_MESHY_API_KEY as string;

export interface MeshyResult {
  status: "pending" | "succeeded" | "failed";
  glbUrl?: string;
}

export interface RigResult {
  status: "pending" | "succeeded" | "failed";
  riggedGlbUrl?: string;
  walkingGlbUrl?: string;
}

export async function createTextModel(prompt: string): Promise<string> {
  const fullPrompt = `${prompt}, super cute chibi 3D character, full body, chubby proportions, big expressive eyes, soft pastel and vibrant color palette, rich colorful textures, high contrast colors, adorable and charming design, smooth clay-like surface`;
  return invoke<string>("meshy_create_text_model", { apiKey: API_KEY, prompt: fullPrompt });
}

export async function pollTextModel(taskId: string): Promise<MeshyResult> {
  return invoke<MeshyResult>("meshy_poll_text_model", { apiKey: API_KEY, taskId });
}

export async function createRefine(previewTaskId: string): Promise<string> {
  return invoke<string>("meshy_create_refine", { apiKey: API_KEY, previewTaskId });
}

export async function createRig(modelGlbUrl: string): Promise<string> {
  return invoke<string>("meshy_create_rig", { apiKey: API_KEY, modelGlbUrl });
}

export async function pollRig(rigTaskId: string): Promise<RigResult> {
  return invoke<RigResult>("meshy_poll_rig", { apiKey: API_KEY, rigTaskId });
}

export async function createAnimation(rigTaskId: string, actionId: number): Promise<string> {
  return invoke<string>("meshy_create_animation", { apiKey: API_KEY, rigTaskId, actionId });
}

export async function pollAnimation(animTaskId: string): Promise<MeshyResult> {
  return invoke<MeshyResult>("meshy_poll_animation", { apiKey: API_KEY, animTaskId });
}

export const ANIMATION_PRESETS = [
  { id: "coding",     label: "업무중",     actionId: 32  },
  { id: "walking",    label: "걷기",       actionId: 30  },
  { id: "running",    label: "달리기",     actionId: 14  },
  { id: "dancing",    label: "춤추기",     actionId: 22  },
  { id: "waving",     label: "손흔들기",   actionId: 28  },
  { id: "eating",     label: "식사/음료",  actionId: 343 },
  { id: "talking",    label: "대화/발표",  actionId: 308 },
  { id: "workout",    label: "운동/헬스",  actionId: 319 },
  { id: "stretching", label: "스트레칭",   actionId: 31  },
  { id: "cheering",   label: "박수/응원",  actionId: 298 },
  { id: "thinking",   label: "생각중",     actionId: 36  },
] as const;

export type AnimationPresetId = typeof ANIMATION_PRESETS[number]["id"];
