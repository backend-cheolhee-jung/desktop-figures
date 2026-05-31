import { useCharacterStore } from "@/store/characterStore";
import { useActionStore } from "@/store/actionStore";
import { useAppStore } from "@/store/appStore";
import { useWindowControl } from "@/hooks/useWindowControl";
import { useScheduler } from "@/hooks/useScheduler";
import { useJobPoller } from "@/hooks/useJobPoller";
import CharacterViewer from "@/components/CharacterViewer";
import ActionTimer from "@/components/ActionTimer";

export default function MainPage() {
  const character = useCharacterStore((s) => s.character);
  const { status, currentAction, stopAction } = useActionStore();
  const { setPage } = useAppStore();
  const { disableAlwaysOnTop } = useWindowControl();

  useScheduler();
  useJobPoller();

  async function handleStopAction() {
    await disableAlwaysOnTop();
    stopAction();
  }

  return (
    <div className="relative flex flex-col items-center justify-end h-full pb-4 select-none">
      {/* 상단 버튼 */}
      <div className="absolute top-2 right-2 flex gap-1.5">
        <button
          onClick={() => setPage("action-panel")}
          className="text-gray-400 hover:text-gray-600 text-base"
          title="행동 관리"
        >
          📋
        </button>
        <button
          onClick={() => setPage("settings")}
          className="text-gray-400 hover:text-gray-600 text-base"
          title="설정"
        >
          ⚙️
        </button>
      </div>

      {/* 말풍선 */}
      {status === "idle" && (
        <div className="mb-2 bg-white rounded-2xl px-3 py-1 text-sm shadow-sm text-gray-500 border border-gray-100">
          zzz...
        </div>
      )}
      {status === "active" && currentAction?.speechBubble && (
        <div className="mb-2 bg-white rounded-2xl px-3 py-1 text-sm shadow-sm text-gray-700 border border-gray-100 flex items-center gap-1">
          <span className="truncate max-w-[140px]">{currentAction.speechBubble}</span>
        </div>
      )}

      {/* 캐릭터 3D 뷰어 */}
      <div className="w-32 h-32 flex items-center justify-center">
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
    </div>
  );
}
