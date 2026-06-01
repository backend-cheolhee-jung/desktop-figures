import { useState } from "react";
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
import ContextMenu from "@/components/ContextMenu";
import ActionListPanel from "@/components/ActionListPanel";
import SpeechBubblePanel from "@/components/SpeechBubblePanel";

type ActivePanel = "actions" | "speech" | null;

export default function MainPage() {
  const character = useCharacterStore((s) => s.character);
  const setCharacter = useCharacterStore((s) => s.setCharacter);
  const { status, currentAction, stopAction, setActions } = useActionStore();
  const { setPage } = useAppStore();
  const { disableAlwaysOnTop, hideWindow } = useWindowControl();

  useScheduler();
  useJobPoller();

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  async function handleStopAction() {
    await disableAlwaysOnTop();
    stopAction();
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setActivePanel(null);
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }

  async function handleDeleteCharacter() {
    if (!character) return;
    const confirmed = window.confirm(`"${character.name}" 캐릭터를 삭제할까요? 이 작업은 되돌릴 수 없어요.`);
    if (!confirmed) return;
    await deleteActionsByCharacterId(character.id);
    await deleteCharacter(character.id);
    setCharacter(null);
    setActions([]);
    setPage("setup");
  }

  const idleSpeech = character?.idleSpeechBubble ?? "zzz...";

  return (
    <div className="relative flex flex-col items-center justify-end h-full pb-4 select-none">
      {/* 상단 버튼 */}
      <div className="absolute top-2 right-2 flex gap-1.5">
        <button
          onClick={hideWindow}
          className="text-gray-400 hover:text-red-400 text-base font-medium"
          title="숨기기"
        >
          ✕
        </button>
      </div>

      {/* 말풍선 */}
      {status === "idle" && (
        <div
          className="mb-2 bg-white rounded-2xl px-3 py-1 text-sm shadow-sm text-gray-500 border border-gray-100 cursor-context-menu"
          onContextMenu={handleContextMenu}
        >
          {idleSpeech}
        </div>
      )}
      {status === "active" && currentAction?.speechBubble && (
        <div
          className="mb-2 bg-white rounded-2xl px-3 py-1 text-sm shadow-sm text-gray-700 border border-gray-100 flex items-center gap-1 cursor-context-menu"
          onContextMenu={handleContextMenu}
        >
          <span className="truncate max-w-[140px]">{currentAction.speechBubble}</span>
        </div>
      )}

      {/* 캐릭터 3D 뷰어 + 오버레이 패널 */}
      <div
        className="relative w-32 h-32 flex items-center justify-center cursor-context-menu"
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
        <p className="mt-1 text-xs text-gray-400">{character.name}</p>
      )}

      {/* 행동 중 — 타이머 + 종료 버튼 */}
      {status === "active" && currentAction && (
        <div className="mt-2 flex items-center gap-2">
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

      {/* 컨텍스트 메뉴 */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onManageActions={() => setActivePanel("actions")}
          onSetSpeechBubble={() => setActivePanel("speech")}
          onDeleteCharacter={handleDeleteCharacter}
        />
      )}
    </div>
  );
}
