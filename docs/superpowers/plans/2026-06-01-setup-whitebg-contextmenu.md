# Setup White Screen + Right-Click Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 캐릭터 없을 때 흰 배경 셋업 화면을 보여주고, 메인 위젯에서 우클릭 시 행동 관리·말풍선 등록·캐릭터 삭제 컨텍스트 메뉴를 제공한다.

**Architecture:** `appStore`의 초기 페이지를 `"loading"`으로 바꿔 DB 로드 전 깜박임을 제거한다. 컨텍스트 메뉴는 `Main` 페이지 로컬 상태로 관리하며, 행동 관리·말풍선 등록은 각각 독립된 오버레이 컴포넌트로 구현한다. idle 말풍선 텍스트는 `characters` 테이블에 `idle_speech_bubble` 컬럼을 마이그레이션으로 추가해 저장한다.

**Tech Stack:** React 18, Zustand, Tailwind CSS, @tauri-apps/plugin-sql (SQLite)

---

### Task 0: 브랜치 생성

**Files:** 없음

- [ ] **Step 1: main 기준 새 브랜치 생성**

```bash
git checkout main && git pull && git checkout -b feature/setup-whitebg-contextmenu
```

Expected: `Switched to a new branch 'feature/setup-whitebg-contextmenu'`

---

### Task 1: 초기 페이지 플리커 수정

**Files:**
- Modify: `apps/desktop/src/store/appStore.ts`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: appStore에 "loading" 페이지 타입 추가 및 초기값 변경**

`apps/desktop/src/store/appStore.ts` 전체를 아래로 교체:

```ts
import { create } from "zustand";

export type Page = "loading" | "setup" | "main" | "settings" | "action-panel" | "action-form";

interface AppState {
  currentPage: Page;
  editingActionId: string | null;
  isAlwaysOnTop: boolean;
  setPage: (page: Page) => void;
  openActionForm: (actionId?: string) => void;
  setAlwaysOnTop: (value: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: "loading",
  editingActionId: null,
  isAlwaysOnTop: false,
  setPage: (page) => set({ currentPage: page }),
  openActionForm: (actionId) =>
    set({ currentPage: "action-form", editingActionId: actionId ?? null }),
  setAlwaysOnTop: (value) => set({ isAlwaysOnTop: value }),
}));
```

- [ ] **Step 2: App.tsx에서 loading 상태 처리**

`apps/desktop/src/App.tsx` 전체를 아래로 교체:

```tsx
import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { useCharacterStore } from "@/store/characterStore";
import { useActionStore } from "@/store/actionStore";
import { findFirstCharacter } from "@/repository/characterRepository";
import { findActionsByCharacterId } from "@/repository/actionRepository";
import { useWindowControl } from "@/hooks/useWindowControl";
import SetupPage from "@/pages/Setup";
import MainPage from "@/pages/Main";
import SettingsPage from "@/pages/Settings";
import ActionPanelPage from "@/pages/ActionPanel";
import ActionFormPage from "@/pages/ActionForm";

export default function App() {
  const currentPage = useAppStore((s) => s.currentPage);
  const setPage = useAppStore((s) => s.setPage);
  const setCharacter = useCharacterStore((s) => s.setCharacter);
  const setActions = useActionStore((s) => s.setActions);
  useWindowControl();

  useEffect(() => {
    (async () => {
      try {
        const character = await findFirstCharacter();
        if (!character) {
          setPage("setup");
          return;
        }
        setCharacter(character);
        setActions(await findActionsByCharacterId(character.id));
        setPage("main");
      } catch (e) {
        console.error("DB init error:", e);
        setPage("setup");
      }
    })();
  }, []);

  if (currentPage === "loading") return null;

  const isWidget = currentPage === "main";

  return (
    <div className={`w-full h-screen ${isWidget ? "bg-transparent" : "bg-white rounded-2xl shadow-xl overflow-hidden"}`}>
      {currentPage === "setup" && <SetupPage />}
      {currentPage === "main" && <MainPage />}
      {currentPage === "settings" && <SettingsPage />}
      {currentPage === "action-panel" && <ActionPanelPage />}
      {currentPage === "action-form" && <ActionFormPage />}
    </div>
  );
}
```

- [ ] **Step 3: 타입 체크**

```bash
cd apps/desktop && npx tsc --noEmit
```

Expected: 출력 없음

- [ ] **Step 4: 커밋**

```bash
git add apps/desktop/src/store/appStore.ts apps/desktop/src/App.tsx
git commit -m "fix: start with loading page to prevent main flash when no character"
```

---

### Task 2: idle_speech_bubble DB 컬럼 + Character 타입 + Repository

**Files:**
- Modify: `apps/desktop/src/lib/sqlite.ts`
- Modify: `apps/desktop/src/store/characterStore.ts`
- Modify: `apps/desktop/src/repository/characterRepository.ts`

- [ ] **Step 1: sqlite.ts에 마이그레이션 추가**

`migrateColumns` 함수 마지막 `.catch()` 블록 직전에 아래 줄 추가:

```ts
  await ensure("characters", "idle_speech_bubble", "TEXT");
```

- [ ] **Step 2: Character 타입에 필드 추가**

`apps/desktop/src/store/characterStore.ts`의 `Character` 인터페이스에 추가:

```ts
  idleSpeechBubble?: string;
```

- [ ] **Step 3: characterRepository.ts 수정**

`CharacterRow` 인터페이스에 추가:
```ts
  idle_speech_bubble: string | null;
```

`toCharacter` 함수에 추가:
```ts
    idleSpeechBubble: row.idle_speech_bubble ?? undefined,
```

파일 맨 끝에 함수 추가:
```ts
export async function updateIdleSpeechBubble(id: string, text: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE characters SET idle_speech_bubble = ?, updated_at = ? WHERE id = ?",
    [text, Date.now(), id]
  );
}
```

- [ ] **Step 4: 타입 체크**

```bash
cd apps/desktop && npx tsc --noEmit
```

Expected: 출력 없음

- [ ] **Step 5: 커밋**

```bash
git add apps/desktop/src/lib/sqlite.ts apps/desktop/src/store/characterStore.ts apps/desktop/src/repository/characterRepository.ts
git commit -m "feat: add idle_speech_bubble column to characters table"
```

---

### Task 3: ContextMenu 컴포넌트

**Files:**
- Create: `apps/desktop/src/components/ContextMenu/index.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
import { useEffect, useRef } from "react";

interface Props {
  x: number;
  y: number;
  onClose: () => void;
  onManageActions: () => void;
  onSetSpeechBubble: () => void;
  onDeleteCharacter: () => void;
}

export default function ContextMenu({ x, y, onClose, onManageActions, onSetSpeechBubble, onDeleteCharacter }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left: x, top: y, zIndex: 1000 }}
      className="bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[140px] text-sm"
    >
      <button
        onClick={() => { onManageActions(); onClose(); }}
        className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700"
      >
        📋 행동 관리
      </button>
      <button
        onClick={() => { onSetSpeechBubble(); onClose(); }}
        className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700"
      >
        💬 말풍선 등록
      </button>
      <div className="border-t border-gray-100 my-1" />
      <button
        onClick={() => { onDeleteCharacter(); onClose(); }}
        className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-500"
      >
        🗑 캐릭터 삭제
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd apps/desktop && npx tsc --noEmit
```

Expected: 출력 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/desktop/src/components/ContextMenu/index.tsx
git commit -m "feat: add ContextMenu component"
```

---

### Task 4: ActionListPanel 컴포넌트

**Files:**
- Create: `apps/desktop/src/components/ActionListPanel/index.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
import { useActionStore } from "@/store/actionStore";
import { useAppStore } from "@/store/appStore";
import { deleteAction } from "@/repository/actionRepository";

interface Props {
  onClose: () => void;
}

export default function ActionListPanel({ onClose }: Props) {
  const { actions, setActions } = useActionStore();
  const { openActionForm } = useAppStore();

  async function handleDelete(id: string) {
    await deleteAction(id);
    setActions(actions.filter((a) => a.id !== id));
  }

  function handleAdd() {
    onClose();
    openActionForm();
  }

  return (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">행동 관리</span>
        <div className="flex gap-2">
          <button
            onClick={handleAdd}
            className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center hover:bg-blue-600"
          >
            +
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {actions.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-gray-300">
            등록된 행동이 없어요
          </div>
        ) : (
          actions.map((action) => (
            <div key={action.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50">
              <span className="text-xs flex-1 text-gray-700 truncate">{action.name}</span>
              <span className="text-xs text-gray-300 shrink-0">
                {action.generationStatus === "ready" ? "🧊" : action.generationStatus === "failed" ? "⚠️" : "⏳"}
              </span>
              <button
                onClick={() => handleDelete(action.id)}
                className="text-gray-300 hover:text-red-400 text-xs shrink-0"
              >
                🗑
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd apps/desktop && npx tsc --noEmit
```

Expected: 출력 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/desktop/src/components/ActionListPanel/index.tsx
git commit -m "feat: add ActionListPanel overlay component"
```

---

### Task 5: SpeechBubblePanel 컴포넌트

**Files:**
- Create: `apps/desktop/src/components/SpeechBubblePanel/index.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
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
```

- [ ] **Step 2: 타입 체크**

```bash
cd apps/desktop && npx tsc --noEmit
```

Expected: 출력 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/desktop/src/components/SpeechBubblePanel/index.tsx
git commit -m "feat: add SpeechBubblePanel overlay component"
```

---

### Task 6: 캐릭터 삭제 함수 + Main 페이지 통합

**Files:**
- Modify: `apps/desktop/src/repository/actionRepository.ts`
- Modify: `apps/desktop/src/pages/Main/index.tsx`

- [ ] **Step 1: actionRepository에 deleteActionsByCharacterId 추가**

`apps/desktop/src/repository/actionRepository.ts` 파일 맨 끝에 추가:

```ts
export async function deleteActionsByCharacterId(characterId: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM actions WHERE character_id = ?", [characterId]);
}
```

- [ ] **Step 2: Main 페이지 전체 교체**

`apps/desktop/src/pages/Main/index.tsx` 전체를 아래로 교체:

```tsx
import { useState } from "react";
import { useCharacterStore } from "@/store/characterStore";
import { useActionStore } from "@/store/actionStore";
import { useAppStore } from "@/store/appStore";
import { useWindowControl } from "@/hooks/useWindowControl";
import { useScheduler } from "@/hooks/useScheduler";
import { useJobPoller } from "@/hooks/useJobPoller";
import { deleteCharacter } from "@/repository/characterRepository";
import { deleteActionsByCharacterId } from "@/repository/actionRepository";
import CharacterViewer from "@/components/CharacterViewer";
import ActionTimer from "@/components/ActionTimer";
import ContextMenu from "@/components/ContextMenu";
import ActionListPanel from "@/components/ActionListPanel";
import SpeechBubblePanel from "@/components/SpeechBubblePanel";

type ActivePanel = "actions" | "speech" | null;

export default function MainPage() {
  const character = useCharacterStore((s) => s.character);
  const setCharacter = useCharacterStore((s) => s.setCharacter);
  const { status, currentAction, stopAction, setActions } = useActionStore();
  const { setPage } = useAppStore();
  const { disableAlwaysOnTop, hideWindow } = useWindowControl();

  useScheduler();
  useJobPoller();

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  async function handleStopAction() {
    await disableAlwaysOnTop();
    stopAction();
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setActivePanel(null);
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }

  async function handleDeleteCharacter() {
    if (!character) return;
    const confirmed = window.confirm(`"${character.name}" 캐릭터를 삭제할까요? 이 작업은 되돌릴 수 없어요.`);
    if (!confirmed) return;
    await deleteActionsByCharacterId(character.id);
    await deleteCharacter(character.id);
    setCharacter(null);
    setActions([]);
    setPage("setup");
  }

  const idleSpeech = character?.idleSpeechBubble ?? "zzz...";

  return (
    <div className="relative flex flex-col items-center justify-end h-full pb-4 select-none">
      {/* 상단 버튼 */}
      <div className="absolute top-2 right-2 flex gap-1.5">
        <button
          onClick={hideWindow}
          className="text-gray-400 hover:text-red-400 text-base font-medium"
          title="숨기기"
        >
          ✕
        </button>
      </div>

      {/* 말풍선 */}
      {status === "idle" && (
        <div
          className="mb-2 bg-white rounded-2xl px-3 py-1 text-sm shadow-sm text-gray-500 border border-gray-100 cursor-context-menu"
          onContextMenu={handleContextMenu}
        >
          {idleSpeech}
        </div>
      )}
      {status === "active" && currentAction?.speechBubble && (
        <div
          className="mb-2 bg-white rounded-2xl px-3 py-1 text-sm shadow-sm text-gray-700 border border-gray-100 flex items-center gap-1 cursor-context-menu"
          onContextMenu={handleContextMenu}
        >
          <span className="truncate max-w-[140px]">{currentAction.speechBubble}</span>
        </div>
      )}

      {/* 캐릭터 3D 뷰어 + 오버레이 패널 */}
      <div
        className="relative w-32 h-32 flex items-center justify-center cursor-context-menu"
        onContextMenu={handleContextMenu}
      >
        {character ? (
          <CharacterViewer
            character={character}
            currentAction={currentAction}
            status={status}
          />
        ) : (
          <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center text-3xl">
            🐾
          </div>
        )}

        {activePanel === "actions" && (
          <ActionListPanel onClose={() => setActivePanel(null)} />
        )}
        {activePanel === "speech" && (
          <SpeechBubblePanel onClose={() => setActivePanel(null)} />
        )}
      </div>

      {/* 캐릭터 이름 */}
      {character && (
        <p className="mt-1 text-xs text-gray-400">{character.name}</p>
      )}

      {/* 행동 중 — 타이머 + 종료 버튼 */}
      {status === "active" && currentAction && (
        <div className="mt-2 flex items-center gap-2">
          <ActionTimer
            actionName={currentAction.name}
            endTime={useActionStore.getState().actionEndTime ?? 0}
            onEnd={handleStopAction}
          />
          <button
            onClick={handleStopAction}
            className="text-xs text-gray-400 hover:text-red-400"
            title="행동 종료"
          >
            ■
          </button>
        </div>
      )}

      {/* 컨텍스트 메뉴 */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onManageActions={() => setActivePanel("actions")}
          onSetSpeechBubble={() => setActivePanel("speech")}
          onDeleteCharacter={handleDeleteCharacter}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: 타입 체크**

```bash
cd apps/desktop && npx tsc --noEmit
```

Expected: 출력 없음

- [ ] **Step 4: 커밋**

```bash
git add apps/desktop/src/repository/actionRepository.ts apps/desktop/src/pages/Main/index.tsx
git commit -m "feat: right-click context menu with action management, speech bubble, character delete"
```

---

### Task 7: 브랜치 생성 및 PR

- [ ] **Step 1: 현재까지 커밋 확인**

```bash
git log --oneline main..HEAD
```

Expected: Task 1~6의 커밋 6개

- [ ] **Step 2: 원격 Push**

```bash
git push -u origin feature/setup-whitebg-contextmenu
```

- [ ] **Step 3: PR 생성**

```bash
gh pr create \
  --title "feat: setup white screen + right-click context menu" \
  --body "$(cat <<'EOF'
## Summary

- 캐릭터 없을 때 투명 위젯 대신 흰 배경 셋업 화면 표시 (loading 초기 상태 추가)
- 캐릭터/말풍선 우클릭 → 컨텍스트 메뉴 (행동 관리, 말풍선 등록, 캐릭터 삭제)
- 행동 관리: 행동 목록 오버레이 (삭제 + 추가)
- 말풍선 등록: idle 상태 말풍선 텍스트 커스터마이징 (DB 저장)
- 캐릭터 삭제: 확인 후 캐릭터+행동 전체 삭제 → 셋업 화면으로 이동

## Test Plan

- [ ] 앱 첫 실행(캐릭터 없음) → 흰 배경 셋업 화면 표시 확인
- [ ] 캐릭터/말풍선 우클릭 → 컨텍스트 메뉴 3개 항목 확인
- [ ] 행동 관리 → 행동 목록 표시, 삭제 동작, 추가 이동
- [ ] 말풍선 등록 → 텍스트 저장 후 idle 말풍선 반영
- [ ] 캐릭터 삭제 → 확인 후 셋업 화면 이동
EOF
)"
```
