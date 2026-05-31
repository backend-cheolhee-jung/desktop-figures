# 3D 애니메이션 캐릭터 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 데스크탑 캐릭터를 Vertex AI Imagen 2D PNG에서 Meshy.ai 3D GLB + React Three Fiber 렌더링으로 전환한다.

**Architecture:** Meshy.ai API가 텍스트/이미지를 3D 모델로, 행동 이름을 애니메이션 클립으로 생성한다. 생성은 5~10분 걸리므로 task ID를 DB에 `pending`으로 저장하고 `useJobPoller`가 15초 간격으로 폴링하여 완료 시 GLB를 로컬에 저장한다. 화면에서는 `CharacterViewer`가 상태(idle/active)에 따라 GLB 파일을 교체하며 내장 애니메이션을 재생한다.

**Tech Stack:** Tauri 2, React 18, TypeScript, Zustand, SQLite, three.js, @react-three/fiber, @react-three/drei, Meshy.ai API

**스펙:** `docs/superpowers/specs/2026-05-31-3d-character-design.md`

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/lib/meshy.ts` | Meshy.ai REST 래퍼 (생성 요청 + 폴링). llm.ts 대체 |
| `src/lib/glbUtils.ts` | GLB 다운로드 → AppData 저장 + 표시 URL 변환 |
| `src/components/CharacterViewer/index.tsx` | R3F Canvas, GLB 로드 + 애니메이션 재생 |
| `src/hooks/useJobPoller.ts` | pending 잡 폴링, 완료 시 DB/store 업데이트, 후속 잡 트리거 |
| `src/lib/sqlite.ts` | 스키마 마이그레이션 (ALTER TABLE) |
| `src/store/characterStore.ts` | Character 타입: image paths → model/anim paths + 상태 |
| `src/store/actionStore.ts` | Action 타입: image path → animation path + 상태 |
| `src/repository/characterRepository.ts` | characters 컬럼 변경 + 상태 업데이트 함수 |
| `src/repository/actionRepository.ts` | actions 컬럼 변경 + 상태 업데이트 함수 |
| `src/pages/Setup/index.tsx` | Meshy.ai 연동, 비블로킹 생성 |
| `src/pages/ActionForm/index.tsx` | Meshy.ai 연동, 비블로킹 생성 |
| `src/pages/ActionPanel/index.tsx` | 행동 목록 — 3D 썸네일/상태 표시 |
| `src/pages/Main/index.tsx` | `<img>` → `<CharacterViewer>` |
| `src/lib/llm.ts` | 삭제 |

---

## Task 1: 패키지 설치

**Files:**
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: three.js + R3F 설치**

Run:
```bash
cd apps/desktop && npm install three@^0.169.0 @react-three/fiber@^8.17.0 @react-three/drei@^9.114.0 && npm install -D @types/three@^0.169.0
```
Expected: package.json dependencies에 추가됨, 에러 없음

- [ ] **Step 2: 설치 확인**

Run: `cd apps/desktop && npm ls three @react-three/fiber @react-three/drei`
Expected: 세 패키지 버전이 출력됨

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/package.json apps/desktop/package-lock.json
git commit -m "chore: add three.js and react-three-fiber"
```

---

## Task 2: DB 스키마 마이그레이션

**Files:**
- Modify: `apps/desktop/src/lib/sqlite.ts`

기존 `CREATE TABLE IF NOT EXISTS`는 유지하되 (신규 설치 대비), 기존 DB를 위해 `ALTER TABLE`로 컬럼을 추가한다. SQLite는 `ADD COLUMN IF NOT EXISTS`를 지원하지 않으므로 `PRAGMA table_info`로 존재 여부를 확인 후 추가하는 헬퍼를 쓴다.

- [ ] **Step 1: initSchema의 CREATE TABLE 문을 새 스키마로 교체**

`characters` CREATE 문을 아래로 교체:
```sql
CREATE TABLE IF NOT EXISTS characters (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  model_path          TEXT,
  model_remote_url    TEXT,
  model_task_type     TEXT NOT NULL DEFAULT 'text',
  idle_anim_path      TEXT,
  sleep_anim_path     TEXT,
  generation_status   TEXT NOT NULL DEFAULT 'pending',
  meshy_task_id       TEXT,
  idle_meshy_task_id  TEXT,
  sleep_meshy_task_id TEXT,
  server_id           TEXT,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  synced_at           INTEGER
)
```

`actions` CREATE 문을 아래로 교체 (음성/스케줄 컬럼은 유지, image_path만 변경):
```sql
CREATE TABLE IF NOT EXISTS actions (
  id                TEXT PRIMARY KEY,
  character_id      TEXT NOT NULL REFERENCES characters(id),
  name              TEXT NOT NULL,
  animation_path    TEXT,
  generation_status TEXT NOT NULL DEFAULT 'pending',
  meshy_task_id     TEXT,
  speech_bubble     TEXT,
  voice_file_path   TEXT,
  voice_loop_start  INTEGER,
  voice_loop_end    INTEGER,
  scheduled_at      INTEGER,
  duration_minutes  INTEGER,
  server_id         TEXT,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  synced_at         INTEGER
)
```

- [ ] **Step 2: 마이그레이션 헬퍼 추가 (기존 DB용)**

`initSchema` 함수 끝에, CREATE 문들 다음에 추가:
```typescript
  await migrateColumns(db);
}

async function migrateColumns(db: Database): Promise<void> {
  const ensure = async (
    table: string,
    column: string,
    definition: string
  ): Promise<void> => {
    const cols = await db.select<{ name: string }[]>(
      `PRAGMA table_info(${table})`
    );
    if (!cols.some((c) => c.name === column)) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  // 기존 2D 캐릭터 데이터는 재생성 유도를 위해 failed로 표시
  await ensure("characters", "model_path", "TEXT");
  await ensure("characters", "model_remote_url", "TEXT");
  await ensure("characters", "model_task_type", "TEXT NOT NULL DEFAULT 'text'");
  await ensure("characters", "idle_anim_path", "TEXT");
  await ensure("characters", "sleep_anim_path", "TEXT");
  await ensure("characters", "generation_status", "TEXT NOT NULL DEFAULT 'pending'");
  await ensure("characters", "meshy_task_id", "TEXT");
  await ensure("characters", "idle_meshy_task_id", "TEXT");
  await ensure("characters", "sleep_meshy_task_id", "TEXT");

  await ensure("actions", "animation_path", "TEXT");
  await ensure("actions", "generation_status", "TEXT NOT NULL DEFAULT 'pending'");
  await ensure("actions", "meshy_task_id", "TEXT");

  // 기존 2D 레코드(model_path NULL이지만 status가 기본 pending) → failed 처리
  await db.execute(
    `UPDATE characters SET generation_status = 'failed'
     WHERE model_path IS NULL AND base_image_path IS NOT NULL`
  ).catch(() => {});
  await db.execute(
    `UPDATE actions SET generation_status = 'failed'
     WHERE animation_path IS NULL AND action_image_path IS NOT NULL`
  ).catch(() => {});
}
```

참고: `base_image_path` / `action_image_path`는 구 DB에만 존재하므로 UPDATE는 `.catch(() => {})`로 신규 DB에서의 실패를 무시한다.

- [ ] **Step 3: 타입 빌드 확인**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: sqlite.ts 관련 에러 없음 (다른 파일은 후속 Task에서 수정하므로 에러 있을 수 있음 — sqlite.ts 줄 번호 에러만 없으면 OK)

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/lib/sqlite.ts
git commit -m "feat: migrate DB schema to 3D model columns"
```

---

## Task 3: Meshy.ai API 래퍼

**Files:**
- Create: `apps/desktop/src/lib/meshy.ts`
- Delete: `apps/desktop/src/lib/llm.ts`
- Modify: `apps/desktop/.env.example`

Meshy.ai API 참고:
- `POST https://api.meshy.ai/openapi/v2/text-to-3d` (mode: "preview") → `{ result: taskId }`
- `POST https://api.meshy.ai/openapi/v1/image-to-3d` → `{ result: taskId }`
- `POST https://api.meshy.ai/openapi/v1/animations` (model 입력 + action) → `{ result: taskId }`
- `GET .../{endpoint}/{taskId}` → `{ status, model_urls: { glb }, ... }` status: PENDING|IN_PROGRESS|SUCCEEDED|FAILED

- [ ] **Step 1: meshy.ts 작성**

```typescript
// Meshy.ai 3D 생성 API 래퍼
// 호출 케이스: 캐릭터 모델 생성, 애니메이션(idle/sleep/행동) 생성

const BASE = "https://api.meshy.ai/openapi";

export type MeshyTaskType = "text" | "image" | "animation";

export interface MeshyResult {
  status: "pending" | "succeeded" | "failed";
  glbUrl?: string;
}

function authHeaders(): Record<string, string> {
  const key = import.meta.env.VITE_MESHY_API_KEY;
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

// 케이스 1: 텍스트로 캐릭터 모델 생성
export async function createTextModel(prompt: string): Promise<string> {
  const res = await fetch(`${BASE}/v2/text-to-3d`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      mode: "preview",
      prompt: `${prompt}, cute chubby 3D clay style character, full body`,
      art_style: "sculpture",
      should_remesh: true,
    }),
  });
  if (!res.ok) throw new Error(`Meshy text-to-3d ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.result as string;
}

// 케이스 2: 이미지로 캐릭터 모델 생성
// imageDataUrl: "data:image/png;base64,..." 형식
export async function createImageModel(imageDataUrl: string): Promise<string> {
  const res = await fetch(`${BASE}/v1/image-to-3d`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      image_url: imageDataUrl,
      should_remesh: true,
    }),
  });
  if (!res.ok) throw new Error(`Meshy image-to-3d ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.result as string;
}

// 케이스 3: 애니메이션 생성 (모델 URL + 동작 설명)
export async function createAnimation(
  modelUrl: string,
  actionPrompt: string
): Promise<string> {
  const res = await fetch(`${BASE}/v1/animations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model_url: modelUrl,
      prompt: actionPrompt,
    }),
  });
  if (!res.ok) throw new Error(`Meshy animations ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.result as string;
}

// 폴링: taskType에 따라 엔드포인트 분기
export async function pollTask(
  taskId: string,
  taskType: MeshyTaskType
): Promise<MeshyResult> {
  const endpoint =
    taskType === "text"
      ? `v2/text-to-3d/${taskId}`
      : taskType === "image"
      ? `v1/image-to-3d/${taskId}`
      : `v1/animations/${taskId}`;

  const res = await fetch(`${BASE}/${endpoint}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Meshy poll ${res.status}: ${await res.text()}`);
  const data = await res.json();

  const raw = String(data.status).toUpperCase();
  if (raw === "SUCCEEDED") {
    return { status: "succeeded", glbUrl: data.model_urls?.glb };
  }
  if (raw === "FAILED") {
    return { status: "failed" };
  }
  return { status: "pending" };
}

// idle/sleep 표준 애니메이션 프롬프트
export const IDLE_PROMPT = "gentle idle breathing, standing still";
export const SLEEP_PROMPT = "sleeping, lying down, eyes closed, calm breathing";

export function actionPromptFor(actionName: string): string {
  return `character ${actionName}, looping motion`;
}
```

- [ ] **Step 2: llm.ts 삭제**

Run: `rm apps/desktop/src/lib/llm.ts`

- [ ] **Step 3: .env.example 업데이트**

`apps/desktop/.env.example`를 읽고 `VITE_VERTEX_*` 줄들을 제거, 아래 추가:
```
VITE_MESHY_API_KEY=your_meshy_api_key_here
```

- [ ] **Step 4: 타입 확인**

Run: `cd apps/desktop && npx tsc --noEmit 2>&1 | grep meshy.ts`
Expected: meshy.ts 관련 에러 없음 (빈 출력)

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/lib/meshy.ts apps/desktop/.env.example
git rm apps/desktop/src/lib/llm.ts
git commit -m "feat: add Meshy.ai 3D generation wrapper, remove Vertex AI llm"
```

---

## Task 4: glbUtils — GLB 다운로드/저장

**Files:**
- Create: `apps/desktop/src/lib/glbUtils.ts`

`imageUtils.ts`의 `saveBase64Image` / `toDisplayUrl` 패턴을 따른다.

- [ ] **Step 1: glbUtils.ts 작성**

```typescript
import { BaseDirectory, mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";

// 원격 GLB URL → AppData에 다운로드 후 로컬 상대경로 반환
export async function downloadGlb(
  url: string,
  subDir: string,
  filename: string
): Promise<string> {
  await mkdir(subDir, { baseDir: BaseDirectory.AppData, recursive: true });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`GLB download failed ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());

  const relativePath = `${subDir}/${filename}`;
  await writeFile(relativePath, bytes, { baseDir: BaseDirectory.AppData });
  return relativePath;
}

// 로컬 상대경로 → webview에서 로드 가능한 절대 URL
export function toGlbUrl(relativePath: string): string {
  return convertFileSrc(relativePath);
}
```

- [ ] **Step 2: 타입 확인**

Run: `cd apps/desktop && npx tsc --noEmit 2>&1 | grep glbUtils.ts`
Expected: 빈 출력

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/glbUtils.ts
git commit -m "feat: add GLB download/url helpers"
```

---

## Task 5: characterStore 타입 변경

**Files:**
- Modify: `apps/desktop/src/store/characterStore.ts`

- [ ] **Step 1: Character 인터페이스 교체**

```typescript
import { create } from "zustand";

export type GenerationStatus = "pending" | "ready" | "failed";
export type ModelTaskType = "text" | "image";

export interface Character {
  id: string;
  name: string;
  modelPath?: string;
  modelRemoteUrl?: string;
  modelTaskType: ModelTaskType;
  idleAnimPath?: string;
  sleepAnimPath?: string;
  generationStatus: GenerationStatus;
  meshyTaskId?: string;
  idleMeshyTaskId?: string;
  sleepMeshyTaskId?: string;
  serverId?: string;
  createdAt: number;
  updatedAt: number;
  syncedAt?: number;
}

interface CharacterState {
  character: Character | null;
  isLoading: boolean;
  setCharacter: (character: Character | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useCharacterStore = create<CharacterState>((set) => ({
  character: null,
  isLoading: false,
  setCharacter: (character) => set({ character }),
  setLoading: (isLoading) => set({ isLoading }),
}));
```

- [ ] **Step 2: Commit** (Task 6와 함께 타입이 맞물리므로 repo 수정 후 컴파일)

```bash
git add apps/desktop/src/store/characterStore.ts
git commit -m "feat: update Character type for 3D model"
```

---

## Task 6: actionStore 타입 변경

**Files:**
- Modify: `apps/desktop/src/store/actionStore.ts`

- [ ] **Step 1: Action 인터페이스 교체**

`actionImagePath: string` → `animationPath?: string` 변경, 상태 필드 추가. `GenerationStatus`는 characterStore에서 import.

```typescript
import { create } from "zustand";
import type { GenerationStatus } from "@/store/characterStore";

export type WidgetStatus = "idle" | "active";

export interface Action {
  id: string;
  characterId: string;
  name: string;
  animationPath?: string;
  generationStatus: GenerationStatus;
  meshyTaskId?: string;
  speechBubble?: string;
  voiceFilePath?: string;
  voiceLoopStart?: number;
  voiceLoopEnd?: number;
  scheduledAt?: number;
  durationMinutes?: number;
  createdAt: number;
  updatedAt: number;
  syncedAt?: number;
}
```

나머지 ActionState 인터페이스와 store 구현(`setActions`, `addAction`, `startAction`, `stopAction`, `updateSpeechBubble`)은 그대로 유지.

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/store/actionStore.ts
git commit -m "feat: update Action type for 3D animation"
```

---

## Task 7: characterRepository 컬럼 변경

**Files:**
- Modify: `apps/desktop/src/repository/characterRepository.ts`

- [ ] **Step 1: Row 인터페이스 + toCharacter 교체**

```typescript
import { getDb } from "@/lib/sqlite";
import { Character, GenerationStatus, ModelTaskType } from "@/store/characterStore";

interface CharacterRow {
  id: string;
  name: string;
  model_path: string | null;
  model_remote_url: string | null;
  model_task_type: string;
  idle_anim_path: string | null;
  sleep_anim_path: string | null;
  generation_status: string;
  meshy_task_id: string | null;
  idle_meshy_task_id: string | null;
  sleep_meshy_task_id: string | null;
  server_id: string | null;
  created_at: number;
  updated_at: number;
  synced_at: number | null;
}

function toCharacter(row: CharacterRow): Character {
  return {
    id: row.id,
    name: row.name,
    modelPath: row.model_path ?? undefined,
    modelRemoteUrl: row.model_remote_url ?? undefined,
    modelTaskType: row.model_task_type as ModelTaskType,
    idleAnimPath: row.idle_anim_path ?? undefined,
    sleepAnimPath: row.sleep_anim_path ?? undefined,
    generationStatus: row.generation_status as GenerationStatus,
    meshyTaskId: row.meshy_task_id ?? undefined,
    idleMeshyTaskId: row.idle_meshy_task_id ?? undefined,
    sleepMeshyTaskId: row.sleep_meshy_task_id ?? undefined,
    serverId: row.server_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt: row.synced_at ?? undefined,
  };
}
```

- [ ] **Step 2: saveCharacter 교체**

```typescript
export async function saveCharacter(
  data: Omit<Character, "id" | "createdAt" | "updatedAt">
): Promise<Character> {
  const db = await getDb();
  const now = Date.now();
  const id = crypto.randomUUID();

  await db.execute(
    `INSERT INTO characters
       (id, name, model_path, model_remote_url, model_task_type,
        idle_anim_path, sleep_anim_path, generation_status,
        meshy_task_id, idle_meshy_task_id, sleep_meshy_task_id,
        server_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, data.name, data.modelPath ?? null, data.modelRemoteUrl ?? null,
      data.modelTaskType, data.idleAnimPath ?? null, data.sleepAnimPath ?? null,
      data.generationStatus, data.meshyTaskId ?? null,
      data.idleMeshyTaskId ?? null, data.sleepMeshyTaskId ?? null,
      data.serverId ?? null, now, now,
    ]
  );

  return { id, ...data, createdAt: now, updatedAt: now };
}
```

- [ ] **Step 3: findFirstCharacter / findCharacterById / updateCharacterName / markCharacterSynced / deleteCharacter 유지, 폴러용 업데이트 함수 추가**

`updateCharacterName`, `markCharacterSynced`, `deleteCharacter`, `findFirstCharacter`, `findCharacterById`는 기존 그대로 둔다 (toCharacter만 새 버전 사용). 파일 끝에 추가:

```typescript
// 폴러: 캐릭터 생성 진행 상태 업데이트
export async function updateCharacterFields(
  id: string,
  fields: Partial<Pick<Character,
    "modelPath" | "modelRemoteUrl" | "idleAnimPath" | "sleepAnimPath" |
    "generationStatus" | "idleMeshyTaskId" | "sleepMeshyTaskId">>
): Promise<void> {
  const db = await getDb();
  const map: Record<string, string> = {
    modelPath: "model_path",
    modelRemoteUrl: "model_remote_url",
    idleAnimPath: "idle_anim_path",
    sleepAnimPath: "sleep_anim_path",
    generationStatus: "generation_status",
    idleMeshyTaskId: "idle_meshy_task_id",
    sleepMeshyTaskId: "sleep_meshy_task_id",
  };
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  const setClause = entries.map(([k]) => `${map[k]} = ?`).join(", ");
  const values = entries.map(([, v]) => v);
  await db.execute(
    `UPDATE characters SET ${setClause}, updated_at = ? WHERE id = ?`,
    [...values, Date.now(), id]
  );
}

// 폴러: 아직 ready/failed가 아닌 캐릭터 조회
export async function findPendingCharacters(): Promise<Character[]> {
  const db = await getDb();
  const rows = await db.select<CharacterRow[]>(
    "SELECT * FROM characters WHERE generation_status = 'pending'"
  );
  return rows.map(toCharacter);
}
```

- [ ] **Step 4: 타입 확인**

Run: `cd apps/desktop && npx tsc --noEmit 2>&1 | grep characterRepository.ts`
Expected: 빈 출력

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/repository/characterRepository.ts
git commit -m "feat: update characterRepository for 3D columns"
```

---

## Task 8: actionRepository 컬럼 변경

**Files:**
- Modify: `apps/desktop/src/repository/actionRepository.ts`

- [ ] **Step 1: Row 인터페이스 + toAction 교체**

`action_image_path` → `animation_path`, 상태 컬럼 추가:
```typescript
import { getDb } from "@/lib/sqlite";
import { Action } from "@/store/actionStore";
import { GenerationStatus } from "@/store/characterStore";

interface ActionRow {
  id: string;
  character_id: string;
  name: string;
  animation_path: string | null;
  generation_status: string;
  meshy_task_id: string | null;
  speech_bubble: string | null;
  voice_file_path: string | null;
  voice_loop_start: number | null;
  voice_loop_end: number | null;
  scheduled_at: number | null;
  duration_minutes: number | null;
  server_id: string | null;
  created_at: number;
  updated_at: number;
  synced_at: number | null;
}

function toAction(row: ActionRow): Action {
  return {
    id: row.id,
    characterId: row.character_id,
    name: row.name,
    animationPath: row.animation_path ?? undefined,
    generationStatus: row.generation_status as GenerationStatus,
    meshyTaskId: row.meshy_task_id ?? undefined,
    speechBubble: row.speech_bubble ?? undefined,
    voiceFilePath: row.voice_file_path ?? undefined,
    voiceLoopStart: row.voice_loop_start ?? undefined,
    voiceLoopEnd: row.voice_loop_end ?? undefined,
    scheduledAt: row.scheduled_at ?? undefined,
    durationMinutes: row.duration_minutes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt: row.synced_at ?? undefined,
  };
}
```

- [ ] **Step 2: saveAction 교체**

```typescript
export async function saveAction(
  data: Omit<Action, "id" | "createdAt" | "updatedAt">
): Promise<Action> {
  const db = await getDb();
  const now = Date.now();
  const id = crypto.randomUUID();

  await db.execute(
    `INSERT INTO actions
       (id, character_id, name, animation_path, generation_status, meshy_task_id,
        speech_bubble, voice_file_path, voice_loop_start, voice_loop_end,
        scheduled_at, duration_minutes, server_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, data.characterId, data.name, data.animationPath ?? null,
      data.generationStatus, data.meshyTaskId ?? null,
      data.speechBubble ?? null, data.voiceFilePath ?? null,
      data.voiceLoopStart ?? null, data.voiceLoopEnd ?? null,
      data.scheduledAt ?? null, data.durationMinutes ?? null,
      null, now, now,
    ]
  );

  return { id, ...data, createdAt: now, updatedAt: now };
}
```

- [ ] **Step 3: 기존 함수 유지 + 폴러용 함수 추가**

`findActionsByCharacterId`, `findActionById`, `findScheduledActions`, `updateSpeechBubble`, `updateActionSchedule`, `markActionSynced`, `deleteAction`는 그대로 유지 (toAction만 새 버전). 파일 끝에 추가:

```typescript
export async function updateActionFields(
  id: string,
  fields: Partial<Pick<Action, "animationPath" | "generationStatus">>
): Promise<void> {
  const db = await getDb();
  const map: Record<string, string> = {
    animationPath: "animation_path",
    generationStatus: "generation_status",
  };
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  const setClause = entries.map(([k]) => `${map[k]} = ?`).join(", ");
  const values = entries.map(([, v]) => v);
  await db.execute(
    `UPDATE actions SET ${setClause}, updated_at = ? WHERE id = ?`,
    [...values, Date.now(), id]
  );
}

export async function findPendingActions(): Promise<Action[]> {
  const db = await getDb();
  const rows = await db.select<ActionRow[]>(
    "SELECT * FROM actions WHERE generation_status = 'pending'"
  );
  return rows.map(toAction);
}
```

- [ ] **Step 4: 타입 확인**

Run: `cd apps/desktop && npx tsc --noEmit 2>&1 | grep actionRepository.ts`
Expected: 빈 출력

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/repository/actionRepository.ts
git commit -m "feat: update actionRepository for 3D animation columns"
```

---

## Task 9: CharacterViewer 컴포넌트

**Files:**
- Create: `apps/desktop/src/components/CharacterViewer/index.tsx`

- [ ] **Step 1: CharacterViewer 작성**

GLB 경로를 받아 R3F Canvas에 렌더링하고 내장 애니메이션을 재생한다. `useGLTF` + `useAnimations`(drei) 사용. status/action에 따라 GLB 경로를 결정한다.

```tsx
import { Suspense, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { Character } from "@/store/characterStore";
import { Action, WidgetStatus } from "@/store/actionStore";
import { toGlbUrl } from "@/lib/glbUtils";

interface Props {
  character: Character;
  currentAction: Action | null;
  status: WidgetStatus;
}

function Model({ url }: { url: string }) {
  const { scene, animations } = useGLTF(url);
  const { actions } = useAnimations(animations, scene);

  useEffect(() => {
    const first = Object.values(actions)[0];
    first?.reset().fadeIn(0.3).play();
    return () => {
      first?.fadeOut(0.3);
    };
  }, [actions]);

  return <primitive object={scene} scale={1.5} position={[0, -1, 0]} />;
}

export default function CharacterViewer({ character, currentAction, status }: Props) {
  // 표시할 GLB 로컬 경로 결정 (PNG 교체 로직과 1:1 대응)
  const relativePath = useMemo(() => {
    if (status === "idle") return character.sleepAnimPath;
    return currentAction?.animationPath ?? character.idleAnimPath;
  }, [status, currentAction, character]);

  if (character.generationStatus === "pending") {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs animate-pulse">
        3D 캐릭터 생성 중...
      </div>
    );
  }
  if (character.generationStatus === "failed" || !relativePath) {
    return (
      <div className="w-full h-full flex items-center justify-center text-3xl">
        🐾
      </div>
    );
  }

  const url = toGlbUrl(relativePath);

  return (
    <Canvas
      key={url}
      gl={{ alpha: true }}
      camera={{ position: [0, 0, 4], fov: 40 }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 3, 2]} intensity={1} />
      <Suspense fallback={null}>
        <Model url={url} />
      </Suspense>
    </Canvas>
  );
}
```

참고: `key={url}`로 GLB 변경 시 Canvas를 재마운트하여 모델/믹서를 깔끔히 교체한다 (스펙의 "hard switch + fade-in" 동작).

- [ ] **Step 2: 타입 확인**

Run: `cd apps/desktop && npx tsc --noEmit 2>&1 | grep CharacterViewer`
Expected: 빈 출력

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/CharacterViewer/index.tsx
git commit -m "feat: add CharacterViewer R3F component"
```

---

## Task 10: useJobPoller 백그라운드 폴러

**Files:**
- Create: `apps/desktop/src/hooks/useJobPoller.ts`

캐릭터 생성은 3단계 의존 잡(base → idle+sleep)이다. 폴러는 캐릭터의 현재 상태에 따라 다음 단계를 진행한다.

상태 머신:
- `meshyTaskId` 있고 `modelPath` 없음 → base model 폴링. 완료 시 GLB 저장 + `modelRemoteUrl` 저장 + idle/sleep 애니메이션 잡 2개 생성하여 `idleMeshyTaskId`/`sleepMeshyTaskId` 저장
- `idleMeshyTaskId`/`sleepMeshyTaskId` 있고 해당 anim path 없음 → 각각 폴링, 완료 시 저장
- idle + sleep 둘 다 완료 → `generationStatus = 'ready'`

- [ ] **Step 1: useJobPoller 작성**

```typescript
import { useEffect, useRef } from "react";
import {
  findPendingCharacters,
  updateCharacterFields,
} from "@/repository/characterRepository";
import {
  findPendingActions,
  updateActionFields,
} from "@/repository/actionRepository";
import { useCharacterStore } from "@/store/characterStore";
import { useActionStore } from "@/store/actionStore";
import {
  pollTask,
  createAnimation,
  IDLE_PROMPT,
  SLEEP_PROMPT,
  actionPromptFor,
} from "@/lib/meshy";
import { downloadGlb } from "@/lib/glbUtils";
import { findFirstCharacter } from "@/repository/characterRepository";
import { findActionsByCharacterId } from "@/repository/actionRepository";

const POLL_INTERVAL_MS = 15_000;

export function useJobPoller() {
  const busy = useRef(false);

  useEffect(() => {
    async function tick() {
      if (busy.current) return;
      busy.current = true;
      try {
        await pollCharacters();
        await pollActions();
      } catch (e) {
        console.error("jobPoller error:", e);
      } finally {
        busy.current = false;
      }
    }

    const id = setInterval(tick, POLL_INTERVAL_MS);
    tick();
    return () => clearInterval(id);
  }, []);
}

async function pollCharacters(): Promise<void> {
  const chars = await findPendingCharacters();
  let changed = false;

  for (const c of chars) {
    // 단계 1: base model
    if (c.meshyTaskId && !c.modelPath) {
      const r = await pollTask(c.meshyTaskId, c.modelTaskType);
      if (r.status === "failed") {
        await updateCharacterFields(c.id, { generationStatus: "failed" });
        changed = true;
        continue;
      }
      if (r.status === "succeeded" && r.glbUrl) {
        const path = await downloadGlb(r.glbUrl, `models/${c.id}`, "base.glb");
        const idleTask = await createAnimation(r.glbUrl, IDLE_PROMPT);
        const sleepTask = await createAnimation(r.glbUrl, SLEEP_PROMPT);
        await updateCharacterFields(c.id, {
          modelPath: path,
          modelRemoteUrl: r.glbUrl,
          idleMeshyTaskId: idleTask,
          sleepMeshyTaskId: sleepTask,
        });
        changed = true;
      }
      continue;
    }

    // 단계 2: idle / sleep 애니메이션
    const fields: Parameters<typeof updateCharacterFields>[1] = {};
    if (c.idleMeshyTaskId && !c.idleAnimPath) {
      const r = await pollTask(c.idleMeshyTaskId, "animation");
      if (r.status === "succeeded" && r.glbUrl) {
        fields.idleAnimPath = await downloadGlb(r.glbUrl, `models/${c.id}`, "idle.glb");
      } else if (r.status === "failed") {
        fields.generationStatus = "failed";
      }
    }
    if (c.sleepMeshyTaskId && !c.sleepAnimPath) {
      const r = await pollTask(c.sleepMeshyTaskId, "animation");
      if (r.status === "succeeded" && r.glbUrl) {
        fields.sleepAnimPath = await downloadGlb(r.glbUrl, `models/${c.id}`, "sleep.glb");
      } else if (r.status === "failed") {
        fields.generationStatus = "failed";
      }
    }

    // 단계 3: 둘 다 완료 시 ready
    const idleDone = c.idleAnimPath || fields.idleAnimPath;
    const sleepDone = c.sleepAnimPath || fields.sleepAnimPath;
    if (idleDone && sleepDone && fields.generationStatus !== "failed") {
      fields.generationStatus = "ready";
    }

    if (Object.keys(fields).length > 0) {
      await updateCharacterFields(c.id, fields);
      changed = true;
    }
  }

  if (changed) {
    const fresh = await findFirstCharacter();
    useCharacterStore.getState().setCharacter(fresh);
  }
}

async function pollActions(): Promise<void> {
  const actions = await findPendingActions();
  let changed = false;

  for (const a of actions) {
    if (!a.meshyTaskId) continue;
    const r = await pollTask(a.meshyTaskId, "animation");
    if (r.status === "succeeded" && r.glbUrl) {
      const path = await downloadGlb(r.glbUrl, "models/actions", `${a.id}.glb`);
      await updateActionFields(a.id, {
        animationPath: path,
        generationStatus: "ready",
      });
      changed = true;
    } else if (r.status === "failed") {
      await updateActionFields(a.id, { generationStatus: "failed" });
      changed = true;
    }
  }

  if (changed) {
    const character = useCharacterStore.getState().character;
    if (character) {
      const fresh = await findActionsByCharacterId(character.id);
      useActionStore.getState().setActions(fresh);
    }
  }
}
```

`actionPromptFor`는 ActionForm에서 잡 생성 시 사용하므로 import만 유지(폴러에서 직접 안 씀) — 미사용 import 제거: `actionPromptFor` 줄 삭제.

- [ ] **Step 2: 미사용 import 정리**

위 import 블록에서 `actionPromptFor`를 제거한다 (폴러는 잡 생성을 안 하고 ActionForm이 함).

- [ ] **Step 3: 타입 확인**

Run: `cd apps/desktop && npx tsc --noEmit 2>&1 | grep useJobPoller`
Expected: 빈 출력

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/hooks/useJobPoller.ts
git commit -m "feat: add background job poller for Meshy.ai generation"
```

---

## Task 11: Setup 페이지 — 비블로킹 생성

**Files:**
- Modify: `apps/desktop/src/pages/Setup/index.tsx`

생성 버튼을 누르면 Meshy.ai 잡을 시작하고, 캐릭터를 `pending`으로 즉시 저장 후 main으로 이동한다. 폴러가 완료를 처리한다.

- [ ] **Step 1: import 및 handleCreate 교체**

`generateCharacterImages` import를 제거하고:
```typescript
import { createTextModel, createImageModel } from "@/lib/meshy";
```

`handleCreate`를 교체:
```typescript
  async function handleCreate() {
    if (!canCreate) return;
    setStep("generating");
    setError(null);

    try {
      setLoadingMsg("AI에게 3D 캐릭터 생성을 요청하는 중...");

      let taskId: string;
      let taskType: "text" | "image";
      if (base64) {
        taskId = await createImageModel(`data:image/png;base64,${base64}`);
        taskType = "image";
      } else {
        taskId = await createTextModel(description.trim());
        taskType = "text";
      }

      const character = await saveCharacter({
        name: characterName.trim(),
        modelTaskType: taskType,
        generationStatus: "pending",
        meshyTaskId: taskId,
      });

      setCharacter(character);
      setActions([]);
      setPage("main");
    } catch (e) {
      setError(e instanceof Error ? e.message : "캐릭터 생성 요청에 실패했어요.");
      setStep("input");
    }
  }
```

`saveBase64Image` import는 더 이상 안 쓰므로 제거.

- [ ] **Step 2: 타입 확인**

Run: `cd apps/desktop && npx tsc --noEmit 2>&1 | grep Setup`
Expected: 빈 출력

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/pages/Setup/index.tsx
git commit -m "feat: Setup page uses Meshy.ai non-blocking generation"
```

---

## Task 12: ActionForm 페이지 — 비블로킹 생성

**Files:**
- Modify: `apps/desktop/src/pages/ActionForm/index.tsx`

행동 생성 시 캐릭터의 `modelRemoteUrl`로 애니메이션 잡을 시작하고 행동을 `pending`으로 저장한다. 미리보기 이미지(`previewUrl`) 개념을 상태 칩으로 대체한다.

- [ ] **Step 1: import 교체**

```typescript
import { createAnimation, actionPromptFor } from "@/lib/meshy";
import { saveAction, findActionById, updateSpeechBubble, updateActionSchedule } from "@/repository/actionRepository";
```
`generateActionImage`, `saveBase64Image`, `toDisplayUrl` import 제거.

- [ ] **Step 2: 상태 변수 및 detail 진입 흐름 수정**

`actionImagePath`/`previewUrl` 상태를 제거하고 `pendingTaskId` 추가:
```typescript
  const [step, setStep] = useState<Step>("name");
  const [actionName, setActionName] = useState("");
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [speechBubble, setSpeechBubble] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
```

수정 모드 useEffect에서 `setActionImagePath`/`setPreviewUrl` 줄 제거 (animationPath는 표시 안 함):
```typescript
  useEffect(() => {
    if (!editingActionId) return;
    (async () => {
      const action = await findActionById(editingActionId);
      if (!action) return;
      setActionName(action.name);
      setSpeechBubble(action.speechBubble ?? "");
      setSavedId(action.id);
      if (action.scheduledAt) {
        const d = new Date(action.scheduledAt);
        setScheduledTime(
          `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
        );
      }
      if (action.durationMinutes) setDurationMinutes(String(action.durationMinutes));
      setStep("detail");
    })();
  }, [editingActionId]);
```

- [ ] **Step 3: handleGenerateImage → handleStartGeneration 교체**

```typescript
  async function handleStartGeneration() {
    if (!actionName.trim() || !character) return;
    if (!character.modelRemoteUrl) {
      setError("캐릭터 3D 모델이 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setStep("generating");
    setError(null);
    try {
      const taskId = await createAnimation(
        character.modelRemoteUrl,
        actionPromptFor(actionName.trim())
      );
      setPendingTaskId(taskId);
      setStep("detail");
    } catch (e) {
      setError(e instanceof Error ? e.message : "애니메이션 생성 요청 실패");
      setStep("name");
    }
  }
```

- [ ] **Step 4: handleSave 교체 (신규 저장 시 pending)**

```typescript
  async function handleSave() {
    if (!actionName.trim()) return;
    setError(null);

    let scheduledAt: number | undefined;
    if (scheduledTime) {
      const [h, m] = scheduledTime.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      scheduledAt = d.getTime();
    }
    const duration = durationMinutes ? parseInt(durationMinutes) : undefined;

    try {
      if (editingActionId) {
        await updateSpeechBubble(editingActionId, speechBubble);
        if (scheduledAt && duration) await updateActionSchedule(editingActionId, scheduledAt, duration);
        setActions(
          actions.map((a) =>
            a.id === editingActionId
              ? { ...a, speechBubble, scheduledAt, durationMinutes: duration }
              : a
          )
        );
      } else {
        if (!pendingTaskId) {
          setError("먼저 행동 애니메이션 생성을 시작해 주세요.");
          return;
        }
        const action = await saveAction({
          characterId: character!.id,
          name: actionName.trim(),
          generationStatus: "pending",
          meshyTaskId: pendingTaskId,
          speechBubble: speechBubble || undefined,
          scheduledAt,
          durationMinutes: duration,
        });
        addAction(action);
      }
      setPage("action-panel");
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    }
  }
```

- [ ] **Step 5: JSX 수정 — 생성 버튼 onClick, 미리보기 이미지 제거**

`step === "generating"` LoadingOverlay 메시지를 `"3D 애니메이션 생성 요청 중..."`로 변경.
"생성" 버튼 `onClick={handleGenerateImage}` → `onClick={handleStartGeneration}`.
`previewUrl &&` 미리보기 `<img>` 블록을 제거하고, 대신 detail 단계에서 안내 칩 표시:
```tsx
        {step === "detail" && !editingActionId && (
          <div className="flex justify-center">
            <span className="text-xs text-blue-400 bg-blue-50 rounded-full px-3 py-1">
              🧊 3D 애니메이션 생성 중 · 잠시 후 캐릭터에 반영돼요
            </span>
          </div>
        )}
```

- [ ] **Step 6: 타입 확인**

Run: `cd apps/desktop && npx tsc --noEmit 2>&1 | grep ActionForm`
Expected: 빈 출력

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/pages/ActionForm/index.tsx
git commit -m "feat: ActionForm uses Meshy.ai non-blocking animation generation"
```

---

## Task 13: ActionPanel 페이지 — 상태 표시

**Files:**
- Modify: `apps/desktop/src/pages/ActionPanel/index.tsx`

`action.actionImagePath` 사용 제거 (컴파일 에러 방지). 썸네일 자리에 상태 아이콘 표시.

- [ ] **Step 1: import 정리 및 썸네일 교체**

`toDisplayUrl` import 제거. 행동 항목의 `<img src={toDisplayUrl(action.actionImagePath)} .../>` 블록을 상태 칩으로 교체:
```tsx
              {/* 상태 아이콘 */}
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-lg shrink-0">
                {action.generationStatus === "ready"
                  ? "🧊"
                  : action.generationStatus === "failed"
                  ? "⚠️"
                  : "⏳"}
              </div>
```

- [ ] **Step 2: 타입 확인**

Run: `cd apps/desktop && npx tsc --noEmit 2>&1 | grep ActionPanel`
Expected: 빈 출력

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/pages/ActionPanel/index.tsx
git commit -m "feat: ActionPanel shows 3D generation status"
```

---

## Task 14: Main 페이지 — CharacterViewer 통합 + 폴러 마운트

**Files:**
- Modify: `apps/desktop/src/pages/Main/index.tsx`

- [ ] **Step 1: import 교체**

```typescript
import CharacterViewer from "@/components/CharacterViewer";
import { useJobPoller } from "@/hooks/useJobPoller";
```
`toDisplayUrl` import 제거.

- [ ] **Step 2: 폴러 마운트 + characterImageSrc 제거**

`useScheduler();` 다음 줄에 추가:
```typescript
  useJobPoller();
```

`characterImageSrc` useMemo/변수 블록(22~28번 라인)을 삭제.

- [ ] **Step 3: 이미지 div를 CharacterViewer로 교체**

`<div className="w-32 h-32 ...">` 내부의 `characterImageSrc ? <img.../> : <div>🐾</div>` 블록 전체를 교체:
```tsx
      {/* 캐릭터 3D 뷰어 */}
      <div className="w-32 h-32 flex items-center justify-center">
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
      </div>
```

- [ ] **Step 4: 타입 확인 (전체)**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: 에러 없음 (전체 컴파일 통과)

- [ ] **Step 5: 빌드 확인**

Run: `cd apps/desktop && npm run build`
Expected: 빌드 성공

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/pages/Main/index.tsx
git commit -m "feat: Main page renders 3D CharacterViewer and mounts job poller"
```

---

## Task 15: 수동 검증

**Files:** 없음 (런타임 검증)

- [ ] **Step 1: 환경 변수 설정**

`apps/desktop/.env`에 `VITE_MESHY_API_KEY` 실제 키 설정 (사용자 제공 필요).

- [ ] **Step 2: 앱 실행**

Run: `cd apps/desktop && npm run tauri dev`
Expected: 앱 창이 뜨고, 캐릭터 없으면 Setup 페이지 표시

- [ ] **Step 3: 캐릭터 생성 플로우 확인**

텍스트로 캐릭터 생성 → main으로 즉시 이동 → "3D 캐릭터 생성 중..." 표시 확인. 5~10분 후 폴러가 GLB를 받아 3D 캐릭터가 렌더링되는지 확인.

- [ ] **Step 4: 행동 생성 플로우 확인**

행동 추가 → "3D 애니메이션 생성 중" 칩 확인 → ActionPanel에서 ⏳ → 🧊 전환 확인.

---

## Self-Review 결과

- **스펙 6개 섹션 커버:** 아키텍처(T11~14), Meshy 파이프라인(T3), DB 스키마(T2), CharacterViewer(T9), 폴러(T10), 변경 범위(전체) ✓
- **타입 일관성:** `generationStatus`, `modelTaskType`, `animationPath`, `modelRemoteUrl` 네이밍이 store/repo/poller/page 전체에서 일치 ✓
- **폴링 엔드포인트 분기:** `modelTaskType`(text/image)을 저장하여 올바른 폴링 엔드포인트 선택 ✓ (검토에서 발견한 이슈 반영)
- **ActionPanel 컴파일:** `actionImagePath` 참조 제거 (T13) ✓
- **미사용 import:** T10 Step2, T11/T12에서 정리 ✓
```