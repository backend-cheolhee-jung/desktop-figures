import { useEffect, useRef } from "react";
import { useActionStore } from "@/store/actionStore";
import { useWindowControl } from "@/hooks/useWindowControl";
import { findScheduledActions } from "@/repository/actionRepository";

const CHECK_INTERVAL_MS = 30_000; // 30초마다 체크

export function useScheduler() {
  const { startAction, status } = useActionStore();
  const { enableAlwaysOnTop } = useWindowControl();
  const lastChecked = useRef<number>(0);

  useEffect(() => {
    async function check() {
      if (status === "active") return;

      const now = Date.now();
      // 마지막 체크 시점부터 현재까지 예약된 행동 검색
      const actions = await findScheduledActions(lastChecked.current, now).catch(() => []);
      lastChecked.current = now;

      if (actions.length === 0) return;

      const action = actions[0];
      if (!action.durationMinutes) return;

      const endTime = (action.scheduledAt ?? now) + action.durationMinutes * 60_000;
      await enableAlwaysOnTop();
      startAction(action, endTime);
    }

    // 앱 시작 직후 한 번 체크
    lastChecked.current = Date.now() - CHECK_INTERVAL_MS;
    check();

    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [status]);
}
