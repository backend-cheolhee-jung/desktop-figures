import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { useCharacterStore } from "@/store/characterStore";
import { useActionStore } from "@/store/actionStore";
import { findFirstCharacter } from "@/repository/characterRepository";
import { findActionsByCharacterId } from "@/repository/actionRepository";
import { useWindowControl, WIDGET_SIZE, PANEL_SIZE } from "@/hooks/useWindowControl";
import SetupPage from "@/pages/Setup";
import MainPage from "@/pages/Main";
import SettingsPage from "@/pages/Settings";
import ActionPanelPage from "@/pages/ActionPanel";
import ActionFormPage from "@/pages/ActionForm";

export default function App() {
  const currentPage = useAppStore((s) => s.currentPage);
  const setPage = useAppStore((s) => s.setPage);
  const setCharacter = useCharacterStore((s) => s.setCharacter);
  const setActions = useActionStore((s) => s.setActions);
  const { resizeWindow } = useWindowControl();

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
    const isWidget = currentPage === "main";
    const { width, height } = isWidget ? WIDGET_SIZE : PANEL_SIZE;
    resizeWindow(width, height).catch(() => {});
  }, [currentPage]);

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
