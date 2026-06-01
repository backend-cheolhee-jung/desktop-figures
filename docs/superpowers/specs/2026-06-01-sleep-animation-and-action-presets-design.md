---
title: Sleep Animation Pipeline + Action Animation Presets
date: 2026-06-01
status: approved
---

## Overview

두 가지 기능:
1. **수면 애니메이션 파이프라인**: 캐릭터 생성 시 Meshy `/v1/animations` API로 실제 수면 애니메이션(action_id 269) 생성 및 저장
2. **행동 애니메이션 타입 선택**: 행동 추가 폼에 애니메이션 타입 드롭다운 + 말풍선을 처음부터 입력하도록 UX 개선

---

## Part 1: 수면 애니메이션 파이프라인

### 현재 파이프라인 (잘못됨)

```
단계 2: rig 완료
  → idle.glb (walking) → idleAnimPath
  → rigged.glb (정적 T-포즈) → sleepAnimPath   ← 실제 애니메이션 없음
  → generationStatus = ready
```

### 새 파이프라인

```
단계 2: rig 완료
  → idle.glb (walking) → idleAnimPath
  → createAnimation(rigTaskId, 269) → sleepMeshyTaskId 저장
  (sleepAnimPath 없음, ready 아님)

단계 3: sleepMeshyTaskId && !sleepAnimPath
  → pollAnimation(sleepMeshyTaskId)
  → sleep.glb 다운로드 → sleepAnimPath
  → generationStatus = ready
```

`sleepMeshyTaskId` 필드는 `Character` 타입과 DB에 이미 존재 — 스키마 변경 없음.

### CharacterViewer 정리

`sleeping` prop, `useFrame`, `THREE.Group` ref, `import * as THREE` 제거.
실제 GLB 키프레임이 있으므로 `useAnimations`가 자동 재생.
수면 상태에서 `first?.reset().fadeIn(0.3).play()` 그대로 동작.

---

## Part 2: 행동 애니메이션 타입 선택

### 프리셋 상수 (`meshy.ts` 또는 별도 `animationPresets.ts`)

```ts
export const ANIMATION_PRESETS = [
  { id: "coding",     label: "코딩/공부",  actionId: 32  },  // Chair_Sit_Idle_F
  { id: "walking",    label: "걷기",       actionId: 30  },  // Casual_Walk
  { id: "running",    label: "달리기",     actionId: 14  },  // Run_02
  { id: "dancing",    label: "춤추기",     actionId: 22  },  // FunnyDancing_01
  { id: "waving",     label: "손흔들기",   actionId: 28  },  // Big_Wave_Hello
  { id: "eating",     label: "식사/음료",  actionId: 343 },  // Sit_and_Drink
  { id: "talking",    label: "대화/발표",  actionId: 308 },  // Talk_Passionately
  { id: "workout",    label: "운동/헬스",  actionId: 319 },  // air_squat
  { id: "stretching", label: "스트레칭",   actionId: 31  },  // Catching_Breath
  { id: "cheering",   label: "박수/응원",  actionId: 298 },  // Cheer_with_Both_Hands_Up
  { id: "thinking",   label: "생각중",     actionId: 36  },  // Confused_Scratch
] as const;

export type AnimationPresetId = typeof ANIMATION_PRESETS[number]["id"];
```

### ActionForm UX 변경

**현재 흐름:**
```
1. 행동 이름 입력 → 생성 버튼 클릭 → 2단계로 넘어감
2. 말풍선 / 시간 / 시간 설정 → 저장
```

**새 흐름 (단계 통합):**
```
단일 폼:
  - 행동 이름 입력 (필수)
  - 애니메이션 타입 드롭다운 (필수, 기본값: 코딩/공부)
  - 말풍선 텍스트 입력 (선택)
  - 시작 시간 / 지속 시간 (선택)
  → 생성 버튼: createAnimation(character.rigTaskId, selectedPreset.actionId)
```

`handleStartGeneration`에서 `action_id` 하드코딩 `1` → 선택된 preset의 `actionId`로 교체.

---

## Part 3: 캐릭터 생성 프롬프트 강화

`meshy.ts` `createTextModel`의 프롬프트 템플릿을 더 구체적인 귀여움/컬러 지시어로 교체:

```ts
// 현재
`${prompt}, cute chubby 3D clay style character, full body, vibrant colors, rich color details, colorful textures`

// 변경
`${prompt}, super cute chibi 3D character, full body, chubby proportions, big expressive eyes, soft pastel and vibrant color palette, rich colorful textures, high contrast colors, adorable and charming design, smooth clay-like surface`
```

---

## 변경 파일 요약

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/meshy.ts` | `ANIMATION_PRESETS` 상수 추가, `createSleepAnimation` 헬퍼 추가, 프롬프트 강화 |
| `src/hooks/useJobPoller.ts` | 단계 2 수정 (sleep 요청), 단계 3 추가 (sleep 폴링) |
| `src/components/CharacterViewer/index.tsx` | bob/breathe hack 제거, `Model` 원복 |
| `src/pages/ActionForm/index.tsx` | 애니메이션 타입 드롭다운 추가, 말풍선 위치 이동, action_id 동적 선택 |

## 범위 외

- 기존 캐릭터(철선생)의 sleep.glb 재생성 — 새 캐릭터부터 적용
- sleep action_id 변경 UI — 코드 상수로 관리
