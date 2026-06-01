// Meshy.ai 3D 생성 API 래퍼
// 실제 API 플로우: text-to-3d → /v1/rigging → /v1/animations (rig_task_id + action_id)

const BASE = "https://api.meshy.ai/openapi";

export interface MeshyResult {
  status: "pending" | "succeeded" | "failed";
  glbUrl?: string;
}

export interface RigResult {
  status: "pending" | "succeeded" | "failed";
  riggedGlbUrl?: string;
  walkingGlbUrl?: string;
  runningGlbUrl?: string;
}

function authHeaders(): Record<string, string> {
  const key = import.meta.env.VITE_MESHY_API_KEY;
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

// Step 1: 텍스트로 캐릭터 모델 생성
export async function createTextModel(prompt: string): Promise<string> {
  const res = await fetch(`${BASE}/v2/text-to-3d`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      mode: "preview",
      prompt: `${prompt}, super cute chibi 3D character, full body, chubby proportions, big expressive eyes, soft pastel and vibrant color palette, rich colorful textures, high contrast colors, adorable and charming design, smooth clay-like surface`,
      art_style: "realistic",
      should_remesh: true,
    }),
  });
  if (!res.ok) throw new Error(`Meshy text-to-3d ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.result as string;
}

// Step 1 폴링: text-to-3d 완료 확인
export async function pollTextModel(taskId: string): Promise<MeshyResult> {
  const res = await fetch(`${BASE}/v2/text-to-3d/${taskId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Meshy poll text-to-3d ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw = String(data.status).toUpperCase();
  if (raw === "SUCCEEDED") return { status: "succeeded", glbUrl: data.model_urls?.glb };
  if (raw === "FAILED") return { status: "failed" };
  return { status: "pending" };
}

// Step 2: 모델 GLB URL로 리깅 task 생성 (walking/running 기본 포함)
export async function createRig(modelGlbUrl: string): Promise<string> {
  const res = await fetch(`${BASE}/v1/rigging`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ model_url: modelGlbUrl }),
  });
  if (!res.ok) throw new Error(`Meshy rigging ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.result as string;
}

// Step 2 폴링: rig 완료 확인 + 기본 애니메이션 URL 반환
export async function pollRig(rigTaskId: string): Promise<RigResult> {
  const res = await fetch(`${BASE}/v1/rigging/${rigTaskId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Meshy poll rig ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw = String(data.status).toUpperCase();
  if (raw === "SUCCEEDED") {
    return {
      status: "succeeded",
      riggedGlbUrl: data.result?.rigged_character_glb_url,
      walkingGlbUrl: data.result?.basic_animations?.walking_glb_url,
      runningGlbUrl: data.result?.basic_animations?.running_glb_url,
    };
  }
  if (raw === "FAILED") return { status: "failed" };
  return { status: "pending" };
}

// Step 3: rig task ID + action_id로 커스텀 애니메이션 생성
// action_id: 1=Walking_Woman, 그 외 번호는 추후 매핑 예정
export async function createAnimation(rigTaskId: string, actionId: number): Promise<string> {
  const res = await fetch(`${BASE}/v1/animations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ rig_task_id: rigTaskId, action_id: actionId }),
  });
  if (!res.ok) throw new Error(`Meshy animation ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.result as string;
}

// Step 3 폴링: animation 완료 확인
export async function pollAnimation(animTaskId: string): Promise<MeshyResult> {
  const res = await fetch(`${BASE}/v1/animations/${animTaskId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Meshy poll animation ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw = String(data.status).toUpperCase();
  if (raw === "SUCCEEDED") return { status: "succeeded", glbUrl: data.result?.animation_glb_url };
  if (raw === "FAILED") return { status: "failed" };
  return { status: "pending" };
}

export const ANIMATION_PRESETS = [
  { id: "coding",     label: "코딩/공부",  actionId: 32  },
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
