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

Desktop Figures는 사용자가 이미지를 드래그하면 AI(Vertex AI Imagen)가 귀여운 3D 캐릭터로 변환해 주고, 그 캐릭터가 데스크탑 위에서 현재 하는 일(코딩, 공부, 휴식 등)을 실시간으로 표현하는 앱이다.

- **비회원도 완전 사용 가능** — 친구 기능만 회원가입 필요
- **오프라인 우선** — 모든 데이터는 로컬 SQLite에 먼저 저장
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
┌─────────────────────┐
│  Vertex AI Imagen   │
│  (캐릭터 이미지 생성) │
└─────────────────────┘
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
│       │   ├── pages/
│       │   │   ├── Setup/          # 초기 설정 (캐릭터 생성)
│       │   │   ├── Main/           # 메인 위젯 화면
│       │   │   └── Settings/       # 설정 (토큰, 계정)
│       │   ├── hooks/
│       │   ├── store/              # Zustand 상태 관리
│       │   └── lib/
│       │       ├── llm.ts          # Vertex AI 요청
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
| 이미지 드래그 앤 드롭 | 사용자 이미지를 앱 위에 드래그 |
| LLM 요청 | Vertex AI에 "귀여운 3D 클레이 캐릭터" 스타일로 변환 요청 |
| 이미지 저장 | 기본 이미지 + 수면 이미지 동시 생성 → 로컬 저장 |
| 이름 설정 | 캐릭터 이름 입력 |

- 캐릭터는 1개만 생성 가능 (추후 다중 지원 가능)
- 수면 이미지는 캐릭터 생성 시 **항상 함께 생성** (별도 LLM 호출 없이 동일 요청에 포함)

### 2. 행동(Action) 등록

| 필드 | 설명 |
|------|------|
| 이름 | 행동 이름 (e.g., 코딩, 공부, 운동) |
| 캐릭터 이미지 | Vertex AI로 행동 전용 이미지 생성 |
| 말풍선 텍스트 | 행동 중 표시할 텍스트 (행동 중에도 수정 가능) |
| 음성 파일 | MP3/WAV 첨부 (짧은 구간 반복 루프 지원) |
| 예약 시간 | 특정 시간에 자동 시작 |
| 지속 시간 | 행동 종료 시간 (실시간 카운트다운 표시) |

- 행동은 무제한 등록 가능
- 행동 중: always-on-top 모드 전환 + 타이머 카운트다운 표시

### 3. 데스크탑 위젯 상태 머신

```
[유휴 상태]
 - 수면 애니메이션 (CSS keyframe)
 - "zzz" 말풍선
 - 바탕화면 레이어 (z-index 최하단)

      ▼ 예약된 행동 시작 시간 도달

[행동 중]
 - 행동 전용 이미지 표시
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
- Vertex AI API 토큰 입력/저장 (Tauri SecureStorage → OS 키체인)
- 기본값: 개발용 토큰 (환경변수 주입, 소스코드 하드코딩 금지)
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

## LLM 유스케이스

**Vertex AI에 요청하는 경우는 2가지뿐.**

### 케이스 1: 캐릭터 등록

```
입력:
  - 사용자 이미지 (base64)
  - 프롬프트: "이 이미지를 참고하여 귀엽고 통통한 3D 클레이 스타일 캐릭터를 만들어주세요.
               배경 없음(투명), PNG 포맷.
               결과 2장: ①기본 포즈 ②눈 감고 자는 포즈"

출력:
  - base_image.png  (기본 포즈)
  - sleep_image.png (수면 포즈)
```

### 케이스 2: 행동 등록

```
입력:
  - 기본 캐릭터 이미지 (base64)
  - 프롬프트: "이 캐릭터가 [행동 이름]을 하는 모습을 만들어주세요.
               배경 없음(투명), PNG 포맷."

출력:
  - action_image.png (행동 전용 포즈)
```

---

## 데이터 모델

### 로컬 SQLite (앱 내부)

```sql
CREATE TABLE characters (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    base_image_path  TEXT NOT NULL,
    sleep_image_path TEXT NOT NULL,
    server_id        TEXT,
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL,
    synced_at        INTEGER
);

CREATE TABLE actions (
    id                TEXT PRIMARY KEY,
    character_id      TEXT NOT NULL REFERENCES characters(id),
    name              TEXT NOT NULL,
    action_image_path TEXT NOT NULL,
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
    base_image_url  TEXT NOT NULL,
    sleep_image_url TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE actions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id     UUID NOT NULL REFERENCES characters(id),
    name             VARCHAR(100) NOT NULL,
    action_image_url TEXT NOT NULL,
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
VITE_VERTEX_AI_TOKEN=your_vertex_ai_token_here
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
- **Vertex AI 토큰**: Tauri SecureStorage (OS 키체인) 저장. 소스코드 하드코딩 금지. 개발 시 환경변수 주입
- **비밀번호**: bcrypt 해싱
- **이미지**: S3 Presigned URL
- **WebSocket**: 연결 시 JWT 검증

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Desktop UI | React + TypeScript + Tailwind CSS |
| Desktop 런타임 | Tauri (Rust) |
| 로컬 DB | SQLite (`tauri-plugin-sql`) |
| 상태 관리 | Zustand |
| LLM | Vertex AI Imagen |
| Auth Server | Kotlin + Spring Boot 3 |
| Socket Server | Kotlin + Ktor |
| Server DB | PostgreSQL |
| 빌드 도구 | Gradle (Kotlin DSL) |
| 클라우드 | AWS (ECS, RDS, S3, ECR) |
| CI/CD | GitHub Actions |
