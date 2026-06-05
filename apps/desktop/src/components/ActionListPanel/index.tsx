import { useActionStore } from "@/store/actionStore";
import { useAppStore } from "@/store/appStore";
import { deleteAction } from "@/repository/actionRepository";

interface Props {
  onClose: () => void;
}

export default function ActionListPanel({ onClose }: Props) {
  const { actions, setActions } = useActionStore();
  const { openActionForm } = useAppStore();

  async function handleDelete(id: string) {
    await deleteAction(id);
    setActions(actions.filter((a) => a.id !== id));
  }

  function handleAdd() {
    onClose();
    openActionForm();
  }

  return (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">일정 관리</span>
        <div className="flex gap-2">
          <button
            onClick={handleAdd}
            className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center hover:bg-blue-600"
          >
            +
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {actions.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-gray-300">
            등록된 행동이 없어요
          </div>
        ) : (
          actions.map((action) => (
            <div key={action.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50">
              <span className="text-xs flex-1 text-gray-700 truncate">{action.name}</span>
              <span className="text-xs text-gray-300 shrink-0">
                {action.generationStatus === "ready" ? "🧊" : action.generationStatus === "failed" ? "⚠️" : "⏳"}
              </span>
              <button
                onClick={() => handleDelete(action.id)}
                className="text-gray-300 hover:text-red-400 text-xs shrink-0"
              >
                🗑
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
