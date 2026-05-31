// Meshy.ai 3D 생성 API 래퍼
// 호출 케이스: 캐릭터 모델 생성, 애니메이션(idle/sleep/행동) 생성

const BASE = "https://api.meshy.ai/openapi";

export type MeshyTaskType = "text" | "image" | "animation";

export interface MeshyResult {
  status: "pending" | "succeeded" | "failed";
  glbUrl?: string;
}

function authHeaders(): Record<string, string> {
  const key = import.meta.env.VITE_MESHY_API_KEY;
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

// 케이스 1: 텍스트로 캐릭터 모델 생성
export async function createTextModel(prompt: string): Promise<string> {
  const res = await fetch(`${BASE}/v2/text-to-3d`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      mode: "preview",
      prompt: `${prompt}, cute chubby 3D clay style character, full body`,
      art_style: "realistic",
      should_remesh: true,
    }),
  });
  if (!res.ok) throw new Error(`Meshy text-to-3d ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.result as string;
}

// 케이스 2: 이미지로 캐릭터 모델 생성
// imageDataUrl: "data:image/png;base64,..." 형식
export async function createImageModel(imageDataUrl: string): Promise<string> {
  const res = await fetch(`${BASE}/v1/image-to-3d`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      image_url: imageDataUrl,
      should_remesh: true,
    }),
  });
  if (!res.ok) throw new Error(`Meshy image-to-3d ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.result as string;
}

// 케이스 3: 애니메이션 생성 (모델 URL + 동작 설명)
export async function createAnimation(
  modelUrl: string,
  actionPrompt: string
): Promise<string> {
  const res = await fetch(`${BASE}/v1/animations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model_url: modelUrl,
      prompt: actionPrompt,
    }),
  });
  if (!res.ok) throw new Error(`Meshy animations ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.result as string;
}

// 폴링: taskType에 따라 엔드포인트 분기
export async function pollTask(
  taskId: string,
  taskType: MeshyTaskType
): Promise<MeshyResult> {
  const endpoint =
    taskType === "text"
      ? `v2/text-to-3d/${taskId}`
      : taskType === "image"
      ? `v1/image-to-3d/${taskId}`
      : `v1/animations/${taskId}`;

  const res = await fetch(`${BASE}/${endpoint}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Meshy poll ${res.status}: ${await res.text()}`);
  const data = await res.json();

  const raw = String(data.status).toUpperCase();
  if (raw === "SUCCEEDED") {
    return { status: "succeeded", glbUrl: data.model_urls?.glb };
  }
  if (raw === "FAILED") {
    return { status: "failed" };
  }
  return { status: "pending" };
}

// idle/sleep 표준 애니메이션 프롬프트
export const IDLE_PROMPT = "gentle idle breathing, standing still";
export const SLEEP_PROMPT = "sleeping, lying down, eyes closed, calm breathing";

export function actionPromptFor(actionName: string): string {
  return `character ${actionName}, looping motion`;
}
