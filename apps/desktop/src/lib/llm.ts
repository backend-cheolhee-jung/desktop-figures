import { invoke } from "@tauri-apps/api/core";

export interface CharacterImages {
  baseImage: string;
  sleepImage: string;
}

function getConfig() {
  return {
    token: import.meta.env.VITE_VERTEX_AI_TOKEN as string,
    projectId: import.meta.env.VITE_VERTEX_PROJECT_ID as string,
    location: (import.meta.env.VITE_VERTEX_LOCATION ?? "us-central1") as string,
  };
}

async function callImagen(prompt: string): Promise<string> {
  const { token, projectId, location } = getConfig();
  return invoke<string>("generate_image", { token, projectId, location, prompt });
}

// 캐릭터 이미지용 스타일 — 배경을 완전히 배제하고 캐릭터에만 집중
const CHAR_STYLE_SUFFIX = [
  "3D rendered character",
  "chubby adorable Pixar-style figurine",
  "smooth clay-like surface with subsurface scattering",
  "big round eyes, expressive face",
  "soft warm studio lighting, three-point light setup",
  "completely isolated on pure white background",
  "no ground shadow, no floor, no environment, no props, no scene elements",
  "full body shot, centered in frame",
  "front-facing camera, slightly low angle",
  "high resolution, ultra detailed, sharp edges",
  "product photography style render",
  "white seamless studio backdrop",
].join(", ");

// 행동 이미지용 스타일
const ACTION_STYLE_SUFFIX = [
  "3D rendered character",
  "chubby adorable Pixar-style figurine",
  "smooth clay-like surface",
  "big expressive eyes",
  "soft studio lighting",
  "pure white background, no environment, no scene, no props",
  "full body, centered, front-facing",
  "high quality 3D render",
  "product shot style",
].join(", ");

export async function generateCharacterImages(description: string): Promise<CharacterImages> {
  const basePrompt = `${description}. ${CHAR_STYLE_SUFFIX}. Standing upright, arms relaxed at sides, neutral pose, facing camera directly.`;
  const sleepPrompt = `${description}. ${CHAR_STYLE_SUFFIX}. Eyes closed, sleeping peacefully, lying on side in a cozy curled-up pose, tiny smile.`;

  const baseImage = await callImagen(basePrompt);
  const sleepImage = await callImagen(sleepPrompt);

  return { baseImage, sleepImage };
}

export async function generateActionImage(characterDescription: string, actionName: string): Promise<string> {
  const prompt = `${characterDescription}. ${ACTION_STYLE_SUFFIX}. The character is actively doing "${actionName}", dynamic expressive pose, full body visible.`;
  return callImagen(prompt);
}
