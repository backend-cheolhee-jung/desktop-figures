import { BaseDirectory, mkdir, readFile, writeFile } from "@tauri-apps/plugin-fs";

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

// 로컬 상대경로 → Blob URL (asset protocol 권한 없이도 동작)
export async function toGlbUrl(relativePath: string): Promise<string> {
  const bytes = await readFile(relativePath, { baseDir: BaseDirectory.AppData });
  const blob = new Blob([bytes], { type: "model/gltf-binary" });
  return URL.createObjectURL(blob);
}
