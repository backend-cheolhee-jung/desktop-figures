import { BaseDirectory, mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";

// base64 PNG → AppData에 저장, 절대 경로 반환
export async function saveBase64Image(
  base64: string,
  subDir: string,
  filename: string
): Promise<string> {
  await mkdir(subDir, { baseDir: BaseDirectory.AppData, recursive: true });

  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const relativePath = `${subDir}/${filename}`;

  await writeFile(relativePath, bytes, { baseDir: BaseDirectory.AppData });

  const dataDir = await appDataDir();
  return join(dataDir, relativePath);
}

// 절대 경로 → data URL (Rust에서 파일 읽기, convertFileSrc 미사용)
export async function toDisplayUrl(absolutePath: string): Promise<string> {
  return invoke<string>("read_image_as_data_url", { path: absolutePath });
}
