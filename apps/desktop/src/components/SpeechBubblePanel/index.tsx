import { useState } from "react";
import { useCharacterStore } from "@/store/characterStore";
import { updateIdleSpeechBubble } from "@/repository/characterRepository";

interface Props {
  onClose: () => void;
}

export default function SpeechBubblePanel({ onClose }: Props) {
  const character = useCharacterStore((s) => s.character);
  const setCharacter = useCharacterStore((s) => s.setCharacter);
  const [text, setText] = useState(character?.idleSpeechBubble ?? "");

  async function handleSave() {
    if (!character) return;
    await updateIdleSpeechBubble(character.id, text);
    setCharacter({ ...character, idleSpeechBubble: text });
    onClose();
  }

  return (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 z-50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">말풍선 등록</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
      </div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="zzz... 또는 하고 싶은 말"
        maxLength={30}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
        autoFocus
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
      />
      <button
        onClick={handleSave}
        className="mt-2 w-full bg-blue-500 text-white rounded-xl py-1.5 text-xs font-medium hover:bg-blue-600"
      >
        저장
      </button>
    </div>
  );
}
