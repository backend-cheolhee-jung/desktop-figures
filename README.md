# Desktop Figures 🐾

데스크탑 위에 나만의 귀여운 AI 캐릭터를 올려놓고, 현재 하는 일을 실시간으로 친구와 공유하는 데스크탑 컴패니언 앱.

> 캐릭터가 말풍선과 타이머를 달고 바탕화면에 앉아 있고, 친구 캐릭터도 작게 옆에 표시된다.

---

## 구현 현황

| 영역 | 상태 | 비고 |
|------|------|------|
| Desktop 앱 (Tauri + React) | ✅ 완료 | 위젯, 행동 스케줄러, 타이머 |
| auth-server (회원 가입/로그인/승인) | ✅ 완료 | Spring Boot + JPA + Flyway |
| admin-server (운영자 승인 UI) | ✅ 완료 | Spring Boot + JDBC template |
| 3D 캐릭터 시스템 (Meshy.ai + R3F) | 🚧 진행 중 | `feature/3d-character` 브랜치 |
| 소셜/친구 기능 | 📋 TODO | |
| 데이터 동기화 (듀얼 라이트) | 📋 TODO | |
| Socket Server | 📋 TODO | |
| AWS 배포 | 📋 TODO | |

---

## 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [모노레포 구조](#모노레포-구조)
4. [핵심 기능 명세](#핵심-기능-명세)
5. [데이터 모델](#데이터-모델)
6. [개발 로드맵](#개발-로드맵)
7. [시작하기](#시작하기)
8. [배포 계획](#배포-계획-aws)
9. [보안 정책](#보안-정책)

---

## 프로젝트 개요

Desktop Figures는 텍스트로 캐릭터를 설명하면 AI(Meshy.ai)가 3D 모델을 생성하고, 그 캐릭터가 데스크탑 위에서 현재 하는 일을 표현하는 앱이다.

- **회원가입 → 운영자 승인 후 AI 생성 기능 사용 가능**
- **오프라인 우선** — 모든 데이터는 로컬 SQLite에 먼저 저장
- **소셜** — 친구가 지금 무엇을 하는지 실시간으로 확인 가능 *(TODO)*

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    Desktop App (Tauri)                   │
│  React + TypeScript │ Tauri Bridge │ SQLite (로컬 DB)    │
└──────────┬──────────────────────────────────────────────┘
           │ REST
           ▼
┌─────────────────────┐     ┌─────────────────────────────┐
│    auth-server      │     │       Socket Server          │
│  Kotlin + Spring    │     │       Kotlin + Ktor          │
│  (인증, 승인 게이트)  │     │  (실시간 친구 상태 브로드캐스트) │ ← TODO
│  PostgreSQL + JPA   │     │      AWS ECS + NLB           │
└─────────────────────┘     └─────────────────────────────┘

┌─────────────────────┐
│    admin-server     │
│  Kotlin + Spring    │
│  (운영자 승인 UI)    │
│  JDBC template      │
└─────────────────────┘

<!-- TODO: Meshy.ai 호출을 클라이언트에서 auth-server 프록시로 이전
┌─────────────────────────────┐
│        Meshy.ai API          │
│  text → 3D GLB + 애니메이션  │
└─────────────────────────────┘
-->
```

---

## 모노레포 구조

```
desktop-figures/
├── apps/
│   └── desktop/                    # Tauri + React + TypeScript
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   │   ├── Setup/          # 캐릭터 생성
│       │   │   ├── Main/           # 메인 위젯
│       │   │   ├── ActionPanel/    # 행동 관리
│       │   │   ├── ActionForm/     # 행동 추가/수정
│       │   │   └── Settings/       # 설정
│       │   ├── hooks/
│       │   ├── store/              # Zustand 상태 관리
│       │   └── lib/
│       │       ├── sqlite.ts       # 로컬 DB 래퍼
│       │       └── sync.ts         # 서버 동기화 (TODO)
│       └── src-tauri/
│
├── services/
│   ├── auth-server/                # ✅ Kotlin + Spring Boot + JPA
│   │   └── src/main/kotlin/
│   │       ├── user/               # 회원가입, 로그인, JWT
│   │       ├── jwt/                # JWT 제공자
│   │       └── config/             # Security, ExceptionHandler
│   │
│   ├── admin-server/               # ✅ Kotlin + Spring Boot + JDBC template
│   │   └── src/main/kotlin/
│   │       ├── dao/                # JDBC: admin_users, users 조회
│   │       ├── service/            # 승인/거절 비즈니스 로직
│   │       ├── web/                # REST 컨트롤러
│   │       └── config/             # Properties, Security
│   │
│   └── socket-server/              # 📋 TODO: Kotlin + Ktor
│
├── settings.gradle.kts
├── build.gradle.kts
└── README.md
```

---

## 핵심 기능 명세

### ✅ 1. 캐릭터 생성

| 단계 | 동작 |
|------|------|
| 텍스트 입력 | 캐릭터 설명 + 이름 입력 |
| AI 생성 요청 | Meshy.ai `text-to-3d` 비동기 요청 (pending 저장 후 즉시 main으로 이동) |
| 백그라운드 폴링 | `useJobPoller`가 15초 간격으로 완료 확인 → GLB 다운로드 |
| 애니메이션 생성 | base 모델 완료 시 idle/sleep 애니메이션 자동 요청 |

> **TODO:** Meshy.ai 호출을 auth-server 프록시로 이전 (현재는 클라이언트 직접 호출)

### ✅ 2. 행동(Action) 등록

| 필드 | 설명 |
|------|------|
| 이름 | 행동 이름 (코딩, 공부, 운동 등) |
| 애니메이션 | Meshy.ai로 캐릭터 전용 행동 애니메이션 생성 (비동기) |
| 말풍선 텍스트 | 행동 중 표시할 텍스트 |
| 음성 파일 | MP3/WAV 첨부 (짧은 구간 반복 루프 지원) |
| 예약 시간 | 특정 시간에 자동 시작 |
| 지속 시간 | 행동 종료 시간 (카운트다운 표시) |

### ✅ 3. 회원제 + 운영자 승인

```
회원가입 (PENDING)
    │
    └── 운영자가 admin-server UI에서 승인
              │
              ▼
         APPROVED → 로그인 허용, AI 생성 기능 사용 가능
         REJECTED → 로그인 차단, 거절 사유 안내
```

- `auth-server` (:8080): register / login / me / refresh
- `admin-server` (:8081): 운영자 로그인 + 가입 목록 승인/거절 웹 UI

### ✅ 4. 데스크탑 위젯 상태 머신

```
[유휴 상태]
 - sleep 애니메이션 GLB 재생
 - "zzz" 말풍선

      ▼ 예약된 행동 시작 시간 도달

[행동 중]
 - 행동 전용 애니메이션 GLB 재생
 - 말풍선 텍스트 표시
 - 타이머 카운트다운
 - always-on-top 모드

      ▼ 타이머 종료 또는 수동 종료

[유휴 상태]
```

### 📋 5. 소셜 / 친구 기능 *(TODO)*

<!--
| 시나리오 | 동작 |
|----------|------|
| 친구 요청 시도 | 회원가입 유도 모달 표시 |
| 회원 전환 | 로컬 SQLite 데이터 → Auth Server 마이그레이션 |
| 친구 수락 후 | Socket Server를 통해 친구 현재 행동 실시간 수신 |
| 친구 위젯 | 내 화면에 친구 캐릭터 + 현재 행동 + 타이머 표시 (작은 크기) |
-->

### 📋 6. 데이터 동기화 *(TODO)*

<!--
| 상태 | 동작 |
|------|------|
| 오프라인 | SQLite에만 저장 |
| 온라인 (회원) | SQLite + Auth Server 동시 저장 (듀얼 라이트) |
| Wi-Fi 재연결 | 로컬 updated_at vs 서버 updated_at 비교 → 최신 데이터로 덮어쓰기 |
| 충돌 | 서버 타임스탬프 우선 |
-->

---

## 데이터 모델

### 로컬 SQLite (앱 내부)

```sql
CREATE TABLE characters (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    model_path          TEXT,            -- base GLB 로컬 경로
    model_remote_url    TEXT,            -- Meshy CDN URL
    model_task_type     TEXT NOT NULL DEFAULT 'text',
    idle_anim_path      TEXT,
    sleep_anim_path     TEXT,
    generation_status   TEXT NOT NULL DEFAULT 'pending', -- pending | ready | failed
    meshy_task_id       TEXT,
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
);
```

### Auth Server DB (PostgreSQL)

```sql
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nickname      VARCHAR(100) NOT NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | REJECTED
    reject_reason TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE admin_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- TODO: 친구/소셜 기능 구현 시 추가
-- CREATE TABLE friendships ( ... );
-- CREATE TABLE characters_server ( ... );
-- CREATE TABLE actions_server ( ... );
```

### Socket Server *(TODO)*

<!--
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
-->

---

## 개발 로드맵

### ✅ Phase 1: 데스크탑 앱 코어

| PR | 내용 |
|----|------|
| #1 | 모노레포 디렉토리 구조 세팅 |
| #2 | Tauri + React + TypeScript + Zustand 초기화 |
| #3 | SQLite 스키마 + `tauri-plugin-sql` 연동 |
| #4 | 캐릭터 생성 플로우 (Vertex AI → 현재는 Meshy.ai로 교체 예정) |
| #5 | 행동 CRUD + 예약 스케줄러 |
| #6 | Always-on-top 전환 + 수면 애니메이션 + 타이머 UI |

### ✅ Phase 2: 회원제 + 운영자 승인

| PR | 내용 |
|----|------|
| #7 | auth-server: 회원가입/로그인 + 승인 게이트 (Flyway + JPA) |
| #8 | admin-server: 운영자 승인 UI (JDBC template + 웹 UI) |
| #9 | Desktop: 로그인/가입 모달 + 생성 기능 게이트 |

### 🚧 Phase 2.5: 3D 캐릭터 시스템

| 브랜치 | 내용 |
|--------|------|
| `feature/3d-character` | Meshy.ai GLB + React Three Fiber 렌더링, 백그라운드 폴러 |

> **TODO (Phase 2.5 내):** Meshy 애니메이션 API 올바른 플로우 구현 (`rig_task_id` + `action_id`)

### 📋 Phase 3: 소셜 & 동기화 *(TODO)*

<!--
| 브랜치 | 내용 |
|--------|------|
| `feature/auth-api-ext` | 친구 요청 / 수락 / 목록 API |
| `feature/socket-server-init` | Ktor WebSocket 서버 초기화 + 세션 관리 |
| `feature/friend-status-broadcast` | 행동 시작/종료 시 친구 상태 브로드캐스트 |
| `feature/guest-to-member` | 비회원→회원 전환 UI + 로컬 데이터 마이그레이션 |
| `feature/data-sync` | 듀얼 라이트 + Wi-Fi 재연결 시 동기화 로직 |
| `feature/friend-widget` | 친구 캐릭터 현재 행동 표시 위젯 |
-->

### 📋 Phase 4: 배포 준비 *(TODO)*

<!--
| 브랜치 | 내용 |
|--------|------|
| `feature/app-store-prep` | macOS 코드 사이닝 + notarization |
| `feature/aws-infra` | ECS Fargate + RDS + S3 + NLB 인프라 설정 |
-->

---

## 시작하기

### 사전 준비

| 도구 | 버전 |
|------|------|
| Node.js | 20+ |
| Rust | stable |
| JDK | 17+ |
| Gradle | 8+ |
| PostgreSQL | 15+ |

### Desktop 앱 실행

```bash
cd apps/desktop
cp .env.example .env   # VITE_MESHY_API_KEY, VITE_AUTH_SERVER_URL 설정
npm install
npm run tauri dev
```

### Auth Server 실행

```bash
# PostgreSQL 기동 후 (DB: desktop_figures)
./gradlew :services:auth-server:bootRun
```

### Admin Server 실행

```bash
./gradlew :services:admin-server:bootRun
# 브라우저: http://localhost:8081
# 초기 운영자 계정: ADMIN_SEED_USERNAME / ADMIN_SEED_PASSWORD 환경변수로 설정
```

### 환경변수

```bash
# apps/desktop/.env
VITE_MESHY_API_KEY=your_meshy_api_key   # https://www.meshy.ai/api/keys
VITE_AUTH_SERVER_URL=http://localhost:8080

# services/auth-server (application-local.yml)
DATABASE_URL=jdbc:postgresql://localhost:5432/desktop_figures
JWT_SECRET_ENC=...
JASYPT_ENCRYPTOR_PASSWORD=...

# services/admin-server (환경변수)
DATABASE_URL=jdbc:postgresql://localhost:5432/desktop_figures
ADMIN_JWT_SECRET_ENC=...
ADMIN_SEED_USERNAME=operator
ADMIN_SEED_PASSWORD=...
JASYPT_ENCRYPTOR_PASSWORD=...
```

---

## 배포 계획 (AWS) *(TODO)*

<!--
```
[macOS/Windows 클라이언트]
        │
        ├── HTTPS ──► ALB ──► ECS Fargate (auth-server)
        │                          │
        │                         RDS PostgreSQL
        │
        ├── HTTPS ──► ALB ──► ECS Fargate (admin-server)
        │
        └── WSS ───► NLB ──► ECS Fargate (socket-server)
```

| 컴포넌트 | AWS 서비스 |
|----------|-----------|
| Auth Server | ECS Fargate + ALB |
| Admin Server | ECS Fargate + ALB (사내망 제한 권장) |
| Socket Server | ECS Fargate + NLB (TCP/WebSocket) |
| Database | RDS PostgreSQL |
| 컨테이너 이미지 | ECR |
| 시크릿 관리 | AWS Secrets Manager |
-->

---

## 보안 정책

- **JWT**: Access Token 15분 / Refresh Token 7일 (회원/운영자 시크릿 분리)
- **비밀번호**: bcrypt 해싱 (회원 + 운영자 모두)
- **민감값**: Jasypt `ENC(...)` + `JASYPT_ENCRYPTOR_PASSWORD` 환경변수
- **Meshy API 키**: `.env` (개발) / 추후 Tauri SecureStorage로 이전 예정 *(TODO)*
- **WebSocket**: 연결 시 JWT 검증 *(TODO)*

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Desktop UI | React + TypeScript + Tailwind CSS |
| Desktop 런타임 | Tauri (Rust) |
| 3D 렌더링 | three.js + @react-three/fiber (진행 중) |
| 로컬 DB | SQLite (`tauri-plugin-sql`) |
| 상태 관리 | Zustand |
| 3D 생성 AI | Meshy.ai (진행 중) |
| Auth Server | Kotlin + Spring Boot 3 + JPA |
| Admin Server | Kotlin + Spring Boot 3 + JDBC template |
| Socket Server | Kotlin + Ktor *(TODO)* |
| Server DB | PostgreSQL + Flyway |
| 빌드 도구 | Gradle (Kotlin DSL) |
| 클라우드 | AWS (ECS, RDS, ECR) *(TODO)* |
| CI/CD | GitHub Actions *(TODO)* |
