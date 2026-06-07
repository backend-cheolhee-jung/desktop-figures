import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { useCharacterStore } from "@/store/characterStore";
import { useActionStore } from "@/store/actionStore";
import { useAppStore } from "@/store/appStore";
import { useWindowControl } from "@/hooks/useWindowControl";
import { useScheduler } from "@/hooks/useScheduler";
import { useJobPoller } from "@/hooks/useJobPoller";
import { deleteCharacter } from "@/repository/characterRepository";
import { deleteActionsByCharacterId } from "@/repository/actionRepository";
import CharacterViewer from "@/components/CharacterViewer";
import ActionTimer from "@/components/ActionTimer";
import ActionListPanel from "@/components/ActionListPanel";
import SpeechBubblePanel from "@/components/SpeechBubblePanel";
import ConfirmDialog from "@/components/ConfirmDialog";

type ActivePanel = "actions" | "speech" | null;

export default function MainPage() {
  const character = useCharacterStore((s) => s.character);
  const setCharacter = useCharacterStore((s) => s.setCharacter);
  const { status, currentAction, stopAction, setActions } = useActionStore();
  const { setPage, isAlwaysOnTop } = useAppStore();
  const { disableAlwaysOnTop, enableAlwaysOnTop, hideWindow } = useWindowControl();

  useScheduler();
  useJobPoller();

  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const activePanelRef = useRef<ActivePanel>(null);
  activePanelRef.current = activePanel;

  useEffect(() => {
    const win = getCurrentWindow();
    if (activePanel) {
      win.setSize(new LogicalSize(300, 360));
    } else {
      win.setSize(new LogicalSize(160, 220));
    }
  }, [activePanel]);

  async function handleStopAction() {
    await disableAlwaysOnTop();
    stopAction();
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setActivePanel(null);
    invoke("show_context_menu", { isPinned: isAlwaysOnTop });
  }

  async function confirmDeleteCharacter() {
    if (!character) return;
    await deleteActionsByCharacterId(character.id);
    await deleteCharacter(character.id);
    setCharacter(null);
    setActions([]);
    setPage("setup");
  }

  function handleDeleteCharacter() {
    if (!character) return;
    setShowDeleteConfirm(true);
  }

  async function handlePinToggle() {
    if (isAlwaysOnTop) {
      await disableAlwaysOnTop();
    } else {
      await enableAlwaysOnTop();
    }
  }

  const handleDeleteCharacterRef = useRef(handleDeleteCharacter);
  const handlePinToggleRef = useRef(handlePinToggle);
  const hideWindowRef = useRef(hideWindow);
  const setActivePanelRef = useRef(setActivePanel);
  handleDeleteCharacterRef.current = handleDeleteCharacter;
  handlePinToggleRef.current = handlePinToggle;
  hideWindowRef.current = hideWindow;
  setActivePanelRef.current = setActivePanel;

  useEffect(() => {
    const unlisten = listen<string>("context-menu-action", (event) => {
      const action = event.payload;
      if (action === "pin") handlePinToggleRef.current();
      else if (action === "delete") handleDeleteCharacterRef.current();
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  const idleSpeech = character?.idleSpeechBubble ?? "zzz...";
  const showIdleSpeech = (() => {
    if (!character?.idleSpeechScheduledAt || !character?.idleSpeechDurationMinutes) return true;
    const now = Date.now();
    const end = character.idleSpeechScheduledAt + character.idleSpeechDurationMinutes * 60_000;
    return now >= character.idleSpeechScheduledAt && now < end;
  })();

  return (
    <div className="relative flex flex-col items-center justify-end h-full pb-4 select-none">
      {/* 말풍선 (클릭 → 편집) */}
      {status === "idle" && showIdleSpeech && (
        <div
          className="mb-2 bg-white rounded-2xl px-3 py-1 text-sm shadow-sm text-gray-500 border border-gray-100 cursor-pointer hover:border-blue-200 transition-colors pointer-events-auto"
          data-tauri-drag-region
          onClick={() => setActivePanel("speech")}
          onContextMenu={handleContextMenu}
        >
          {idleSpeech}
        </div>
      )}
      {status === "active" && currentAction?.speechBubble && (
        <div
          className="mb-2 bg-white rounded-2xl px-3 py-1 text-sm shadow-sm text-gray-700 border border-gray-100 flex items-center gap-1 pointer-events-auto"
          onContextMenu={handleContextMenu}
        >
          <span className="truncate max-w-[140px]">{currentAction.speechBubble}</span>
        </div>
      )}

      {/* 캐릭터 (더블클릭 → 일정 관리) */}
      <div
        className="relative w-32 h-32 flex items-center justify-center cursor-grab active:cursor-grabbing pointer-events-auto outline-none"
        data-tauri-drag-region
        onContextMenu={handleContextMenu}
      >
        {character ? (
          <CharacterViewer
            character={character}
            currentAction={currentAction}
            status={status}
          />
        ) : (
          <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center text-3xl">
            🐾
          </div>
        )}

        {activePanel === "actions" && (
          <ActionListPanel onClose={() => setActivePanel(null)} />
        )}
        {activePanel === "speech" && (
          <SpeechBubblePanel onClose={() => setActivePanel(null)} />
        )}
      </div>

      {/* 캐릭터 이름 */}
      {character && (
        <p className="mt-1 text-xs text-gray-400 pointer-events-auto" data-tauri-drag-region>{character.name}</p>
      )}

      {/* 행동 중 — 타이머 + 종료 */}
      {status === "active" && currentAction && (
        <div className="mt-2 flex items-center gap-2 pointer-events-auto">
          <ActionTimer
            actionName={currentAction.name}
            endTime={useActionStore.getState().actionEndTime ?? 0}
            onEnd={handleStopAction}
          />
          <button
            onClick={handleStopAction}
            className="text-xs text-gray-400 hover:text-red-400"
            title="행동 종료"
          >
            ■
          </button>
        </div>
      )}

      {showDeleteConfirm && character && (
        <ConfirmDialog
          message={`"${character.name}" 캐릭터를 삭제할까요?\n이 작업은 되돌릴 수 없어요.`}
          onConfirm={() => { setShowDeleteConfirm(false); confirmDeleteCharacter(); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
