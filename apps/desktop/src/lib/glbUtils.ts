import { invoke } from "@tauri-apps/api/core";
import { BaseDirectory, readFile } from "@tauri-apps/plugin-fs";

export async function downloadGlb(url: string, subDir: string, filename: string): Promise<string> {
  return invoke<string>("meshy_download_glb", { url, subDir, filename });
}

export async function toGlbUrl(relativePath: string): Promise<string> {
  const bytes = await readFile(relativePath, { baseDir: BaseDirectory.AppData });
  const blob = new Blob([bytes], { type: "model/gltf-binary" });
  return URL.createObjectURL(blob);
}
