# Character Color Prompt & Sleep Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 캐릭터 생성 시 Meshy 프롬프트에 색상 지시어를 추가하고, 수면 상태에서 둥실 호흡 + 숨쉬기 스케일 애니메이션을 적용한다.

**Architecture:** `meshy.ts`의 프롬프트 템플릿에 색상 키워드를 추가하고, `CharacterViewer/index.tsx`의 `Model` 컴포넌트에 `sleeping` prop과 `useFrame` 기반 procedural 애니메이션을 추가한다. 테스트 인프라가 없으므로 TypeScript 컴파일 검증 + 앱 실행 시각 확인으로 완료를 판단한다.

**Tech Stack:** React, @react-three/fiber (`useFrame`, `useRef`), Three.js (`Group`), TypeScript

---

### Task 1: 색상 프롬프트 추가

**Files:**
- Modify: `apps/desktop/src/lib/meshy.ts:33`

- [ ] **Step 1: 프롬프트 템플릿 수정**

`apps/desktop/src/lib/meshy.ts` 33번째 줄을 아래와 같이 변경:

```ts
// 변경 전
prompt: `${prompt}, cute chubby 3D clay style character, full body`,

// 변경 후
prompt: `${prompt}, cute chubby 3D clay style character, full body, vibrant colors, rich color details, colorful textures`,
```

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
cd apps/desktop && npx tsc --noEmit
```

Expected: 출력 없음 (에러 없음)

- [ ] **Step 3: 커밋**

```bash
git add apps/desktop/src/lib/meshy.ts
git commit -m "feat: add vibrant color keywords to character generation prompt"
```

---

### Task 2: 수면 애니메이션 (bob + breathe)

**Files:**
- Modify: `apps/desktop/src/components/CharacterViewer/index.tsx`

- [ ] **Step 1: `useFrame`과 `useRef` import 추가**

파일 상단 import를 아래와 같이 수정:

```ts
import { Component, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, Environment } from "@react-three/drei";
import * as THREE from "three";
import { Character } from "@/store/characterStore";
import { Action, WidgetStatus } from "@/store/actionStore";
import { toGlbUrl } from "@/lib/glbUtils";
```

- [ ] **Step 2: `Model` 컴포넌트에 `sleeping` prop과 `useFrame` 추가**

기존 `Model` 함수 전체를 아래로 교체:

```tsx
function Model({ url, sleeping }: { url: string; sleeping: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url);
  const { actions } = useAnimations(animations, scene);

  useEffect(() => {
    if (sleeping) return;
    const first = Object.values(actions)[0];
    first?.reset().fadeIn(0.3).play();
    return () => {
      first?.fadeOut(0.3);
    };
  }, [actions, sleeping]);

  useFrame(({ clock }) => {
    if (!sleeping || !groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.position.y = Math.sin(t * 0.8) * 0.05;
    const breathe = 1 + Math.sin(t * 0.5) * 0.02;
    groupRef.current.scale.setScalar(breathe);
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={1.5} position={[0, -1, 0]} />
    </group>
  );
}
```

- `sleeping=true`: GLB 내 애니메이션 재생 안 하고 `useFrame`으로 bob + breathe만 적용
- `sleeping=false`: 기존처럼 GLB 애니메이션 재생, `useFrame` 효과 없음
- `groupRef`는 `primitive`의 `scale={1.5}` / `position={[0,-1,0]}`과 독립적으로 transform 적용

- [ ] **Step 3: `Model` 호출부에 `sleeping` prop 전달**

`CharacterViewer` 컴포넌트 내 `<Model>` 호출을 아래와 같이 수정:

```tsx
<Model url={url} sleeping={status === "idle"} />
```

- [ ] **Step 4: TypeScript 컴파일 확인**

```bash
cd apps/desktop && npx tsc --noEmit
```

Expected: 출력 없음 (에러 없음)

- [ ] **Step 5: 앱 실행 후 시각 확인**

Tauri dev 서버가 실행 중이면 HMR로 자동 반영됨. 앱 창에서:
- `status === "idle"` 상태 → 캐릭터가 위아래로 천천히 둥실거리고 살짝 숨쉬는 것처럼 스케일 변화 확인
- 두 효과가 서로 다른 주기(8s bob / 12s breathe)로 동작해 자연스러운지 확인

- [ ] **Step 6: 커밋**

```bash
git add apps/desktop/src/components/CharacterViewer/index.tsx
git commit -m "feat: add sleeping bob and breathe animation to CharacterViewer"
```
