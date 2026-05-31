# 회원제 + 운영자 승인 + Admin 서버 설계 (Design Spec)

**작성일:** 2026-05-31
**상태:** 승인됨 (구현 전)

## 목표

AI 다운로드(3D 캐릭터/행동 생성) 기능을 **승인된 회원에게만** 허용한다. 흐름은 **회원가입 → 운영자(admin) 컨펌 → 로그인 가능**이다. 운영자 승인 워크플로우를 위한 **별도 admin-server**를 신규 구축한다.

## 비목표 (Out of Scope)

- 친구/소셜 기능, 데이터 동기화(듀얼 라이트)
- 이메일 인증 / 가입 알림 메일
- 본격 admin 대시보드(차트, 통계, 회원 검색 고도화)
- Meshy 호출의 서버 프록시 이전 → **아래 TODO 참고 (이번 범위 아님)**

## 🔭 TODO (목표 아키텍처, 이번 범위 보류)

"AI 다운로드 회원 한정"의 **견고한** 강제는 Meshy 호출을 서버로 옮기는 것이다:
- 데스크탑이 JWT로 auth-server에 3D 생성을 요청 → 서버가 회원/승인 검증 후 **서버 보관 Meshy 키**로 호출 → taskId 반환, 폴링도 서버 경유
- 이렇게 하면 API 키가 클라이언트에서 사라지고 우회가 불가능해진다.

이번 구현에서는 **QA를 막지 않기 위해** Meshy 호출을 현행 클라이언트 직접 방식으로 유지하고, 회원 한정은 **UI 기능 게이트**로 잠정 강제한다. 위 서버 프록시 이전은 후속 작업으로 남긴다.

---

## 아키텍처 / 토폴로지

```
┌───────────────────┐   REST    ┌──────────────────────────┐
│   Desktop App     │──────────►│  auth-server             │
│  (Tauri + React)  │  회원가입  │  Spring Boot + JPA :8080  │
│                   │  로그인    │  (users 소유)             │
└───────────────────┘  내 상태   └────────────┬─────────────┘
                                              │ 공유
┌───────────────────┐   REST                 ▼
│  운영자 브라우저    │──────────►┌──────────────────────────┐
│  (admin 웹 UI 1장) │  승인/거절 │  PostgreSQL              │
└───────────────────┘           │  desktop_figures         │
                                 │  users / admin_users     │
                                 └────────────▲─────────────┘
                                              │ JDBC template
                                 ┌────────────┴─────────────┐
                                 │  admin-server            │
                                 │  Spring Boot + JDBC :8081 │
                                 │  (admin_users 소유,       │
                                 │   users.status 갱신)      │
                                 └──────────────────────────┘
```

- **하나의 PostgreSQL(`desktop_figures`)을 두 서버가 공유**한다.
  - `auth-server`: `users` 테이블을 **JPA**로 소유 (가입/로그인/상태 조회).
  - `admin-server`: **JDBC template**으로 `users`를 조회하고 `users.status`/`reject_reason`을 갱신(승인/거절). 자체 `admin_users` 테이블 소유.
- 공유 DB 결합을 인지하되 이 규모에선 서버 간 API 호출보다 단순해 채택한다. (대안: admin이 auth 내부 API를 호출 — 후속 TODO 후보)
- 포트: auth-server `8080`(기존), admin-server `8081`(신규).

---

## 데이터 모델 (PostgreSQL)

### auth-server 소유 — JPA 엔티티

```sql
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nickname      VARCHAR(100) NOT NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'PENDING',  -- PENDING | APPROVED | REJECTED
    reject_reason TEXT,                                     -- REJECTED 시 사유 (그 외 NULL)
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

### admin-server 소유 — JDBC template

```sql
CREATE TABLE admin_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

- **스키마 생성 책임 (중요):** 현재 `auth-server`의 `application.yml`은 `ddl-auto: validate`라 JPA가 테이블을 **생성하지 않는다**(존재 검증만). 따라서 스키마는 명시적 SQL로 만든다:
  - 개발 환경: 각 서버 리소스에 `schema.sql`을 두고 부트 시 실행(Spring `sql.init`). `users`는 auth-server `schema.sql`, `admin_users`는 admin-server `schema.sql`이 생성.
  - 두 서버가 같은 DB를 보므로 **테이블 생성 책임을 분리**한다 — `users`는 auth-server, `admin_users`는 admin-server. (admin-server는 `users`를 생성하지 않고 조회/갱신만.)
  - 운영 환경: Flyway 등 마이그레이션 도구 도입(인프라 단계 TODO). 이번 범위는 `schema.sql` 수준.
- 운영자 시드: admin-server 부트스트랩 시 `ADMIN_SEED_USERNAME` / `ADMIN_SEED_PASSWORD` 환경변수가 있으면 `admin_users`에 없을 때 1명 생성(bcrypt 해싱).

### 상태 머신 (users.status)

```
[가입]          POST /auth/register
   │
   ▼
PENDING ──운영자 승인──► APPROVED   (로그인 허용)
   │
   └────운영자 거절──► REJECTED   (로그인 차단 + reject_reason 안내)
```

---

## API 명세

### auth-server (`:8080`)

| 메서드 | 경로 | 인증 | 요청 | 응답 |
|---|---|---|---|---|
| POST | `/auth/register` | - | `{email, password, nickname}` | `201` `{userId, status:"PENDING"}` / `409` 이메일 중복 |
| POST | `/auth/login` | - | `{email, password}` | `200` `{accessToken, refreshToken}` (APPROVED만) / `403` `{status, rejectReason?}` / `401` 자격 불일치 |
| GET | `/auth/me` | JWT | - | `200` `{userId, email, nickname, status}` |
| POST | `/auth/refresh` | - | `{refreshToken}` | `200` `{accessToken}` |

- 비밀번호: **bcrypt** 해싱.
- JWT: 기존 `application.yml` 설정 재사용(access 15분 / refresh 7일).
- 로그인 게이트: `status == APPROVED`만 토큰 발급. `PENDING`/`REJECTED`는 `403`과 상태 정보 반환(클라이언트 안내용).

### admin-server (`:8081`)

| 메서드 | 경로 | 인증 | 요청 | 응답 |
|---|---|---|---|---|
| POST | `/admin/login` | - | `{username, password}` | `200` `{adminToken}` / `401` |
| GET | `/admin/registrations?status=PENDING` | admin JWT | - | `200` `[{userId, email, nickname, status, createdAt}]` |
| POST | `/admin/registrations/{userId}/approve` | admin JWT | - | `200` (users.status → APPROVED) |
| POST | `/admin/registrations/{userId}/reject` | admin JWT | `{reason}` | `200` (users.status → REJECTED, reject_reason 저장) |
| GET | `/` | - | - | 최소 웹 UI(정적 HTML 1장) |

- admin 인증: 자체 JWT(또는 세션). 회원 JWT와 분리.
- 웹 UI: 정적 HTML 한 페이지 + 바닐라 `fetch`. 로그인 폼 → 신청 목록 테이블 → 행마다 [승인][거절] 버튼. 별도 프론트 빌드 없음.
- `users` 갱신은 JDBC template `UPDATE users SET status=?, reject_reason=?, updated_at=now() WHERE id=?`.

---

## 데스크탑 통합 (기능 게이트)

### 신규 요소
- `store/authStore.ts` — `{ accessToken, refreshToken, me: {status,...} | null }` + 로그인/로그아웃 액션.
- `lib/authApi.ts` — register/login/me/refresh 호출 래퍼 (`VITE_AUTH_SERVER_URL`).
- 로그인/가입 모달 컴포넌트 — 탭 전환(로그인 ↔ 가입), 상태별 안내.
- 토큰 저장: Tauri SecureStorage(가능 시) 또는 잠정 `user_profile` 테이블에 저장(이미 존재하는 테이블 활용).

### 게이트 동작
캐릭터/행동 **"생성" 버튼 클릭 시**:
1. 유효 토큰 없음 → 로그인/가입 모달.
2. 로그인 성공 + `APPROVED` → 기존 생성 플로우(Meshy 호출) 그대로 진행.
3. `PENDING` → "운영자 승인 대기 중이에요" 안내, 생성 차단.
4. `REJECTED` → `rejectReason` 안내, 생성 차단.

### 변경 지점
- `pages/Setup/index.tsx`(캐릭터 생성), `pages/ActionForm/index.tsx`(행동 생성)의 생성 진입부에 게이트 체크 삽입.
- 위젯 열람/기존 캐릭터 표시는 로그인 불필요(기능 게이트 원칙).

---

## 보안

- 비밀번호: bcrypt (회원/운영자 모두).
- JWT: 회원(auth-server)과 운영자(admin-server) **분리된 시크릿/발급자**.
- 민감값: 기존 패턴대로 **Jasypt `ENC(...)`** + `JASYPT_ENCRYPTOR_PASSWORD` 환경변수. Meshy/JWT/DB 비밀번호 하드코딩 금지.
- admin-server 노출 최소화(운영자 전용). 운영 환경에서는 사내망/IP 제한 권장(인프라 단계 TODO).

---

## 환경변수

```bash
# apps/desktop/.env
VITE_AUTH_SERVER_URL=http://localhost:8080

# services/auth-server/.env (기존)
DATABASE_URL=jdbc:postgresql://localhost:5432/desktop_figures
JWT_SECRET_ENC=...           # Jasypt
JASYPT_ENCRYPTOR_PASSWORD=...

# services/admin-server/.env (신규)
DATABASE_URL=jdbc:postgresql://localhost:5432/desktop_figures
ADMIN_JWT_SECRET_ENC=...
ADMIN_SEED_USERNAME=operator
ADMIN_SEED_PASSWORD=...       # 부트스트랩 시드용
JASYPT_ENCRYPTOR_PASSWORD=...
```

---

## 변경 범위 요약

| 영역 | 변경 |
|---|---|
| `services/auth-server` | (JPA) User 엔티티/리포지토리, register/login/me/refresh, bcrypt, status 게이트 |
| `services/admin-server` | **신규 모듈** (Spring Boot + JDBC template), admin 인증, 승인/거절 API, 웹 UI 1장, 시드 |
| `settings.gradle.kts` | `services:admin-server` 모듈 추가 |
| `apps/desktop` | authStore, authApi, 로그인/가입 모달, Setup/ActionForm 게이트 |
| 데이터베이스 | `users`에 `status`/`reject_reason`, `admin_users` 신규 |
| Meshy | **변경 없음** (클라이언트 직접 유지, 서버 프록시는 TODO) |
