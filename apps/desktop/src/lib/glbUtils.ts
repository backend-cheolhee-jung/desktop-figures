import { BaseDirectory, mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";

// 원격 GLB URL → AppData에 다운로드 후 로컬 상대경로 반환
export async function downloadGlb(
  url: string,
  subDir: string,
  filename: string
): Promise<string> {
  await mkdir(subDir, { baseDir: BaseDirectory.AppData, recursive: true });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`GLB download failed ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());

  const relativePath = `${subDir}/${filename}`;
  await writeFile(relativePath, bytes, { baseDir: BaseDirectory.AppData });
  return relativePath;
}

// 로컬 상대경로 → webview에서 로드 가능한 절대 URL
export function toGlbUrl(relativePath: string): string {
  return convertFileSrc(relativePath);
}
