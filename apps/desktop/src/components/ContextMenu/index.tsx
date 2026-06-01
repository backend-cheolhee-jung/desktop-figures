import { useEffect, useRef } from "react";

interface Props {
  x: number;
  y: number;
  onClose: () => void;
  onManageActions: () => void;
  onSetSpeechBubble: () => void;
  onDeleteCharacter: () => void;
}

export default function ContextMenu({ x, y, onClose, onManageActions, onSetSpeechBubble, onDeleteCharacter }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left: x, top: y, zIndex: 1000 }}
      className="bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[140px] text-sm"
    >
      <button
        onClick={() => { onManageActions(); onClose(); }}
        className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700"
      >
        📋 행동 관리
      </button>
      <button
        onClick={() => { onSetSpeechBubble(); onClose(); }}
        className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700"
      >
        💬 말풍선 등록
      </button>
      <div className="border-t border-gray-100 my-1" />
      <button
        onClick={() => { onDeleteCharacter(); onClose(); }}
        className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-500"
      >
        🗑 캐릭터 삭제
      </button>
    </div>
  );
}
