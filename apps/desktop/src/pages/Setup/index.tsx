// 첫 실행 시 캐릭터 생성 페이지
// 이미지 드래그 앤 드롭 → Vertex AI 요청 → 캐릭터 저장
// TODO: feature/character-creation 에서 구현

import { useAppStore } from "@/store/appStore";

export default function SetupPage() {
  const setPage = useAppStore((s) => s.setPage);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-6">
      <p className="text-lg font-semibold text-gray-700">
        나만의 캐릭터를 만들어보세요
      </p>
      <div className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center text-gray-400 text-sm">
        이미지를 드래그하세요
      </div>
      <button
        className="text-xs text-gray-400 underline"
        onClick={() => setPage("main")}
      >
        나중에 하기
      </button>
    </div>
  );
}
