import { useEffect } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { useAppStore, Page } from "@/store/appStore";
import { useCharacterStore } from "@/store/characterStore";
import { useActionStore } from "@/store/actionStore";
import { findFirstCharacter } from "@/repository/characterRepository";
import { findActionsByCharacterId } from "@/repository/actionRepository";
import { useWindowControl } from "@/hooks/useWindowControl";
import SetupPage from "@/pages/Setup";
import MainPage from "@/pages/Main";
import SettingsPage from "@/pages/Settings";
import ActionPanelPage from "@/pages/ActionPanel";
import ActionFormPage from "@/pages/ActionForm";

const WIDGET_SIZE = new LogicalSize(160, 220);
const PANEL_SIZE = new LogicalSize(320, 500);

async function resizeWindow(page: Page) {
  const win = getCurrentWindow();
  if (page === "main") {
    await win.setSize(WIDGET_SIZE);
    await win.setResizable(false);
  } else {
    await win.setSize(PANEL_SIZE);
    await win.setResizable(false);
  }
}

export default function App() {
  const currentPage = useAppStore((s) => s.currentPage);
  const setPage = useAppStore((s) => s.setPage);
  const setCharacter = useCharacterStore((s) => s.setCharacter);
  const setActions = useActionStore((s) => s.setActions);
  useWindowControl();

  useEffect(() => {
    (async () => {
      try {
        const character = await findFirstCharacter();
        if (!character) {
          setPage("setup");
          return;
        }
        setCharacter(character);
        setActions(await findActionsByCharacterId(character.id));
        setPage("main");
      } catch (e) {
        console.error("DB init error:", e);
        setPage("setup");
      }
    })();
  }, []);

  useEffect(() => {
    if (currentPage !== "loading") {
      resizeWindow(currentPage);
    }
  }, [currentPage]);

  if (currentPage === "loading") return null;

  const isWidget = currentPage === "main";

  return (
    <div className={`w-full h-screen ${isWidget ? "bg-transparent" : "bg-white rounded-2xl shadow-xl overflow-hidden"}`}>
      {currentPage === "setup" && <SetupPage />}
      {currentPage === "main" && <MainPage />}
      {currentPage === "settings" && <SettingsPage />}
      {currentPage === "action-panel" && <ActionPanelPage />}
      {currentPage === "action-form" && <ActionFormPage />}
    </div>
  );
}
