import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/store/appStore";

export function useWindowControl() {
  const setAlwaysOnTop = useAppStore((s) => s.setAlwaysOnTop);

  async function enableAlwaysOnTop() {
    await invoke("set_always_on_top", { enabled: true });
    setAlwaysOnTop(true);
  }

  async function disableAlwaysOnTop() {
    await invoke("set_always_on_top", { enabled: false });
    setAlwaysOnTop(false);
  }

  async function savePosition(): Promise<[number, number]> {
    return invoke<[number, number]>("save_window_position");
  }

  return { enableAlwaysOnTop, disableAlwaysOnTop, savePosition };
}
