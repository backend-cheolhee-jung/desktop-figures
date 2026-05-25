// 로컬 SQLite ↔ Auth Server 동기화
// 온라인 상태(회원)일 때 듀얼 라이트, Wi-Fi 재연결 시 updated_at 비교 후 동기화
// TODO: feature/data-sync 에서 구현

export async function syncIfOnline(): Promise<void> {
  // TODO
}

export async function dualWrite<T>(
  localFn: () => Promise<T>,
  serverFn: () => Promise<T>
): Promise<T> {
  const result = await localFn();
  serverFn().catch(() => {
    // 서버 쓰기 실패는 무시 — 다음 동기화 시 재시도
  });
  return result;
}
