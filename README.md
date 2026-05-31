# Desktop Figures 🐾

데스크탑 위에 나만의 귀여운 AI 캐릭터를 올려놓고, 현재 하는 일을 실시간으로 친구와 공유하는 데스크탑 컴패니언 앱.

> 캐릭터가 말풍선과 타이머를 달고 바탕화면에 앉아 있고, 친구 캐릭터도 작게 옆에 표시된다.

---

## 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [모노레포 구조](#모노레포-구조)
4. [핵심 기능 명세](#핵심-기능-명세)
5. [LLM 유스케이스](#llm-유스케이스)
6. [데이터 모델](#데이터-모델)
7. [브랜치 전략 & 개발 로드맵](#브랜치-전략--개발-로드맵)
8. [시작하기](#시작하기)
9. [배포 계획](#배포-계획-aws)
10. [보안 정책](#보안-정책)

---

## 프로젝트 개요

Desktop Figures는 사용자가 이미지를 드래그하거나 텍스트로 설명하면 AI(Meshy.ai)가 **진짜 3D 캐릭터 모델(GLB)** 로 생성해 주고, 그 캐릭터가 데스크탑 위에서 React Three Fiber로 실시간 렌더링되며 현재 하는 일(코딩, 공부, 휴식 등)을 3D 애니메이션으로 표현하는 앱이다.

- **3D 네이티브** — 2D PNG가 아닌 GLB 3D 모델 + 내장 애니메이션 클립 재생
- **백그라운드 생성** — 3D 생성은 5~10분 걸리므로 비블로킹으로 요청하고 폴러가 완료 시 반영
- **오프라인 우선** — 모든 데이터/모델은 로컬 SQLite + AppData에 먼저 저장
- **소셜** — 친구가 지금 무엇을 하는지 실시간으로 확인 가능

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    Desktop App (Tauri)                   │
│  React + TypeScript │ Tauri Bridge │ SQLite (로컬 DB)    │
└──────────┬──────────────────────────────────────────────┘
           │ REST                         │ WebSocket
           ▼                             ▼
┌─────────────────────┐     ┌─────────────────────────────┐
│    Auth Server      │     │       Socket Server          │
│  Kotlin + Spring    │     │       Kotlin + Ktor          │
│  (인증, 친구, 동기화) │     │  (실시간 친구 상태 브로드캐스트) │
│  AWS ECS + RDS(PG)  │     │      AWS ECS + NLB           │
└─────────────────────┘     └─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│        Meshy.ai API          │
│  text/image → 3D GLB 모델     │
│  + 애니메이션 클립 생성 (async) │
└─────────────────────────────┘
```

---

## 모노레포 구조

```
desktop-figures/
├── apps/
│   └── desktop/                    # Tauri + React + TypeScript
│       ├── src/                    # React 프론트엔드
│       │   ├── components/
│       │   │   ├── Character/      # 캐릭터 위젯
│       │   │   ├── ActionPanel/    # 행동 관리 UI
│       │   │   ├── FriendWidget/   # 친구 상태 표시
│       │   │   ├── SpeechBubble/   # 말풍선
│       │   │   └── VoiceIcon/      # 음성 아이콘 (5종)
│       │   ├── components/
│       │   │   └── CharacterViewer/ # R3F Canvas — GLB 로드 + 애니메이션 재생
│       │   ├── pages/
│       │   │   ├── Setup/          # 초기 설정 (캐릭터 생성)
│       │   │   ├── Main/           # 메인 위젯 화면
│       │   │   └── Settings/       # 설정 (토큰, 계정)
│       │   ├── hooks/
│       │   │   └── useJobPoller.ts  # Meshy 생성 잡 백그라운드 폴링 (15s)
│       │   ├── store/              # Zustand 상태 관리
│       │   └── lib/
│       │       ├── meshy.ts        # Meshy.ai 3D 생성 API 래퍼
│       │       ├── glbUtils.ts     # GLB 다운로드/저장 + 표시 URL 변환
│       │       ├── sqlite.ts       # 로컬 DB 래퍼
│       │       └── sync.ts         # 서버 동기화
│       └── src-tauri/
│           ├── Cargo.toml
│           └── src/
│               ├── main.rs
│               └── commands/       # Tauri 커맨드 (파일 시스템, 시스템 트레이 등)
│
├── services/
│   ├── auth-server/                # Kotlin + Spring Boot (Gradle 모듈)
│   │   ├── build.gradle.kts
│   │   └── src/main/kotlin/
│   │       ├── auth/               # 인증 (JWT)
│   │       ├── friend/             # 친구 요청/관리
│   │       ├── character/          # 캐릭터 데이터 동기화
│   │       └── sync/               # 클라이언트 동기화 API
│   │
│   └── socket-server/              # Kotlin + Ktor (Gradle 모듈)
│       ├── build.gradle.kts
│       └── src/main/kotlin/
│           ├── session/            # WebSocket 세션 관리
│           └── status/             # 친구 상태 브로드캐스트
│
├── settings.gradle.kts             # Kotlin 서비스 모듈만 포함
├── build.gradle.kts
└── README.md
```

> Tauri 앱은 `npm` + `cargo`로 독립 관리. Gradle 멀티모듈은 Kotlin 서비스(`auth-server`, `socket-server`)만 포함.

---

## 핵심 기능 명세

### 1. 캐릭터 생성

| 단계 | 동작 |
|------|------|
| 입력 | 이미지 드래그 앤 드롭 **또는** 텍스트 설명 |
| 3D 모델 요청 | Meshy.ai `image-to-3d` / `text-to-3d`로 GLB 모델 생성 (async, pending 저장) |
| 후속 애니메이션 | base 모델 완료 시 폴러가 idle/sleep 애니메이션 클립 2건 자동 요청 |
| 로컬 저장 | 완료된 GLB를 AppData에 다운로드, `generation_status = ready` |
| 이름 설정 | 캐릭터 이름 입력 |

- 캐릭터는 1개만 생성 가능 (추후 다중 지원 가능)
- 생성은 5~10분 소요 → **비블로킹**: 즉시 main으로 이동하고 `useJobPoller`(15초)가 완료를 반영
- 의존 잡 시퀀스: **base 모델 → idle + sleep 애니메이션 → ready**

### 2. 행동(Action) 등록

| 필드 | 설명 |
|------|------|
| 이름 | 행동 이름 (e.g., 코딩, 공부, 운동) |
| 애니메이션 | Meshy.ai `animations`로 캐릭터 모델에 행동 전용 애니메이션 클립 생성 (async) |
| 말풍선 텍스트 | 행동 중 표시할 텍스트 (행동 중에도 수정 가능) |
| 음성 파일 | MP3/WAV 첨부 (짧은 구간 반복 루프 지원) |
| 예약 시간 | 특정 시간에 자동 시작 |
| 지속 시간 | 행동 종료 시간 (실시간 카운트다운 표시) |

- 행동은 무제한 등록 가능
- 행동 중: always-on-top 모드 전환 + 타이머 카운트다운 표시

### 3. 데스크탑 위젯 상태 머신

```
[유휴 상태]
 - sleep 애니메이션 GLB 재생 (R3F)
 - "zzz" 말풍선
 - 바탕화면 레이어 (z-index 최하단)

      ▼ 예약된 행동 시작 시간 도달

[행동 중]
 - 행동 전용 애니메이션 GLB 재생 (없으면 idle GLB로 폴백)
 - 말풍선 텍스트 표시 (클릭 → 인라인 편집)
 - 타이머 카운트다운
 - always-on-top 모드 (브라우저보다 전면에 노출)
 - 음성 재생 중이면 음성 아이콘 파형 애니메이션

      ▼ 타이머 종료 또는 수동 종료

[유휴 상태]
```

### 4. 음성 시스템

- 음성 아이콘 5종 준비 (각기 다른 캐릭터 스타일)
- 재생 중: 파형 바 애니메이션 (CSS/SVG)
- 짧은 구간 루프: 지정된 start/end 포인트 반복 재생
- (추후) Vertex AI로 배경 음악 생성 지원 예정

### 5. 설정 화면

- 톱니바퀴 아이콘 → 설정 패널 열기
- Meshy.ai API 키 입력/저장 (Tauri SecureStorage → OS 키체인 / 개발 시 `.env`)
- 기본값: 개발용 키 (환경변수 주입, 소스코드 하드코딩 금지)
- 계정 연결/로그아웃

### 6. 친구 & 소셜

| 시나리오 | 동작 |
|----------|------|
| 비회원 상태 | 앱 모든 기능 사용 가능 (로컬만) |
| 친구 요청 시도 | 회원가입 유도 모달 표시 |
| 회원 전환 | 로컬 SQLite 데이터 → Auth Server 마이그레이션 |
| 친구 수락 후 | Socket Server를 통해 친구 현재 행동 실시간 수신 |
| 친구 위젯 | 내 화면에 친구 캐릭터 + 현재 행동 + 타이머 표시 (작은 크기) |

### 7. 데이터 동기화

| 상태 | 동작 |
|------|------|
| 오프라인 | SQLite에만 저장 |
| 온라인 (회원) | SQLite + Auth Server 동시 저장 (듀얼 라이트) |
| Wi-Fi 재연결 | 로컬 `updated_at` vs 서버 `updated_at` 비교 → 최신 데이터로 덮어쓰기 |
| 충돌 | 서버 타임스탬프 우선 |

---

## Meshy.ai 유스케이스

**모든 생성은 async task 기반이다 — 요청 시 `taskId`를 받아 DB에 `pending`으로 저장하고, `useJobPoller`가 15초 간격으로 폴링하여 완료 시 GLB를 다운로드한다.** 폴링 엔드포인트가 task 종류별로 다르므로 `model_task_type`(text/image)을 함께 저장한다.

### 케이스 1: 캐릭터 모델 생성 (1회)

```
POST /openapi/v2/text-to-3d   (mode: preview, art_style: realistic)   ← 텍스트 입력
POST /openapi/v1/image-to-3d  (image_url: "data:image/png;base64,...") ← 이미지 입력
→ { result: taskId }

폴링 SUCCEEDED → model_urls.glb 다운로드 → base.glb 저장
```

### 케이스 2: 캐릭터 표준 애니메이션 (base 완료 후 자동, 2회)

```
POST /openapi/v1/animations  { model_url, prompt: "<idle | sleep prompt>" }
→ idle.glb, sleep.glb 저장 → 둘 다 완료 시 generation_status = ready
```

### 케이스 3: 행동 애니메이션 (행동 등록 시마다)

```
POST /openapi/v1/animations  { model_url, prompt: "character <행동 이름>, looping motion" }
→ actions/<id>.glb 저장
```

> ⚠️ `text-to-3d`의 `art_style`은 `realistic`만 허용된다(미리보기 모드). `image-to-3d`는 `data:` URL을 정상 수락한다(실측 확인).

---

## 데이터 모델

### 로컬 SQLite (앱 내부)

```sql
CREATE TABLE characters (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    model_path          TEXT,            -- base.glb 로컬 경로
    model_remote_url    TEXT,            -- Meshy CDN GLB URL (애니메이션 생성 입력)
    model_task_type     TEXT NOT NULL DEFAULT 'text',  -- text | image (폴링 엔드포인트 분기)
    idle_anim_path      TEXT,            -- idle.glb
    sleep_anim_path     TEXT,            -- sleep.glb
    generation_status   TEXT NOT NULL DEFAULT 'pending', -- pending | ready | failed
    meshy_task_id       TEXT,            -- base 모델 task
    idle_meshy_task_id  TEXT,
    sleep_meshy_task_id TEXT,
    server_id           TEXT,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL,
    synced_at           INTEGER
);

CREATE TABLE actions (
    id                TEXT PRIMARY KEY,
    character_id      TEXT NOT NULL REFERENCES characters(id),
    name              TEXT NOT NULL,
    animation_path    TEXT,             -- 행동 애니메이션 GLB 로컬 경로
    generation_status TEXT NOT NULL DEFAULT 'pending', -- pending | ready | failed
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
);

CREATE TABLE user_profile (
    id           TEXT PRIMARY KEY,
    email        TEXT NOT NULL,
    nickname     TEXT NOT NULL,
    access_token TEXT,
    created_at   INTEGER NOT NULL
);
```

### Auth Server DB (PostgreSQL)

```sql
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nickname      VARCHAR(100) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE characters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    name            VARCHAR(100) NOT NULL,
    model_url       TEXT NOT NULL,   -- base GLB (S3)
    idle_anim_url   TEXT,            -- idle GLB
    sleep_anim_url  TEXT,            -- sleep GLB
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE actions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id     UUID NOT NULL REFERENCES characters(id),
    name             VARCHAR(100) NOT NULL,
    animation_url    TEXT NOT NULL,   -- 행동 애니메이션 GLB (S3)
    speech_bubble    TEXT,
    scheduled_at     TIMESTAMPTZ,
    duration_minutes INTEGER,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE friendships (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES users(id),
    receiver_id  UUID NOT NULL REFERENCES users(id),
    status       VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | accepted | blocked
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Socket Server (In-Memory / Redis)

```json
{
  "user_id": "uuid",
  "character_id": "uuid",
  "current_action": {
    "action_id": "uuid",
    "name": "코딩",
    "speech_bubble": "코딩 코딩 코딩",
    "started_at": 1716638400,
    "ends_at": 1716641400
  }
}
```

---

## 브랜치 전략 & 개발 로드맵

- `main`: 프로덕션 브랜치
- `develop`: 통합 브랜치
- `feature/*`: 기능 개발 → `develop`으로 PR

### Phase 1: 데스크탑 앱 코어

| 브랜치 | 내용 | PR |
|--------|------|----|
| `feature/project-restructure` | 모노레포 디렉토리 구조 세팅 + Gradle 멀티모듈 재구성 | #1 |
| `feature/tauri-app-init` | Tauri + React + TypeScript + Zustand 초기화 | #2 |
| `feature/local-db-setup` | SQLite 스키마 + `tauri-plugin-sql` 연동 | #3 |
| `feature/character-creation` | 드래그 앤 드롭 UI + Vertex AI 캐릭터 생성 플로우 | #4 |
| `feature/action-management` | 행동 CRUD + 예약 스케줄러 | #5 |
| `feature/desktop-widget` | Always-on-top 전환 + 수면 애니메이션 + 타이머 UI | #6 |
| `feature/speech-bubble` | 말풍선 컴포넌트 + 인라인 편집 | #7 |
| `feature/voice-system` | 음성 파일 첨부 + 5종 아이콘 + 파형 애니메이션 | #8 |
| `feature/settings` | 설정 화면 (Vertex AI 토큰 관리) | #9 |

### Phase 1.5: 3D 전환 (진행)

| 브랜치 | 내용 | PR |
|--------|------|----|
| `feature/3d-character` | Vertex AI 2D PNG → Meshy.ai 3D GLB + React Three Fiber 렌더링 전환 (캐릭터/행동 생성, 백그라운드 폴러, DB 마이그레이션) | — |

### Phase 2: 백엔드 서비스

| 브랜치 | 내용 | PR |
|--------|------|----|
| `feature/auth-server-init` | Spring Boot 멀티모듈 초기화 + JWT 인증 기반 | #10 |
| `feature/auth-api` | 회원가입 / 로그인 / 토큰 갱신 API | #11 |
| `feature/character-sync-api` | 캐릭터 + 행동 데이터 동기화 API | #12 |
| `feature/friend-api` | 친구 요청 / 수락 / 목록 API | #13 |
| `feature/socket-server-init` | Ktor WebSocket 서버 초기화 + 세션 관리 | #14 |
| `feature/friend-status-broadcast` | 행동 시작/종료 시 친구 상태 브로드캐스트 | #15 |

### Phase 3: 소셜 & 동기화

| 브랜치 | 내용 | PR |
|--------|------|----|
| `feature/guest-to-member` | 비회원→회원 전환 UI + 로컬 데이터 서버 마이그레이션 | #16 |
| `feature/data-sync` | 듀얼 라이트 + Wi-Fi 재연결 시 동기화 로직 | #17 |
| `feature/friend-widget` | 친구 캐릭터 현재 행동 표시 위젯 | #18 |

### Phase 4: 배포 준비

| 브랜치 | 내용 | PR |
|--------|------|----|
| `feature/app-store-prep` | macOS 코드 사이닝 + notarization + 앱스토어 메타데이터 | #19 |
| `feature/aws-infra` | ECS Fargate + RDS + S3 + NLB 인프라 설정 | #20 |

---

## 시작하기

### 사전 준비

| 도구 | 버전 |
|------|------|
| Node.js | 20+ |
| Rust | stable |
| JDK | 17+ |
| Gradle | 8+ |

### Desktop 앱 실행

```bash
cd apps/desktop
npm install
npm run tauri dev
```

### Auth Server 실행

```bash
./gradlew :services:auth-server:bootRun
```

### Socket Server 실행

```bash
./gradlew :services:socket-server:run
```

### 환경변수

```bash
# apps/desktop/.env
VITE_MESHY_API_KEY=your_meshy_api_key_here   # https://www.meshy.ai/api/keys (발급/검증 가이드: docs/meshy-setup.md)
VITE_AUTH_SERVER_URL=http://localhost:8080
VITE_SOCKET_SERVER_URL=ws://localhost:9090

# services/auth-server/.env
DATABASE_URL=jdbc:postgresql://localhost:5432/desktop_figures
JWT_SECRET=your_jwt_secret
AWS_S3_BUCKET=desktop-figures-assets

# services/socket-server/.env
AUTH_SERVER_URL=http://localhost:8080
```

---

## 배포 계획 (AWS)

```
[macOS/Windows 클라이언트]
        │
        ├── HTTPS ──► ALB ──► ECS Fargate (auth-server)
        │                          │
        │                         RDS PostgreSQL
        │                          │
        │                         S3 (이미지 저장)
        │
        └── WSS ───► NLB ──► ECS Fargate (socket-server)
```

| 컴포넌트 | AWS 서비스 |
|----------|-----------|
| Auth Server | ECS Fargate + ALB |
| Socket Server | ECS Fargate + NLB (TCP/WebSocket) |
| Database | RDS PostgreSQL |
| 이미지 저장 | S3 + CloudFront |
| 컨테이너 이미지 | ECR |
| 시크릿 관리 | AWS Secrets Manager |

---

## 보안 정책

- **JWT**: Access Token 15분 / Refresh Token 7일
- **Meshy.ai API 키**: Tauri SecureStorage (OS 키체인) 저장. 소스코드 하드코딩 금지. 개발 시 `.env` 환경변수 주입
- **비밀번호**: bcrypt 해싱
- **이미지**: S3 Presigned URL
- **WebSocket**: 연결 시 JWT 검증

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Desktop UI | React + TypeScript + Tailwind CSS |
| Desktop 런타임 | Tauri (Rust) |
| 3D 렌더링 | three.js + @react-three/fiber + @react-three/drei |
| 로컬 DB | SQLite (`tauri-plugin-sql`) |
| 상태 관리 | Zustand |
| 3D 생성 AI | Meshy.ai (text/image → GLB, animations) |
| Auth Server | Kotlin + Spring Boot 3 |
| Socket Server | Kotlin + Ktor |
| Server DB | PostgreSQL |
| 빌드 도구 | Gradle (Kotlin DSL) |
| 클라우드 | AWS (ECS, RDS, S3, ECR) |
| CI/CD | GitHub Actions |
