import { useState } from "react";
import { useAppStore } from "@/store/appStore";
import { useCharacterStore } from "@/store/characterStore";
import { useActionStore } from "@/store/actionStore";
import { useDragDrop } from "@/hooks/useDragDrop";
import { generateCharacterImages } from "@/lib/llm";
import { saveBase64Image } from "@/lib/imageUtils";
import { saveCharacter } from "@/repository/characterRepository";
import LoadingOverlay from "@/components/LoadingOverlay";

type Step = "input" | "generating";

export default function SetupPage() {
  const setPage = useAppStore((s) => s.setPage);
  const setCharacter = useCharacterStore((s) => s.setCharacter);
  const setActions = useActionStore((s) => s.setActions);

  const [step, setStep] = useState<Step>("input");
  const [characterName, setCharacterName] = useState("");
  const [description, setDescription] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { isDragging, previewUrl, base64, handleDragOver, handleDragLeave, handleDrop, reset } =
    useDragDrop();

  const canCreate = characterName.trim() && (base64 || description.trim());

  async function handleCreate() {
    if (!canCreate) return;
    setStep("generating");
    setError(null);

    try {
      setLoadingMsg("AI가 캐릭터를 만들고 있어요...");
      const { baseImage, sleepImage } = await generateCharacterImages(
        base64 ?? undefined,
        description.trim() || undefined
      );

      setLoadingMsg("이미지를 저장하는 중...");
      const id = crypto.randomUUID();
      const [basePath, sleepPath] = await Promise.all([
        saveBase64Image(baseImage, `characters/${id}`, "base.png"),
        saveBase64Image(sleepImage, `characters/${id}`, "sleep.png"),
      ]);

      const character = await saveCharacter({
        name: characterName.trim(),
        baseImagePath: basePath,
        sleepImagePath: sleepPath,
      });

      setCharacter(character);
      setActions([]);
      setPage("main");
    } catch (e) {
      setError(e instanceof Error ? e.message : "캐릭터 생성에 실패했어요.");
      setStep("input");
    }
  }

  return (
    <div className="relative flex flex-col h-full p-5 gap-4 overflow-hidden">
      {step === "generating" && <LoadingOverlay message={loadingMsg} />}

      {/* 헤더 */}
      <h1 className="text-sm font-bold text-gray-700 text-center pt-1">
        나만의 캐릭터 만들기
      </h1>

      {/* 드래그 영역 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          "w-full h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-sm transition-colors cursor-default",
          isDragging
            ? "border-blue-400 bg-blue-50 text-blue-500"
            : previewUrl
            ? "border-gray-200 bg-gray-50"
            : "border-gray-300 text-gray-400 hover:border-gray-400",
        ].join(" ")}
      >
        {previewUrl ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={previewUrl}
              alt="preview"
              className="max-h-full max-w-full object-contain rounded-xl"
            />
            <button
              onClick={reset}
              className="absolute top-1 right-1 bg-white/80 rounded-full w-5 h-5 text-gray-500 text-xs flex items-center justify-center hover:bg-white shadow"
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <span className="text-2xl mb-1">🖼️</span>
            <span>이미지를 드래그하거나</span>
            <span className="text-xs text-gray-300 mt-0.5">아래 텍스트로만 생성도 가능해요</span>
          </>
        )}
      </div>

      {/* 텍스트 설명 입력 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">
          캐릭터 설명
          <span className="text-gray-400 font-normal ml-1">(선택 · 구체적일수록 더 좋은 캐릭터가 나와요)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder={
            "예시:\n• 잠옷 입은 통통한 고양이\n• 안경 쓰고 커피 드는 곰\n• 후드티 입은 귀여운 햄스터"
          }
          className="border border-gray-200 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-700 placeholder:text-gray-300 leading-relaxed"
        />
      </div>

      {/* 캐릭터 이름 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">
          캐릭터 이름 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={characterName}
          onChange={(e) => setCharacterName(e.target.value)}
          placeholder="도리, 햄찌, 뭉치..."
          maxLength={20}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-700"
        />
      </div>

      {/* 에러 */}
      {error && (
        <p className="text-xs text-red-400 text-center">{error}</p>
      )}

      {/* 생성 버튼 */}
      <button
        onClick={handleCreate}
        disabled={!canCreate || step === "generating"}
        className="mt-auto bg-blue-500 text-white rounded-2xl py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-600 active:bg-blue-700 transition-colors"
      >
        캐릭터 만들기 ✨
      </button>

      <button
        onClick={() => setPage("main")}
        className="text-xs text-gray-300 text-center hover:text-gray-400"
      >
        나중에 하기
      </button>
    </div>
  );
}
