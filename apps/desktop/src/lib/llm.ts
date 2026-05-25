// Vertex AI Imagen 요청 래퍼
// 호출 케이스: 캐릭터 등록, 행동 등록 2가지만 존재

export interface CharacterImages {
  baseImage: string;   // base64 PNG
  sleepImage: string;  // base64 PNG
}

function getConfig() {
  return {
    token: import.meta.env.VITE_VERTEX_AI_TOKEN,
    projectId: import.meta.env.VITE_VERTEX_PROJECT_ID,
    location: import.meta.env.VITE_VERTEX_LOCATION ?? "us-central1",
  };
}

async function callImagen(
  prompt: string,
  referenceImageBase64?: string
): Promise<string> {
  const { token, projectId, location } = getConfig();

  const url =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}` +
    `/locations/${location}/publishers/google/models/imagegeneration@006:predict`;

  const instance: Record<string, unknown> = { prompt };
  if (referenceImageBase64) {
    instance.image = { bytesBase64Encoded: referenceImageBase64 };
    instance.editMode = "edit";
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [instance],
      parameters: {
        sampleCount: 1,
        aspectRatio: "1:1",
        outputMimeType: "image/png",
        includeSafetyAttributes: false,
      },
    }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Vertex AI error ${res.status}: ${msg}`);
  }

  const data = await res.json();
  return data.predictions[0].bytesBase64Encoded as string;
}

// 케이스 1: 캐릭터 등록
// - sourceImageBase64: 선택값 (드래그 앤 드롭 시 전달)
// - description: 선택값 (텍스트 입력 시 전달). 둘 중 하나는 필수.
// 기본 포즈 + 수면 포즈 2장 동시 생성
export async function generateCharacterImages(
  sourceImageBase64?: string,
  description?: string
): Promise<CharacterImages> {
  if (!sourceImageBase64 && !description) {
    throw new Error("이미지 또는 텍스트 설명 중 하나는 필요합니다.");
  }

  const base =
    description
      ? `${description}, `
      : "";

  const styleNote =
    "귀엽고 통통한 3D 클레이 스타일 캐릭터. 배경 없음, 투명 배경, PNG.";

  const basePrompt = `${base}${styleNote} 정면에서 바라보는 포즈.`;
  const sleepPrompt = `${base}${styleNote} 눈을 감고 편안하게 자고 있는 포즈.`;

  const [baseImage, sleepImage] = await Promise.all([
    callImagen(basePrompt, sourceImageBase64),
    callImagen(sleepPrompt, sourceImageBase64),
  ]);

  return { baseImage, sleepImage };
}

// 케이스 2: 행동 등록
export async function generateActionImage(
  baseCharacterBase64: string,
  actionName: string
): Promise<string> {
  const prompt =
    `이 캐릭터가 ${actionName}을(를) 하고 있는 모습. ` +
    "배경 없음, 투명 배경, PNG. 귀엽고 통통한 3D 클레이 스타일 유지.";

  return callImagen(prompt, baseCharacterBase64);
}
