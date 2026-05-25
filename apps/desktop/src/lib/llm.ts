// Vertex AI Imagen 요청 래퍼
// LLM 호출은 캐릭터 등록, 행동 등록 2가지 케이스만 존재

export interface CharacterImages {
  baseImage: string;   // base64 PNG
  sleepImage: string;  // base64 PNG
}

export async function generateCharacterImages(
  _sourceImageBase64: string
): Promise<CharacterImages> {
  // TODO: feature/character-creation 에서 구현
  throw new Error("Not implemented");
}

export async function generateActionImage(
  _baseCharacterBase64: string,
  _actionName: string
): Promise<string> {
  // TODO: feature/action-management 에서 구현
  throw new Error("Not implemented");
}
