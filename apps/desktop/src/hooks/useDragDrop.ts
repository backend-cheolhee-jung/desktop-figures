import { useState, useCallback } from "react";
import { fileToBase64 } from "@/lib/imageUtils";

interface DragDropState {
  isDragging: boolean;
  previewUrl: string | null;
  base64: string | null;
}

export function useDragDrop() {
  const [state, setState] = useState<DragDropState>({
    isDragging: false,
    previewUrl: null,
    base64: null,
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState((s) => ({ ...s, isDragging: true }));
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState((s) => ({ ...s, isDragging: false }));
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setState((s) => ({ ...s, isDragging: false }));

    const file = e.dataTransfer.files[0];
    if (!file?.type.startsWith("image/")) return;

    const base64 = await fileToBase64(file);
    const previewUrl = URL.createObjectURL(file);
    setState({ isDragging: false, previewUrl, base64 });
  }, []);

  const reset = useCallback(() => {
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    setState({ isDragging: false, previewUrl: null, base64: null });
  }, [state.previewUrl]);

  return {
    isDragging: state.isDragging,
    previewUrl: state.previewUrl,
    base64: state.base64,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    reset,
  };
}
