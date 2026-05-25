import { useCharacterStore } from "@/store/characterStore";
import { useActionStore } from "@/store/actionStore";
import { useAppStore } from "@/store/appStore";
import { useWindowControl } from "@/hooks/useWindowControl";
import { useScheduler } from "@/hooks/useScheduler";
import { toDisplayUrl } from "@/lib/imageUtils";
import ActionTimer from "@/components/ActionTimer";

export default function MainPage() {
  const character = useCharacterStore((s) => s.character);
  const { status, currentAction, stopAction } = useActionStore();
  const { setPage } = useAppStore();
  const { disableAlwaysOnTop } = useWindowControl();

  useScheduler();

  async function handleStopAction() {
    await disableAlwaysOnTop();
    stopAction();
  }

  const characterImageSrc = character
    ? toDisplayUrl(
        status === "idle"
          ? character.sleepImagePath
          : (currentAction?.actionImagePath ?? character.baseImagePath)
      )
    : null;

  const isIdle = status === "idle";

  return (
    <div className="relative flex flex-col items-center justify-end h-full pb-4 select-none">
      {/* 상단 버튼 — drag region 밖 */}
      <div className="absolute top-2 right-2 flex gap-1.5 z-10">
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

      {/* 드래그 가능 영역 — 캐릭터 + 말풍선 */}
      <div
        data-tauri-drag-region
        className="flex flex-col items-center justify-end flex-1 w-full pb-0 cursor-grab active:cursor-grabbing"
      >
        {/* 말풍선 */}
        {isIdle && (
          <div className="mb-1 bg-white/90 rounded-2xl px-3 py-1 text-sm shadow-sm text-gray-400 border border-gray-100 relative">
            잠자는 중...
          </div>
        )}
        {!isIdle && currentAction?.speechBubble && (
          <div className="mb-1 bg-white/90 rounded-2xl px-3 py-1 text-sm shadow-sm text-gray-700 border border-gray-100">
            <span className="truncate max-w-[120px] block">{currentAction.speechBubble}</span>
          </div>
        )}

        {/* zzz 떠오르는 애니메이션 (idle 전용) */}
        {isIdle && (
          <div className="relative w-16 h-8 mb-[-8px]">
            <span className="absolute left-2 bottom-0 text-blue-300 text-xs font-bold animate-zzz-1">z</span>
            <span className="absolute left-5 bottom-0 text-blue-300 text-sm font-bold animate-zzz-2">z</span>
            <span className="absolute left-9 bottom-0 text-blue-300 text-base font-bold animate-zzz-3">z</span>
          </div>
        )}

        {/* 캐릭터 이미지 */}
        <div className={`w-32 h-32 flex items-center justify-center ${isIdle ? "animate-float" : ""}`}>
          {characterImageSrc ? (
            <img
              src={characterImageSrc}
              alt={character?.name}
              className={[
                "w-full h-full object-contain drop-shadow-md",
                isIdle ? "opacity-90" : "",
              ].join(" ")}
              draggable={false}
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
      </div>

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
