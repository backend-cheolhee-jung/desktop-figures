// 메인 위젯 화면 — 캐릭터 + 말풍선 + 타이머
// TODO: feature/desktop-widget 에서 완성

import { useCharacterStore } from "@/store/characterStore";
import { useActionStore } from "@/store/actionStore";
import { useAppStore } from "@/store/appStore";

export default function MainPage() {
  const character = useCharacterStore((s) => s.character);
  const { status, currentAction } = useActionStore();
  const setPage = useAppStore((s) => s.setPage);

  return (
    <div className="relative flex flex-col items-center justify-end h-full pb-4 select-none">
      {/* 설정 버튼 */}
      <button
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-lg"
        onClick={() => setPage("settings")}
        title="설정"
      >
        ⚙️
      </button>

      {/* 말풍선 */}
      {status === "idle" && (
        <div className="mb-2 bg-white rounded-2xl px-3 py-1 text-sm shadow text-gray-600 border border-gray-100">
          zzz...
        </div>
      )}
      {status === "active" && currentAction?.speechBubble && (
        <div className="mb-2 bg-white rounded-2xl px-3 py-1 text-sm shadow text-gray-700 border border-gray-100">
          {currentAction.speechBubble}
        </div>
      )}

      {/* 캐릭터 이미지 */}
      <div className="w-32 h-32 flex items-center justify-center">
        {character ? (
          <img
            src={
              status === "idle"
                ? character.sleepImagePath
                : (currentAction?.actionImagePath ?? character.baseImagePath)
            }
            alt={character.name}
            className="w-full h-full object-contain"
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
        <p className="mt-1 text-xs text-gray-500">{character.name}</p>
      )}
    </div>
  );
}
