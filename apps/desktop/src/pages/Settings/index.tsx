// 설정 화면 — Vertex AI 토큰, 계정 연결
// TODO: feature/settings 에서 완성

import { useAppStore } from "@/store/appStore";

export default function SettingsPage() {
  const setPage = useAppStore((s) => s.setPage);

  return (
    <div className="flex flex-col h-full p-5 gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage("main")}
          className="text-gray-400 hover:text-gray-600"
        >
          ←
        </button>
        <h2 className="text-sm font-semibold text-gray-700">설정</h2>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Vertex AI 토큰</label>
        <input
          type="password"
          placeholder="토큰을 입력하세요"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      <button className="mt-auto bg-blue-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-blue-600 transition-colors">
        저장
      </button>
    </div>
  );
}
