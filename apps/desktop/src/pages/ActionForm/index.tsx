import { useState, useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { useCharacterStore } from "@/store/characterStore";
import { useActionStore } from "@/store/actionStore";
import { createAnimation, actionPromptFor } from "@/lib/meshy";
import { saveAction, findActionById, updateSpeechBubble, updateActionSchedule } from "@/repository/actionRepository";
import LoadingOverlay from "@/components/LoadingOverlay";
import AuthModal from "@/components/AuthModal";
import { useGenerationGate } from "@/hooks/useGenerationGate";

type Step = "name" | "generating" | "detail";

export default function ActionFormPage() {
  const { editingActionId, setPage } = useAppStore();
  const character = useCharacterStore((s) => s.character);
  const { actions, addAction, setActions } = useActionStore();
  const { showModal, setShowModal, runGated } = useGenerationGate();

  const [step, setStep] = useState<Step>("name");
  const [actionName, setActionName] = useState("");
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [speechBubble, setSpeechBubble] = useState("");
  const [scheduledTime, setScheduledTime] = useState(""); // "HH:MM"
  const [durationMinutes, setDurationMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 수정 모드: 기존 행동 로드
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
      setStep("detail");
    })();
  }, [editingActionId]);

  async function handleStartGeneration() {
    if (!actionName.trim() || !character) return;
    if (!character.modelRemoteUrl) {
      setError("캐릭터 3D 모델이 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setStep("generating");
    setError(null);
    try {
      const taskId = await createAnimation(
        character.modelRemoteUrl,
        actionPromptFor(actionName.trim())
      );
      setPendingTaskId(taskId);
      setStep("detail");
    } catch (e) {
      setError(e instanceof Error ? e.message : "애니메이션 생성 요청 실패");
      setStep("name");
    }
  }

  async function handleSave() {
    if (!actionName.trim()) return;
    setError(null);

    let scheduledAt: number | undefined;
    if (scheduledTime) {
      const [h, m] = scheduledTime.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1); // 이미 지났으면 내일로
      scheduledAt = d.getTime();
    }

    const duration = durationMinutes ? parseInt(durationMinutes) : undefined;

    try {
      if (editingActionId) {
        // 수정
        await updateSpeechBubble(editingActionId, speechBubble);
        if (scheduledAt && duration) await updateActionSchedule(editingActionId, scheduledAt, duration);
        setActions(
          actions.map((a) =>
            a.id === editingActionId
              ? { ...a, speechBubble, scheduledAt, durationMinutes: duration }
              : a
          )
        );
      } else {
        // 신규
        if (!pendingTaskId) {
          setError("먼저 행동 애니메이션 생성을 시작해 주세요.");
          return;
        }
        const action = await saveAction({
          characterId: character!.id,
          name: actionName.trim(),
          generationStatus: "pending",
          meshyTaskId: pendingTaskId,
          speechBubble: speechBubble || undefined,
          scheduledAt,
          durationMinutes: duration,
        });
        addAction(action);
      }
      setPage("action-panel");
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    }
  }

  const isEdit = !!editingActionId;

  return (
    <div className="relative flex flex-col h-full">
      {step === "generating" && <LoadingOverlay message="3D 애니메이션 생성 요청 중..." />}

      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <button onClick={() => setPage("action-panel")} className="text-gray-400 hover:text-gray-600">
          ←
        </button>
        <h2 className="text-sm font-bold text-gray-700">
          {isEdit ? "행동 수정" : "행동 추가"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-4 pb-4">

        {/* Step 1: 행동 이름 + 이미지 생성 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500">행동 이름</label>
          <div className="flex gap-2">
            <input
              value={actionName}
              onChange={(e) => setActionName(e.target.value)}
              placeholder="코딩, 공부, 운동, 식사..."
              disabled={isEdit}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50 disabled:text-gray-400"
            />
            {!isEdit && (
              <button
                onClick={() => runGated(handleStartGeneration)}
                disabled={!actionName.trim() || !character || step === "generating"}
                className="px-3 py-2 bg-blue-500 text-white text-xs rounded-xl disabled:opacity-40 hover:bg-blue-600 shrink-0"
              >
                생성
              </button>
            )}
          </div>
        </div>

        {/* 3D 애니메이션 생성 안내 */}
        {step === "detail" && !editingActionId && (
          <div className="flex justify-center">
            <span className="text-xs text-blue-400 bg-blue-50 rounded-full px-3 py-1">
              🧊 3D 애니메이션 생성 중 · 잠시 후 캐릭터에 반영돼요
            </span>
          </div>
        )}

        {/* Step 2: 상세 설정 (이미지 생성 후) */}
        {step === "detail" && (
          <>
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
          </>
        )}

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
      </div>

      {/* 저장 버튼 */}
      {step === "detail" && (
        <div className="px-4 pb-4">
          <button
            onClick={handleSave}
            className="w-full bg-blue-500 text-white rounded-2xl py-2.5 text-sm font-semibold hover:bg-blue-600 transition-colors"
          >
            저장
          </button>
        </div>
      )}

      {showModal && (
        <AuthModal
          onClose={() => setShowModal(false)}
          onApproved={() => { setShowModal(false); handleStartGeneration(); }}
        />
      )}
    </div>
  );
}
