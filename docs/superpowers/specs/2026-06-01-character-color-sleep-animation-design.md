---
title: Character Color Prompt & Sleep Animation
date: 2026-06-01
status: approved
---

## Overview

두 가지 개선:
1. 캐릭터 생성 시 Meshy 프롬프트에 색상/텍스처 지시어 자동 추가
2. 수면 상태(`status === "idle"`)에서 둥실 호흡 + 숨쉬기 스케일 애니메이션 적용

## Feature 1: Color Prompt Enhancement

**파일**: `apps/desktop/src/lib/meshy.ts`

`createTextModel` 함수의 프롬프트 템플릿에 색상 지시어를 추가한다.

**변경 전**:
```
`${prompt}, cute chubby 3D clay style character, full body`
```

**변경 후**:
```
`${prompt}, cute chubby 3D clay style character, full body, vibrant colors, rich color details, colorful textures`
```

- 기존 캐릭터에는 영향 없음 (이미 생성된 GLB는 변경되지 않음)
- 새로 생성하는 캐릭터부터 적용

## Feature 2: Sleep Animation

**파일**: `apps/desktop/src/components/CharacterViewer/index.tsx`

### Model 컴포넌트 변경

`sleeping: boolean` prop 추가. `useFrame`으로 두 효과 동시 적용:

| 효과 | 수식 | 주기 | 진폭 |
|------|------|------|------|
| 둥실 호흡 (Y bob) | `sin(t × 0.8) × 0.05` | ~8s | ±0.05 units |
| 숨쉬기 스케일 | `1 + sin(t × 0.5) × 0.02` | ~12s | ±2% |

두 주기를 다르게 설정해 기계적으로 느껴지지 않게 한다.

- `sleeping=true`: GLB 내장 애니메이션 재생 안 함, `useFrame` 효과만 적용
- `sleeping=false`: `useFrame` 비활성화, 기존 GLB 애니메이션 재생

Three.js `group` ref를 wrapping layer로 사용해 `primitive`의 `scale`/`position`과 독립적으로 transform 적용.

### CharacterViewer 변경

```tsx
<Model url={url} sleeping={status === "idle"} />
```

### 상태 매핑 요약

```
status === "idle"   → sleep.glb + bob + breathe
status === "active" → action.glb or idle.glb + GLB 애니메이션
```

## Scope

- 새 API 호출 없음
- DB 스키마 변경 없음
- 기존 캐릭터 데이터 영향 없음
