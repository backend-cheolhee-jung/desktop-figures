import { useState } from "react";
import { login, register, fetchMe, NotApprovedError } from "@/lib/authApi";
import { useAuthStore } from "@/store/authStore";

interface Props {
  onClose: () => void;
  onApproved: () => void;
}

type Tab = "login" | "register";

export default function AuthModal({ onClose, onApproved }: Props) {
  const setSession = useAuthStore((s) => s.setSession);
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const tokens = await login(email.trim(), password);
      const me = await fetchMe(tokens.accessToken);
      setSession(tokens.accessToken, tokens.refreshToken, me);
      onApproved();
    } catch (e) {
      if (e instanceof NotApprovedError) {
        setInfo(
          e.status === "PENDING"
            ? "운영자 승인 대기 중이에요. 승인 후 이용할 수 있어요."
            : `가입이 거절되었어요${e.rejectReason ? `: ${e.rejectReason}` : ""}.`
        );
      } else {
        setError(e instanceof Error ? e.message : "로그인 실패");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await register(email.trim(), password, nickname.trim());
      setInfo("가입 신청 완료! 운영자 승인 후 로그인할 수 있어요.");
      setTab("login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "가입 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-5 w-72 flex flex-col gap-3 shadow-xl">
        {/* 탭 헤더 */}
        <div className="flex items-center gap-2 text-sm font-semibold">
          <button
            onClick={() => setTab("login")}
            className={tab === "login" ? "text-blue-500" : "text-gray-400"}
          >
            로그인
          </button>
          <button
            onClick={() => setTab("register")}
            className={tab === "register" ? "text-blue-500" : "text-gray-400"}
          >
            가입
          </button>
          <button
            onClick={onClose}
            className="ml-auto text-gray-300 hover:text-gray-500"
          >
            ✕
          </button>
        </div>

        {/* 입력 필드 */}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="비밀번호 (8자 이상)"
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        {tab === "register" && (
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        )}

        {/* 안내 / 에러 */}
        {info && <p className="text-xs text-blue-500">{info}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* 액션 버튼 */}
        <button
          onClick={tab === "login" ? handleLogin : handleRegister}
          disabled={busy}
          className="bg-blue-500 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-40 hover:bg-blue-600 transition-colors"
        >
          {tab === "login" ? "로그인" : "가입 신청"}
        </button>
      </div>
    </div>
  );
}
