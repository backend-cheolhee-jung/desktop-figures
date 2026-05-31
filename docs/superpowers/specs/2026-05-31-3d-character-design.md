# 3D 애니메이션 캐릭터 시스템 설계

**날짜:** 2026-05-31  
**범위:** Vertex AI Imagen(2D PNG) → Meshy.ai(3D GLB) + React Three Fiber 전환

---

## 1. 아키텍처 개요

### 현재 → 변경 후

| 현재 | 변경 후 |
|---|---|
| `llm.ts` (Vertex AI Imagen) | `meshy.ts` (Meshy.ai API) |
| `<img src={pngPath}>` | `<Canvas>` (React Three Fiber) |
| `baseImagePath`, `sleepImagePath` | `idleAnimPath`, `sleepAnimPath` (GLB) |
| `actionImagePath` | `animationPath` (GLB) |
| 즉시 생성 (~10초) | 백그라운드 잡 + 폴링 (~5~10분) |

### 핵심 흐름

```
[사용자 입력] → meshy.ts → Meshy.ai POST → task_id 반환 (즉시)
                                ↓
                    DB에 generation_status='pending' 저장
                                ↓
                    useJobPoller (15초 간격 백그라운드 폴링)
                                ↓
                    완료 시 GLB 다운로드 → 로컬 저장 → DB 업데이트
                                ↓
                    CharacterViewer가 GLB 자동 로드 & 애니메이션 재생
```

### 애니메이션 전략

Meshy.ai animation 엔드포인트는 animated GLB(메쉬 + 애니메이션 포함)를 반환한다.
상태별로 GLB 파일을 교체하는 방식 — 현재 PNG 교체 방식과 동일한 패턴 유지.

- idle → `idle.glb`
- sleep → `sleep.glb`
- 행동 중 → `action_{id}.glb`

Three.js `AnimationMixer`로 각 GLB의 내장 애니메이션 클립 재생.

---

## 2. Meshy.ai 생성 파이프라인

### 캐릭터 생성

캐릭터 1개 완성까지 총 3개의 Meshy.ai 잡이 순차적으로 실행된다.

```
Step 1: base model 생성
  POST /v2/text-to-3d  또는  POST /v1/image-to-3d
  입력: 텍스트 설명 or 참조 이미지 base64
  → task_id 반환

Step 2: base model 완료 후 idle/sleep 애니메이션 동시 생성
  POST /v1/text-to-animation  (model_url + "gentle idle breathing")
  POST /v1/text-to-animation  (model_url + "sleeping, eyes closed, gentle breathing")
  → 각각 task_id 반환

Step 3: 두 애니메이션 완료 → generation_status = 'ready'
```

### 행동 애니메이션 생성

```
Step 1: 사용자가 행동 이름 입력 (예: "먹기")
Step 2: POST /v1/text-to-animation
        (캐릭터 base model URL + "{actionName}하는 모습, cute 3D style")
        → task_id 반환
Step 3: 폴러가 완료 감지 → animationPath 업데이트
```

### `meshy.ts` 공개 인터페이스

```typescript
generateCharacterModel(input: {
  imageBase64?: string;
  description?: string;
}): Promise<{ taskId: string }>

generateAnimation(
  modelUrl: string,
  actionName: string
): Promise<{ taskId: string }>

pollTaskStatus(taskId: string): Promise<{
  status: 'pending' | 'succeeded' | 'failed';
  modelUrl?: string;
}>
```

---

## 3. DB 스키마 변경

### characters 테이블

```sql
-- 제거
base_image_path   TEXT NOT NULL
sleep_image_path  TEXT NOT NULL

-- 추가
model_path            TEXT,     -- base model GLB 로컬 경로
model_remote_url      TEXT,     -- Meshy.ai CDN URL (idle/sleep anim 생성 시 입력으로 사용)
idle_anim_path        TEXT,     -- idle 애니메이션 GLB 로컬 경로
sleep_anim_path       TEXT,     -- sleep 애니메이션 GLB 로컬 경로
generation_status     TEXT NOT NULL DEFAULT 'pending',  -- pending | ready | failed
meshy_task_id         TEXT,     -- base model 잡 ID
idle_meshy_task_id    TEXT,     -- idle anim 잡 ID
sleep_meshy_task_id   TEXT      -- sleep anim 잡 ID
```

### actions 테이블

```sql
-- 제거
action_image_path  TEXT NOT NULL

-- 추가
animation_path      TEXT,       -- 행동 애니메이션 GLB 경로
generation_status   TEXT NOT NULL DEFAULT 'pending',
meshy_task_id       TEXT
```

### 파일 저장 경로

```
{appDataDir}/models/
  {character_id}/
    base.glb
    idle.glb
    sleep.glb
  actions/
    {action_id}.glb
```

Tauri `@tauri-apps/plugin-fs`로 appDataDir에 저장.

### 마이그레이션 전략

기존 DB가 있으므로 `ALTER TABLE ADD COLUMN IF NOT EXISTS`로 컬럼 추가.
기존 캐릭터/행동 데이터는 `generation_status = 'failed'`로 표시해 재생성 유도.

---

## 4. CharacterViewer 컴포넌트

### 새 패키지

```
@react-three/fiber
@react-three/drei
three
@types/three
```

### 인터페이스

```tsx
// 현재 Main/index.tsx의 <img> 태그를 그대로 교체
<CharacterViewer
  character={character}
  currentAction={currentAction}
  status={status}   // 'idle' | 'active'
/>
```

### 상태별 렌더링

| `generationStatus` | 렌더링 |
|---|---|
| `pending` | 로딩 플레이스홀더 (회전 큐브 등) |
| `failed` | 에러 표시 |
| `ready` | Canvas 3D 렌더링 |

### Canvas 구성

- 투명 배경: `gl={{ alpha: true }}`
- 조명: `AmbientLight` + `DirectionalLight`
- `useGLTF`로 GLB 로드
- `AnimationMixer`로 내장 클립 재생
- 상태 전환 시 0.3초 페이드

### GLB 경로 결정 로직

```typescript
const glbPath = status === 'idle'
  ? character.sleepAnimPath
  : (currentAction?.animationPath ?? character.idleAnimPath);
```

현재 PNG 교체 로직과 1:1 대응.

---

## 5. 백그라운드 잡 폴러

### `useJobPoller` 훅

App.tsx 또는 Main 페이지에서 mount 시 한 번 실행.

```
매 15초마다:
  1. DB에서 generation_status = 'pending' 인 characters + actions 조회
  2. 각 meshy_task_id로 pollTaskStatus() 호출
  3. succeeded → GLB URL 다운로드 → 로컬 파일 저장 → DB 업데이트
     failed    → generation_status = 'failed' 업데이트
  4. 캐릭터 base model 완료 시 idle/sleep 애니메이션 잡 자동 시작
  5. 모든 잡 완료 시 characterStore / actionStore 리프레시
```

### 잡 의존성 순서

```
[base model 완료]
  → idle_meshy_task_id 생성 시작
  → sleep_meshy_task_id 생성 시작
  → 둘 다 완료되면 generation_status = 'ready'
```

---

## 6. 변경 범위 요약

| 파일 | 변경 유형 |
|---|---|
| `src/lib/meshy.ts` | 신규 (llm.ts 대체) |
| `src/lib/llm.ts` | 삭제 |
| `src/components/CharacterViewer/index.tsx` | 신규 |
| `src/hooks/useJobPoller.ts` | 신규 |
| `src/lib/sqlite.ts` | 스키마 마이그레이션 추가 |
| `src/store/characterStore.ts` | 타입 변경 (image paths → anim paths) |
| `src/store/actionStore.ts` | 타입 변경 |
| `src/repository/characterRepository.ts` | 컬럼 변경 |
| `src/repository/actionRepository.ts` | 컬럼 변경 |
| `src/pages/Main/index.tsx` | `<img>` → `<CharacterViewer>` |
| `src/pages/Setup/index.tsx` | Meshy.ai 연동, pending 상태 UI |
| `src/pages/ActionForm/index.tsx` | Meshy.ai 연동, pending 상태 UI |
| `apps/desktop/.env.example` | VITE_MESHY_API_KEY 추가, Vertex 변수 제거 |
