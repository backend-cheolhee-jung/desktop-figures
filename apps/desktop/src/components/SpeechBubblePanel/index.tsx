import { useState } from "react";
import { useCharacterStore } from "@/store/characterStore";
import { useActionStore } from "@/store/actionStore";
import { updateIdleSpeechBubble } from "@/repository/characterRepository";
import { updateSpeechBubble } from "@/repository/actionRepository";

interface Props {
  onClose: () => void;
}

export default function SpeechBubblePanel({ onClose }: Props) {
  const character = useCharacterStore((s) => s.character);
  const setCharacter = useCharacterStore((s) => s.setCharacter);
  const { actions, setActions } = useActionStore();

  const [idleText, setIdleText] = useState(character?.idleSpeechBubble ?? "");
  const [selectedActionId, setSelectedActionId] = useState<string>("");
  const [actionBubbleText, setActionBubbleText] = useState("");

  function handleSelectAction(id: string) {
    setSelectedActionId(id);
    const action = actions.find((a) => a.id === id);
    setActionBubbleText(action?.speechBubble ?? "");
  }

  async function handleSave() {
    if (!character) return;

    await updateIdleSpeechBubble(
      character.id,
      idleText,
      character.idleSpeechScheduledAt,
      character.idleSpeechDurationMinutes,
    );
    setCharacter({ ...character, idleSpeechBubble: idleText });

    if (selectedActionId) {
      await updateSpeechBubble(selectedActionId, actionBubbleText);
      setActions(
        actions.map((a) =>
          a.id === selectedActionId ? { ...a, speechBubble: actionBubbleText } : a
        )
      );
    }

    onClose();
  }

  const selectedAction = actions.find((a) => a.id === selectedActionId);
  const canEditBubble = selectedAction?.generationStatus === "ready";

  return (
    <div className="fixed inset-0 flex flex-col bg-white rounded-2xl shadow-xl p-4 z-50 pointer-events-auto">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-gray-700">스케줄 관리</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
      </div>

      <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-400">기본 말풍선</label>
          <input
            value={idleText}
            onChange={(e) => setIdleText(e.target.value)}
            placeholder="zzz... 또는 하고 싶은 말"
            maxLength={30}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
            autoFocus
          />
        </div>

        {actions.length > 0 && (
          <>
            <div className="border-t border-gray-100" />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-400">행동 말풍선</label>
              <select
                value={selectedActionId}
                onChange={(e) => handleSelectAction(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              >
                <option value="">행동 선택...</option>
                {actions.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.generationStatus !== "ready"}>
                    {a.generationStatus === "ready" ? a.name : `⏳ ${a.name}`}
                  </option>
                ))}
              </select>
              {selectedActionId && canEditBubble && (
                <input
                  value={actionBubbleText}
                  onChange={(e) => setActionBubbleText(e.target.value)}
                  placeholder="행동 중 말풍선"
                  maxLength={30}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 mt-1"
                />
              )}
              {selectedActionId && !canEditBubble && (
                <p className="text-xs text-gray-300 mt-1 text-center">아직 생성 중이에요</p>
              )}
            </div>
          </>
        )}

        {actions.length === 0 && (
          <p className="text-xs text-gray-300 text-center py-2">등록된 행동이 없어요</p>
        )}
      </div>

      <button
        onClick={handleSave}
        className="mt-4 w-full bg-blue-500 text-white rounded-xl py-2 text-xs font-medium hover:bg-blue-600"
      >
        저장
      </button>
    </div>
  );
}
