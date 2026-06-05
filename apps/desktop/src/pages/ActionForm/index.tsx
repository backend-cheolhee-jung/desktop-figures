import { useState, useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { useCharacterStore } from "@/store/characterStore";
import { useActionStore } from "@/store/actionStore";
import { createAnimation, ANIMATION_PRESETS } from "@/lib/meshy";
import { saveAction, findActionById, updateSpeechBubble, updateActionSchedule } from "@/repository/actionRepository";
import LoadingOverlay from "@/components/LoadingOverlay";
import AuthModal from "@/components/AuthModal";
import { useGenerationGate } from "@/hooks/useGenerationGate";

export default function ActionFormPage() {
  const { editingActionId, setPage } = useAppStore();
  const character = useCharacterStore((s) => s.character);
  const { actions, addAction, setActions } = useActionStore();
  const { showModal, setShowModal, runGated } = useGenerationGate();

  const [isGenerating, setIsGenerating] = useState(false);
  const [actionName, setActionName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState<string>(ANIMATION_PRESETS[0].id);
  const [speechBubble, setSpeechBubble] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editingActionId) return;
    (async () => {
      const action = await findActionById(editingActionId);
      if (!action) return;
      setActionName(action.name);
      setSpeechBubble(action.speechBubble ?? "");
      if (action.scheduledAt) {
        const d = new Date(action.scheduledAt);
        setScheduledTime(
          `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
        );
      }
      if (action.durationMinutes) setDurationMinutes(String(action.durationMinutes));
    })();
  }, [editingActionId]);

  function buildSchedule(): { scheduledAt?: number; duration?: number } {
    let scheduledAt: number | undefined;
    if (scheduledTime) {
      const [h, m] = scheduledTime.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      scheduledAt = d.getTime();
    }
    const duration = durationMinutes ? parseInt(durationMinutes) : undefined;
    return { scheduledAt, duration };
  }

  async function handleCreate() {
    if (!character) return;
    if (!character.rigTaskId) {
      setError("캐릭터 리깅이 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const preset = ANIMATION_PRESETS.find((p) => p.id === selectedPresetId) ?? ANIMATION_PRESETS[0];
      const taskId = await createAnimation(character.rigTaskId, preset.actionId);
      const { scheduledAt, duration } = buildSchedule();
      const action = await saveAction({
        characterId: character.id,
        name: actionName.trim() || preset.label,
        generationStatus: "pending",
        meshyTaskId: taskId,
        speechBubble: speechBubble || undefined,
        scheduledAt,
        durationMinutes: duration,
      });
      addAction(action);
      setPage("action-panel");
    } catch (e) {
      setError(e instanceof Error ? e.message : "애니메이션 생성 요청 실패");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveEdit() {
    if (!editingActionId) return;
    setError(null);
    const { scheduledAt, duration } = buildSchedule();
    try {
      await updateSpeechBubble(editingActionId, speechBubble);
      if (scheduledAt && duration) await updateActionSchedule(editingActionId, scheduledAt, duration);
      setActions(
        actions.map((a) =>
          a.id === editingActionId
            ? { ...a, speechBubble, scheduledAt, durationMinutes: duration }
            : a
        )
      );
      setPage("action-panel");
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    }
  }

  const isEdit = !!editingActionId;

  return (
    <div className="relative flex flex-col h-full">
      {isGenerating && <LoadingOverlay message="3D 애니메이션 생성 요청 중..." />}

      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <button onClick={() => setPage("action-panel")} className="text-gray-400 hover:text-gray-600">
          ←
        </button>
        <h2 className="text-sm font-bold text-gray-700">
          {isEdit ? "일정 수정" : "일정 등록"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-4 pb-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500">행동 이름</label>
          <input
            value={actionName}
            onChange={(e) => setActionName(e.target.value)}
            placeholder="이름 생략 시 애니메이션 타입으로 자동 설정"
            disabled={isEdit}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        {!isEdit && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500">애니메이션 타입</label>
            <select
              value={selectedPresetId}
              onChange={(e) => setSelectedPresetId(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            >
              {ANIMATION_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500">말풍선 텍스트</label>
          <input
            value={speechBubble}
            onChange={(e) => setSpeechBubble(e.target.value)}
            placeholder="코딩 코딩 코딩..."
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-xs font-medium text-gray-500">시작 시간</label>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-xs font-medium text-gray-500">지속 시간 (분)</label>
            <input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="60"
              min="1"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={() => isEdit ? handleSaveEdit() : runGated(handleCreate)}
          disabled={isGenerating}
          className="w-full bg-blue-500 text-white rounded-2xl py-2.5 text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-40"
        >
          {isEdit ? "저장" : "생성"}
        </button>
      </div>

      {showModal && (
        <AuthModal
          onClose={() => setShowModal(false)}
          onApproved={() => { setShowModal(false); handleCreate(); }}
        />
      )}
    </div>
  );
}
