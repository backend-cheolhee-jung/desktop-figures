import { useState, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";

export function useGenerationGate() {
  const isApproved = useAuthStore((s) => s.isApproved);
  const [showModal, setShowModal] = useState(false);

  const runGated = useCallback(
    (action: () => void) => {
      // TODO: 로그인 게이트 비활성화
      // if (isApproved()) {
      //   action();
      // } else {
      //   setShowModal(true);
      // }
      action();
    },
    [isApproved]
  );

  return { showModal, setShowModal, runGated };
}
