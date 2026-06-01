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

      <p className="text-xs text-gray-400 text-center mt-8">
        설정 기능 준비 중이에요.
      </p>
    </div>
  );
}
