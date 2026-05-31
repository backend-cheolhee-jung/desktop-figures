import { useState } from "react";
import { useAppStore } from "@/store/appStore";
import { useCharacterStore } from "@/store/characterStore";
import { useActionStore } from "@/store/actionStore";
import { useDragDrop } from "@/hooks/useDragDrop";
import { createTextModel, createImageModel } from "@/lib/meshy";
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

  const canCreate = characterName.trim() && description.trim();

  async function handleCreate() {
    if (!canCreate) return;
    setStep("generating");
    setError(null);

    try {
      setLoadingMsg("AI에게 3D 캐릭터 생성을 요청하는 중...");

      let taskId: string;
      let taskType: "text" | "image";
      if (base64) {
        taskId = await createImageModel(`data:image/png;base64,${base64}`);
        taskType = "image";
      } else {
        taskId = await createTextModel(description.trim());
        taskType = "text";
      }

      const character = await saveCharacter({
        name: characterName.trim(),
        modelTaskType: taskType,
        generationStatus: "pending",
        meshyTaskId: taskId,
      });

      setCharacter(character);
      setActions([]);
      setPage("main");
    } catch (e) {
      setError(e instanceof Error ? e.message : "캐릭터 생성 요청에 실패했어요.");
      setStep("input");
    }
  }

  return (
    <div className="relative flex flex-col h-full p-5 gap-4 overflow-hidden">
      {step === "generating" && <LoadingOverlay message={loadingMsg} />}

      <h1 className="text-sm font-bold text-gray-700 text-center pt-1">
        나만의 캐릭터 만들기
      </h1>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">
          캐릭터 설명 <span className="text-red-400">*</span>
          <span className="text-gray-400 font-normal ml-1">(구체적일수록 더 좋아요)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder={"예시:\n• 잠옷 입은 통통한 고양이\n• 안경 쓰고 커피 드는 곰\n• 후드티 입은 귀여운 햄스터"}
          className="border border-gray-200 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-700 placeholder:text-gray-300 leading-relaxed"
        />
      </div>

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

      {error && <p className="text-xs text-red-400 text-center">{error}</p>}

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
