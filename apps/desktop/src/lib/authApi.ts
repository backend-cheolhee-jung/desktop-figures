const BASE = import.meta.env.VITE_AUTH_SERVER_URL ?? "http://localhost:8080";

export type UserStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Me {
  userId: string;
  email: string;
  nickname: string;
  status: UserStatus;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}

export class NotApprovedError extends Error {
  constructor(public status: UserStatus, public rejectReason?: string) {
    super("not approved");
  }
}

export async function register(email: string, password: string, nickname: string): Promise<void> {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, nickname }),
  });
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))).message ?? `가입 실패 (${res.status})`;
    throw new Error(msg);
  }
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    throw new NotApprovedError(body.status as UserStatus, body.rejectReason ?? undefined);
  }
  if (!res.ok) throw new Error(`로그인 실패 (${res.status})`);
  return (await res.json()) as LoginResult;
}

export async function fetchMe(accessToken: string): Promise<Me> {
  const res = await fetch(`${BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`프로필 조회 실패 (${res.status})`);
  return (await res.json()) as Me;
}
