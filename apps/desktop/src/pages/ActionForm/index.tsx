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

  const isEdit = !!editingActionId;

  // ── edit mode state ──
  const [speechBubble, setSpeechBubble] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");

  // ── create mode state ──
  const existingPresetIds = new Set(
    actions.map((a) => {
      const p = ANIMATION_PRESETS.find((p) => p.label === a.name);
      return p?.id ?? null;
    }).filter(Boolean)
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(ANIMATION_PRESETS.map((p) => p.id).filter((id) => !existingPresetIds.has(id)))
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editingActionId) return;
    (async () => {
      const action = await findActionById(editingActionId);
      if (!action) return;
      setSpeechBubble(action.speechBubble ?? "");
      if (action.scheduledAt) {
        const d = new Date(action.scheduledAt);
        setScheduledTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
      }
      if (action.durationMinutes) setDurationMinutes(String(action.durationMinutes));
    })();
  }, [editingActionId]);

  function togglePreset(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!character?.rigTaskId) {
      setError("캐릭터 리깅이 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    if (selectedIds.size === 0) {
      setError("생성할 행동을 하나 이상 선택해 주세요.");
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const presets = ANIMATION_PRESETS.filter((p) => selectedIds.has(p.id));
      const results = await Promise.allSettled(
        presets.map(async (preset) => {
          const taskId = await createAnimation(character.rigTaskId!, preset.actionId);
          return saveAction({
            characterId: character.id,
            name: preset.label,
            generationStatus: "pending",
            meshyTaskId: taskId,
          });
        })
      );
      results.forEach((r) => {
        if (r.status === "fulfilled") addAction(r.value);
      });
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) setError(`${failed}개 행동 생성 요청 실패. 나머지는 생성 중이에요.`);
      else setPage("action-panel");
    } catch (e) {
      setError(e instanceof Error ? e.message : "행동 생성 요청 실패");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveEdit() {
    if (!editingActionId) return;
    setError(null);
    let scheduledAt: number | undefined;
    if (scheduledTime) {
      const [h, m] = scheduledTime.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      scheduledAt = d.getTime();
    }
    const duration = durationMinutes ? parseInt(durationMinutes) : undefined;
    try {
      await updateSpeechBubble(editingActionId, speechBubble);
      if (scheduledAt && duration) await updateActionSchedule(editingActionId, scheduledAt, duration);
      setActions(actions.map((a) =>
        a.id === editingActionId ? { ...a, speechBubble, scheduledAt, durationMinutes: duration } : a
      ));
      setPage("action-panel");
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    }
  }

  return (
    <div className="relative flex flex-col h-full">
      {isGenerating && <LoadingOverlay message="3D 애니메이션 생성 요청 중..." />}

      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <button onClick={() => setPage("action-panel")} className="text-gray-400 hover:text-gray-600">
          ←
        </button>
        <h2 className="text-sm font-bold text-gray-700">
          {isEdit ? "행동 수정" : "행동 등록"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-3">
        {isEdit ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500">말풍선 텍스트</label>
              <input
                value={speechBubble}
                onChange={(e) => setSpeechBubble(e.target.value)}
                placeholder="행동 중 말풍선"
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs font-medium text-gray-500">시작 시간</label>
                <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)}
                  className="border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs font-medium text-gray-500">지속 (분)</label>
                <input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)}
                  placeholder="60" min="1"
                  className="border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-400">생성할 행동을 선택하세요. 이미 등록된 행동은 비활성화돼요.</p>
            <div className="flex flex-col gap-1">
              {ANIMATION_PRESETS.map((preset) => {
                const alreadyExists = existingPresetIds.has(preset.id);
                const checked = selectedIds.has(preset.id);
                return (
                  <label
                    key={preset.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                      alreadyExists
                        ? "bg-gray-50 opacity-40 cursor-not-allowed"
                        : checked
                        ? "bg-blue-50 border border-blue-200"
                        : "bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={alreadyExists}
                      onChange={() => togglePreset(preset.id)}
                      className="accent-blue-500"
                    />
                    <span className="text-sm text-gray-700">{preset.label}</span>
                  </label>
                );
              })}
            </div>
          </>
        )}

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={() => isEdit ? handleSaveEdit() : runGated(handleCreate)}
          disabled={isGenerating || (!isEdit && selectedIds.size === 0)}
          className="w-full bg-blue-500 text-white rounded-2xl py-2.5 text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-40"
        >
          {isEdit ? "저장" : `${selectedIds.size}개 행동 생성`}
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
