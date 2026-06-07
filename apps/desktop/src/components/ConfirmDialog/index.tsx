import { createPortal } from "react-dom";

interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ message, onConfirm, onCancel }: Props) {
  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-auto">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl px-6 py-5 w-64 flex flex-col gap-4">
        <p className="text-sm text-gray-700 text-center leading-relaxed">{message}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            아니요
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl text-sm text-white bg-red-400 hover:bg-red-500 transition-colors"
          >
            예
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
