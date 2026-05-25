import { useState, useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { useCharacterStore } from "@/store/characterStore";
import { useActionStore } from "@/store/actionStore";
import { generateActionImage } from "@/lib/llm";
import { saveBase64Image, toDisplayUrl } from "@/lib/imageUtils";
import { saveAction, findActionById, updateSpeechBubble, updateActionSchedule } from "@/repository/actionRepository";
import LoadingOverlay from "@/components/LoadingOverlay";

type Step = "name" | "generating" | "detail";

export default function ActionFormPage() {
  const { editingActionId, setPage } = useAppStore();
  const character = useCharacterStore((s) => s.character);
  const { actions, addAction, setActions } = useActionStore();

  const [step, setStep] = useState<Step>("name");
  const [actionName, setActionName] = useState("");
  const [actionImagePath, setActionImagePath] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [speechBubble, setSpeechBubble] = useState("");
  const [scheduledTime, setScheduledTime] = useState(""); // "HH:MM"
  const [durationMinutes, setDurationMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  // 수정 모드: 기존 행동 로드
  useEffect(() => {
    if (!editingActionId) return;
    (async () => {
      const action = await findActionById(editingActionId);
      if (!action) return;
      setActionName(action.name);
      setActionImagePath(action.actionImagePath);
      setPreviewUrl(await toDisplayUrl(action.actionImagePath));
      setSpeechBubble(action.speechBubble ?? "");
      setSavedId(action.id);
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

  async function handleGenerateImage() {
    if (!actionName.trim() || !character) return;
    setStep("generating");
    setError(null);
    try {
      const imageBase64 = await generateActionImage(character.name, actionName.trim());

      const id = savedId ?? crypto.randomUUID();
      const path = await saveBase64Image(imageBase64, `actions/${id}`, "action.png");

      setActionImagePath(path);
      setPreviewUrl(await toDisplayUrl(path));
      setSavedId(id);
      setStep("detail");
    } catch (e) {
      setError(e instanceof Error ? e.message : "이미지 생성 실패");
      setStep("name");
    }
  }

  async function handleSave() {
    if (!actionImagePath || !actionName.trim()) return;
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
        const action = await saveAction({
          characterId: character!.id,
          name: actionName.trim(),
          actionImagePath,
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
      {step === "generating" && <LoadingOverlay message="행동 이미지 생성 중..." />}

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
                onClick={handleGenerateImage}
                disabled={!actionName.trim() || !character || step === "generating"}
                className="px-3 py-2 bg-blue-500 text-white text-xs rounded-xl disabled:opacity-40 hover:bg-blue-600 shrink-0"
              >
                생성
              </button>
            )}
          </div>
        </div>

        {/* 생성된 이미지 미리보기 */}
        {previewUrl && (
          <div className="flex justify-center">
            <img
              src={previewUrl}
              alt="action preview"
              className="w-24 h-24 object-contain rounded-2xl bg-gray-50 border border-gray-100"
            />
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
    </div>
  );
}
