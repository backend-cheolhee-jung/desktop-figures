import { BaseDirectory, mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";

// File → base64 (data URL prefix 제거)
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// base64 PNG → AppData 디렉토리에 저장 후 로컬 경로 반환
export async function saveBase64Image(
  base64: string,
  subDir: string,
  filename: string
): Promise<string> {
  await mkdir(subDir, { baseDir: BaseDirectory.AppData, recursive: true });

  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const relativePath = `${subDir}/${filename}`;

  await writeFile(relativePath, bytes, { baseDir: BaseDirectory.AppData });

  return relativePath;
}

// 로컬 파일 경로 → webview에서 표시 가능한 URL
export function toDisplayUrl(relativePath: string): string {
  return convertFileSrc(relativePath);
}
