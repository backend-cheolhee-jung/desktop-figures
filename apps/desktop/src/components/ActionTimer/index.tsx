import { useState, useEffect } from "react";

interface Props {
  actionName: string;
  endTime: number;
  onEnd: () => void;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export default function ActionTimer({ actionName, endTime, onEnd }: Props) {
  const [remaining, setRemaining] = useState(() => endTime - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const r = endTime - Date.now();
      setRemaining(r);
      if (r <= 0) {
        clearInterval(id);
        onEnd();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  return (
    <div className="flex items-center gap-1.5 bg-gray-800/80 rounded-full px-3 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
      <span className="text-white text-xs font-mono">{formatRemaining(remaining)}</span>
      <span className="text-gray-400 text-xs truncate max-w-[60px]">{actionName}</span>
    </div>
  );
}
