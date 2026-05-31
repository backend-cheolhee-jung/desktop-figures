import { useActionStore } from "@/store/actionStore";
import { useAppStore } from "@/store/appStore";
import { deleteAction } from "@/repository/actionRepository";
import { useImageUrl } from "@/hooks/useImageUrl";
import type { Action } from "@/store/actionStore";

function ActionImage({ path, name }: { path: string; name: string }) {
  const url = useImageUrl(path);
  return url
    ? <img src={url} alt={name} className="w-10 h-10 object-contain rounded-xl bg-white" />
    : <div className="w-10 h-10 rounded-xl bg-gray-100" />;
}

export default function ActionPanelPage() {
  const { actions, setActions } = useActionStore();
  const { setPage, openActionForm } = useAppStore();

  async function handleDelete(id: string) {
    await deleteAction(id);
    setActions(actions.filter((a) => a.id !== id));
  }

  function formatSchedule(scheduledAt?: number, durationMinutes?: number) {
    if (!scheduledAt) return null;
    const d = new Date(scheduledAt);
    const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return durationMinutes ? `${hhmm} · ${durationMinutes}분` : hhmm;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={() => setPage("main")} className="text-gray-400 hover:text-gray-600">←</button>
        <h2 className="text-sm font-bold text-gray-700">행동 관리</h2>
        <button onClick={() => openActionForm()} className="w-6 h-6 rounded-full bg-blue-500 text-white text-lg flex items-center justify-center hover:bg-blue-600" title="행동 추가">+</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-2">
        {actions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-300">
            <span className="text-3xl">📋</span>
            <p className="text-xs">아직 등록된 행동이 없어요</p>
            <button onClick={() => openActionForm()} className="mt-2 text-xs text-blue-400 underline">첫 번째 행동 만들기</button>
          </div>
        ) : (
          actions.map((action: Action) => (
            <div key={action.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-3 py-2.5">
              <ActionImage path={action.actionImagePath} name={action.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{action.name}</p>
                {action.speechBubble && <p className="text-xs text-gray-400 truncate">"{action.speechBubble}"</p>}
                {formatSchedule(action.scheduledAt, action.durationMinutes) && (
                  <p className="text-xs text-blue-400">🕐 {formatSchedule(action.scheduledAt, action.durationMinutes)}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openActionForm(action.id)} className="text-xs text-gray-400 hover:text-blue-500 px-1">✏️</button>
                <button onClick={() => handleDelete(action.id)} className="text-xs text-gray-400 hover:text-red-400 px-1">🗑</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
