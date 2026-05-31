import { useState, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";

export function useGenerationGate() {
  const isApproved = useAuthStore((s) => s.isApproved);
  const [showModal, setShowModal] = useState(false);

  const runGated = useCallback(
    (action: () => void) => {
      if (isApproved()) {
        action();
      } else {
        setShowModal(true);
      }
    },
    [isApproved]
  );

  return { showModal, setShowModal, runGated };
}
