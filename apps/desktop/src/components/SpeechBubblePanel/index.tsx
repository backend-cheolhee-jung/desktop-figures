import { useState } from "react";
import { useCharacterStore } from "@/store/characterStore";
import { useActionStore } from "@/store/actionStore";
import { updateIdleSpeechBubble } from "@/repository/characterRepository";
import { updateSpeechBubble, updateActionSchedule } from "@/repository/actionRepository";

interface Props {
  onClose: () => void;
}

export default function SpeechBubblePanel({ onClose }: Props) {
  const character = useCharacterStore((s) => s.character);
  const setCharacter = useCharacterStore((s) => s.setCharacter);
  const { actions, setActions } = useActionStore();

  const [idleText, setIdleText] = useState(character?.idleSpeechBubble ?? "");
  const [scheduledTime, setScheduledTime] = useState(() => {
    if (!character?.idleSpeechScheduledAt) return "";
    const d = new Date(character.idleSpeechScheduledAt);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [durationMinutes, setDurationMinutes] = useState(
    character?.idleSpeechDurationMinutes ? String(character.idleSpeechDurationMinutes) : ""
  );

  // 행동 말풍선 편집
  const [selectedActionId, setSelectedActionId] = useState<string>("");
  const [actionBubbleText, setActionBubbleText] = useState("");
  const [actionScheduledTime, setActionScheduledTime] = useState("");
  const [actionDuration, setActionDuration] = useState("");

  const readyActions = actions.filter((a) => a.generationStatus === "ready");

  function handleSelectAction(id: string) {
    setSelectedActionId(id);
    const action = actions.find((a) => a.id === id);
    if (!action) return;
    setActionBubbleText(action.speechBubble ?? "");
    if (action.scheduledAt) {
      const d = new Date(action.scheduledAt);
      setActionScheduledTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    } else {
      setActionScheduledTime("");
    }
    setActionDuration(action.durationMinutes ? String(action.durationMinutes) : "");
  }

  async function handleSave() {
    if (!character) return;

    // 1. idle 말풍선 저장
    let scheduledAt: number | undefined;
    if (scheduledTime) {
      const [h, m] = scheduledTime.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      scheduledAt = d.getTime();
    }
    const duration = durationMinutes ? parseInt(durationMinutes) : undefined;
    await updateIdleSpeechBubble(character.id, idleText, scheduledAt, duration);
    setCharacter({ ...character, idleSpeechBubble: idleText, idleSpeechScheduledAt: scheduledAt, idleSpeechDurationMinutes: duration });

    // 2. 행동 말풍선 + 스케줄 저장
    if (selectedActionId) {
      await updateSpeechBubble(selectedActionId, actionBubbleText);
      if (actionScheduledTime && actionDuration) {
        const [h, m] = actionScheduledTime.split(":").map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
        await updateActionSchedule(selectedActionId, d.getTime(), parseInt(actionDuration));
      }
      setActions(actions.map((a) =>
        a.id === selectedActionId
          ? { ...a, speechBubble: actionBubbleText, scheduledAt: actionScheduledTime ? Date.now() : a.scheduledAt, durationMinutes: actionDuration ? parseInt(actionDuration) : a.durationMinutes }
          : a
      ));
    }

    onClose();
  }

  return (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 bg-white rounded-2xl shadow-xl p-3 z-50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">말풍선 / 행동 설정</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
      </div>

      {/* ── idle 말풍선 ── */}
      <p className="text-xs font-medium text-gray-400 mb-1">기본 말풍선</p>
      <input
        value={idleText}
        onChange={(e) => setIdleText(e.target.value)}
        placeholder="zzz... 또는 하고 싶은 말"
        maxLength={30}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
        autoFocus
      />
      <div className="flex gap-2 mt-2">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs text-gray-400">시작 시간</label>
          <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)}
            className="border border-gray-200 rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs text-gray-400">지속 (분)</label>
          <input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)}
            placeholder="60" min="1"
            className="border border-gray-200 rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
      </div>

      {/* ── 행동 말풍선 ── */}
      {readyActions.length > 0 && (
        <>
          <div className="my-3" />
          <p className="text-xs font-medium text-gray-400 mb-1">행동 말풍선 / 스케줄</p>
          <select
            value={selectedActionId}
            onChange={(e) => handleSelectAction(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white mb-2"
          >
            <option value="">행동 선택...</option>
            {readyActions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          {selectedActionId && (
            <>
              <input
                value={actionBubbleText}
                onChange={(e) => setActionBubbleText(e.target.value)}
                placeholder="행동 중 말풍선"
                maxLength={30}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <div className="flex gap-2 mt-2">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs text-gray-400">시작 시간</label>
                  <input type="time" value={actionScheduledTime} onChange={(e) => setActionScheduledTime(e.target.value)}
                    className="border border-gray-200 rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs text-gray-400">지속 (분)</label>
                  <input type="number" value={actionDuration} onChange={(e) => setActionDuration(e.target.value)}
                    placeholder="60" min="1"
                    className="border border-gray-200 rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
              </div>
            </>
          )}
        </>
      )}

      <button onClick={handleSave}
        className="mt-3 w-full bg-blue-500 text-white rounded-xl py-1.5 text-xs font-medium hover:bg-blue-600">
        저장
      </button>
    </div>
  );
}
