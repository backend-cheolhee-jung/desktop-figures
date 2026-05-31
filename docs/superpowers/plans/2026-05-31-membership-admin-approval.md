# 회원제 + 운영자 승인 + Admin 서버 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 다운로드(3D 생성)를 승인된 회원에게만 허용한다. 회원가입 → 운영자 승인 → 로그인 흐름과, 승인을 처리하는 별도 admin-server를 구축한다.

**Architecture:** `auth-server`(Spring Boot + JPA)가 회원 인증을 담당하고, 신규 `admin-server`(Spring Boot + JDBC template)가 운영자 승인을 담당한다. 두 서버는 하나의 PostgreSQL을 공유하며 스키마는 서버별 Flyway 마이그레이션(분리된 히스토리 테이블)으로 관리한다. 데스크탑은 "생성" 버튼에 로그인/승인 게이트를 건다. Meshy 호출은 현행 클라이언트 직접 방식을 유지한다(서버 프록시는 후속 TODO).

**Tech Stack:** Kotlin, Spring Boot 3.4.5, Spring Security, JPA(auth) / JDBC template(admin), Flyway, JWT(jjwt 0.12.6), bcrypt, PostgreSQL, React + TypeScript + Zustand(desktop)

**스펙:** `docs/superpowers/specs/2026-05-31-membership-admin-approval-design.md`

---

## PR 분할 (기능별 작은 PR 3개)

| PR | 브랜치 | 범위 | Task |
|---|---|---|---|
| **PR1** | `feature/auth-member-api` | auth-server 회원 API (Flyway users + register/login/me/refresh + status 게이트) | 1~7 |
| **PR2** | `feature/admin-server` | 신규 admin-server (Flyway admin_users + admin 인증 + 승인/거절 + 웹 UI + 시드) | 8~15 |
| **PR3** | `feature/desktop-auth-gate` | 데스크탑 로그인/가입 모달 + 생성 게이트 | 16~21 |

> 각 PR은 `main`에서 분기한 독립 브랜치다. PR1 → PR2 → PR3 순서로 진행한다(PR3는 PR1의 API에 의존). 각 PR은 자체적으로 빌드·검증 가능하다.

---

## 사전 준비 (공통)

- PostgreSQL 로컬 인스턴스: DB `desktop_figures`, 접속 `localhost:5432`. (Docker: `docker run -d --name df-pg -e POSTGRES_DB=desktop_figures -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16`)
- JDK 17, Gradle wrapper(`./gradlew`).
- 테스트는 Spring Boot의 `@WebMvcTest`(컨트롤러 슬라이스, MockMvc) + 순수 단위 테스트 중심. DB 통합은 수동 검증으로 처리(Testcontainers 미도입 — YAGNI).

---

# PR1 — auth-server 회원 API

**브랜치 생성:**
```bash
git checkout main && git checkout -b feature/auth-member-api
```

## Task 1: Flyway 의존성 + 설정

**Files:**
- Modify: `services/auth-server/build.gradle.kts`
- Modify: `services/auth-server/src/main/resources/application.yml`

- [ ] **Step 1: build.gradle.kts에 Flyway + bcrypt 의존성 추가**

`dependencies { ... }` 블록에 아래를 추가(기존 줄 유지):
```kotlin
    // Flyway 마이그레이션
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")
    // 비밀번호 해싱 (spring-security-crypto는 starter-security에 포함되어 BCryptPasswordEncoder 사용 가능)
```

- [ ] **Step 2: application.yml에 Flyway 설정 추가**

`spring:` 하위에 추가(기존 `datasource`, `jpa` 유지). `jpa.hibernate.ddl-auto`는 `validate` 그대로 둔다.
```yaml
  flyway:
    enabled: true
    table: flyway_schema_history_auth   # admin-server와 분리된 히스토리 테이블
    locations: classpath:db/migration
    baseline-on-migrate: true
```

- [ ] **Step 3: 컴파일 확인**

Run: `./gradlew :services:auth-server:compileKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add services/auth-server/build.gradle.kts services/auth-server/src/main/resources/application.yml
git commit -m "chore(auth): add Flyway and configure separate history table"
```

---

## Task 2: users 테이블 Flyway 마이그레이션

**Files:**
- Create: `services/auth-server/src/main/resources/db/migration/V1__create_users.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nickname      VARCHAR(100) NOT NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    reject_reason TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: 마이그레이션 적용 확인 (수동)**

PostgreSQL 기동 상태에서:
Run: `./gradlew :services:auth-server:bootRun` (몇 초 후 Ctrl+C)
Expected: 로그에 Flyway `Migrating schema "public" to version "1 - create users"` 출력, `users` 테이블 생성됨

- [ ] **Step 3: Commit**

```bash
git add services/auth-server/src/main/resources/db/migration/V1__create_users.sql
git commit -m "feat(auth): add users table migration with status/reject_reason"
```

---

## Task 3: User 엔티티 + 리포지토리

**Files:**
- Create: `services/auth-server/src/main/kotlin/com/desktop/figures/auth/user/User.kt`
- Create: `services/auth-server/src/main/kotlin/com/desktop/figures/auth/user/UserStatus.kt`
- Create: `services/auth-server/src/main/kotlin/com/desktop/figures/auth/user/UserRepository.kt`

- [ ] **Step 1: UserStatus enum 작성**

```kotlin
package com.desktop.figures.auth.user

enum class UserStatus { PENDING, APPROVED, REJECTED }
```

- [ ] **Step 2: User 엔티티 작성**

```kotlin
package com.desktop.figures.auth.user

import jakarta.persistence.*
import java.time.OffsetDateTime
import java.util.UUID

@Entity
@Table(name = "users")
class User(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    val id: UUID? = null,

    @Column(nullable = false, unique = true)
    val email: String,

    @Column(name = "password_hash", nullable = false)
    val passwordHash: String,

    @Column(nullable = false)
    val nickname: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: UserStatus = UserStatus.PENDING,

    @Column(name = "reject_reason")
    var rejectReason: String? = null,

    @Column(name = "created_at", nullable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: OffsetDateTime = OffsetDateTime.now(),
)
```

- [ ] **Step 3: UserRepository 작성**

```kotlin
package com.desktop.figures.auth.user

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface UserRepository : JpaRepository<User, UUID> {
    fun findByEmail(email: String): User?
    fun existsByEmail(email: String): Boolean
}
```

- [ ] **Step 4: 컴파일 확인**

Run: `./gradlew :services:auth-server:compileKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add services/auth-server/src/main/kotlin/com/desktop/figures/auth/user/
git commit -m "feat(auth): add User entity, status enum, repository"
```

---

## Task 4: 보안 설정 (PasswordEncoder + SecurityFilterChain)

**Files:**
- Create: `services/auth-server/src/main/kotlin/com/desktop/figures/auth/config/SecurityConfig.kt`

- [ ] **Step 1: SecurityConfig 작성**

회원 API는 토큰 기반이므로 세션/CSRF 비활성, `/auth/**`는 공개(개별 검증은 컨트롤러/필터에서). 이번 범위에서는 `/auth/me`만 JWT 필요하지만 단순화를 위해 모든 `/auth/**`를 permitAll로 두고 `/auth/me`는 컨트롤러에서 토큰을 직접 검증한다.
```kotlin
package com.desktop.figures.auth.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.web.SecurityFilterChain

@Configuration
class SecurityConfig {

    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    @Bean
    fun filterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .csrf { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests { it.anyRequest().permitAll() }
        return http.build()
    }
}
```

- [ ] **Step 2: 컴파일 확인**

Run: `./gradlew :services:auth-server:compileKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add services/auth-server/src/main/kotlin/com/desktop/figures/auth/config/SecurityConfig.kt
git commit -m "feat(auth): add security config with BCryptPasswordEncoder"
```

---

## Task 5: JWT 토큰 제공자

**Files:**
- Create: `services/auth-server/src/main/kotlin/com/desktop/figures/auth/jwt/JwtProvider.kt`
- Test: `services/auth-server/src/test/kotlin/com/desktop/figures/auth/jwt/JwtProviderTest.kt`

- [ ] **Step 1: 실패하는 테스트 작성**

```kotlin
package com.desktop.figures.auth.jwt

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.util.UUID

class JwtProviderTest {
    private val provider = JwtProvider(
        secret = "test-secret-key-minimum-32-characters-long-xx",
        accessExpiration = 900000,
        refreshExpiration = 604800000,
    )

    @Test
    fun `access 토큰을 발급하고 subject를 복원한다`() {
        val userId = UUID.randomUUID()
        val token = provider.createAccessToken(userId)
        assertEquals(userId.toString(), provider.parseSubject(token))
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `./gradlew :services:auth-server:test --tests "*JwtProviderTest*"`
Expected: FAIL (JwtProvider 미존재 — 컴파일 에러)

- [ ] **Step 3: JwtProvider 구현**

```kotlin
package com.desktop.figures.auth.jwt

import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.util.Date
import java.util.UUID
import javax.crypto.SecretKey

@Component
class JwtProvider(
    @Value("\${jwt.secret}") secret: String,
    @Value("\${jwt.access-expiration}") private val accessExpiration: Long,
    @Value("\${jwt.refresh-expiration}") private val refreshExpiration: Long,
) {
    private val key: SecretKey = Keys.hmacShaKeyFor(secret.toByteArray())

    fun createAccessToken(userId: UUID): String = build(userId, accessExpiration)
    fun createRefreshToken(userId: UUID): String = build(userId, refreshExpiration)

    private fun build(userId: UUID, ttl: Long): String {
        val now = Date()
        return Jwts.builder()
            .subject(userId.toString())
            .issuedAt(now)
            .expiration(Date(now.time + ttl))
            .signWith(key)
            .compact()
    }

    fun parseSubject(token: String): String =
        Jwts.parser().verifyWith(key).build()
            .parseSignedClaims(token).payload.subject
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `./gradlew :services:auth-server:test --tests "*JwtProviderTest*"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/auth-server/src/main/kotlin/com/desktop/figures/auth/jwt/ services/auth-server/src/test/kotlin/com/desktop/figures/auth/jwt/
git commit -m "feat(auth): add JwtProvider with access/refresh tokens"
```

---

## Task 6: 회원 서비스 (register / login / me / refresh)

**Files:**
- Create: `services/auth-server/src/main/kotlin/com/desktop/figures/auth/user/AuthService.kt`
- Create: `services/auth-server/src/main/kotlin/com/desktop/figures/auth/user/AuthExceptions.kt`
- Test: `services/auth-server/src/test/kotlin/com/desktop/figures/auth/user/AuthServiceTest.kt`

- [ ] **Step 1: 예외 클래스 작성**

```kotlin
package com.desktop.figures.auth.user

class EmailAlreadyExistsException : RuntimeException("이미 가입된 이메일입니다.")
class InvalidCredentialsException : RuntimeException("이메일 또는 비밀번호가 올바르지 않습니다.")
class NotApprovedException(val status: UserStatus, val rejectReason: String?) :
    RuntimeException("로그인이 허용되지 않은 계정입니다: $status")
```

- [ ] **Step 2: 실패하는 테스트 작성**

```kotlin
package com.desktop.figures.auth.user

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import com.desktop.figures.auth.jwt.JwtProvider
import java.util.Optional
import java.util.UUID

class AuthServiceTest {
    private val encoder = BCryptPasswordEncoder()
    private val jwt = JwtProvider("test-secret-key-minimum-32-characters-long-xx", 900000, 604800000)

    // 간단한 인메모리 fake repository
    private fun service(store: MutableMap<String, User>) = AuthService(
        userRepository = object : FakeUserRepository(store) {},
        passwordEncoder = encoder,
        jwtProvider = jwt,
    )

    @Test
    fun `가입하면 PENDING 상태로 저장된다`() {
        val store = mutableMapOf<String, User>()
        val user = service(store).register("a@b.com", "pw123456", "닉")
        assertEquals(UserStatus.PENDING, user.status)
        assertTrue(encoder.matches("pw123456", user.passwordHash))
    }

    @Test
    fun `중복 이메일 가입은 예외`() {
        val store = mutableMapOf<String, User>()
        val svc = service(store)
        svc.register("a@b.com", "pw123456", "닉")
        assertThrows<EmailAlreadyExistsException> { svc.register("a@b.com", "x", "y") }
    }

    @Test
    fun `PENDING 회원 로그인은 NotApproved 예외`() {
        val store = mutableMapOf<String, User>()
        val svc = service(store)
        svc.register("a@b.com", "pw123456", "닉")
        val ex = assertThrows<NotApprovedException> { svc.login("a@b.com", "pw123456") }
        assertEquals(UserStatus.PENDING, ex.status)
    }

    @Test
    fun `APPROVED 회원은 토큰을 받는다`() {
        val store = mutableMapOf<String, User>()
        val svc = service(store)
        val u = svc.register("a@b.com", "pw123456", "닉")
        u.status = UserStatus.APPROVED
        val tokens = svc.login("a@b.com", "pw123456")
        assertNotNull(tokens.accessToken)
        assertNotNull(tokens.refreshToken)
    }
}
```

참고: `FakeUserRepository`는 Step 3에서 테스트 소스에 함께 정의한다.

- [ ] **Step 3: FakeUserRepository(테스트용) 작성**

`services/auth-server/src/test/kotlin/com/desktop/figures/auth/user/FakeUserRepository.kt`:
```kotlin
package com.desktop.figures.auth.user

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

// 테스트 전용: 필요한 메서드만 구현, 나머지는 미사용
abstract class FakeUserRepository(private val store: MutableMap<String, User>) : UserRepository {
    override fun findByEmail(email: String): User? = store[email]
    override fun existsByEmail(email: String): Boolean = store.containsKey(email)
    override fun <S : User> save(entity: S): S {
        store[entity.email] = entity
        return entity
    }
}
```

> 주: `JpaRepository`의 다른 메서드는 호출되지 않으므로 추상 클래스로 두어 구현을 생략한다. 컴파일을 위해 `abstract`로 선언하고 테스트에서 익명 구현(`object : FakeUserRepository(store) {}`)으로 인스턴스화한다.

- [ ] **Step 4: AuthService 구현**

```kotlin
package com.desktop.figures.auth.user

import com.desktop.figures.auth.jwt.JwtProvider
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import java.util.UUID

data class TokenPair(val accessToken: String, val refreshToken: String)

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val jwtProvider: JwtProvider,
) {
    fun register(email: String, password: String, nickname: String): User {
        if (userRepository.existsByEmail(email)) throw EmailAlreadyExistsException()
        val user = User(
            email = email,
            passwordHash = passwordEncoder.encode(password),
            nickname = nickname,
        )
        return userRepository.save(user)
    }

    fun login(email: String, password: String): TokenPair {
        val user = userRepository.findByEmail(email) ?: throw InvalidCredentialsException()
        if (!passwordEncoder.matches(password, user.passwordHash)) throw InvalidCredentialsException()
        if (user.status != UserStatus.APPROVED) throw NotApprovedException(user.status, user.rejectReason)
        val id = user.id!!
        return TokenPair(jwtProvider.createAccessToken(id), jwtProvider.createRefreshToken(id))
    }

    fun me(userId: UUID): User =
        userRepository.findById(userId).orElseThrow { InvalidCredentialsException() }

    fun refresh(refreshToken: String): String {
        val userId = UUID.fromString(jwtProvider.parseSubject(refreshToken))
        return jwtProvider.createAccessToken(userId)
    }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `./gradlew :services:auth-server:test --tests "*AuthServiceTest*"`
Expected: PASS (4개)

- [ ] **Step 6: Commit**

```bash
git add services/auth-server/src/main/kotlin/com/desktop/figures/auth/user/ services/auth-server/src/test/kotlin/com/desktop/figures/auth/user/
git commit -m "feat(auth): add AuthService for register/login/me/refresh"
```

---

## Task 7: 회원 컨트롤러 + 예외 핸들러

**Files:**
- Create: `services/auth-server/src/main/kotlin/com/desktop/figures/auth/user/AuthController.kt`
- Create: `services/auth-server/src/main/kotlin/com/desktop/figures/auth/user/AuthDtos.kt`
- Create: `services/auth-server/src/main/kotlin/com/desktop/figures/auth/config/GlobalExceptionHandler.kt`
- Test: `services/auth-server/src/test/kotlin/com/desktop/figures/auth/user/AuthControllerTest.kt`

- [ ] **Step 1: DTO 작성**

```kotlin
package com.desktop.figures.auth.user

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class RegisterRequest(
    @field:Email val email: String,
    @field:Size(min = 8) val password: String,
    @field:NotBlank val nickname: String,
)
data class LoginRequest(@field:Email val email: String, @field:NotBlank val password: String)
data class RefreshRequest(@field:NotBlank val refreshToken: String)

data class RegisterResponse(val userId: String, val status: String)
data class LoginResponse(val accessToken: String, val refreshToken: String)
data class MeResponse(val userId: String, val email: String, val nickname: String, val status: String)
data class AccessTokenResponse(val accessToken: String)
```

- [ ] **Step 2: 예외 핸들러 작성**

```kotlin
package com.desktop.figures.auth.config

import com.desktop.figures.auth.user.*
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(EmailAlreadyExistsException::class)
    fun emailExists(e: EmailAlreadyExistsException) =
        ResponseEntity.status(HttpStatus.CONFLICT).body(mapOf("message" to e.message))

    @ExceptionHandler(InvalidCredentialsException::class)
    fun invalidCreds(e: InvalidCredentialsException) =
        ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("message" to e.message))

    @ExceptionHandler(NotApprovedException::class)
    fun notApproved(e: NotApprovedException) =
        ResponseEntity.status(HttpStatus.FORBIDDEN).body(
            mapOf("status" to e.status.name, "rejectReason" to e.rejectReason)
        )
}
```

- [ ] **Step 3: 컨트롤러 작성**

`/auth/me`는 `Authorization: Bearer <token>`에서 subject(userId)를 직접 파싱한다.
```kotlin
package com.desktop.figures.auth.user

import com.desktop.figures.auth.jwt.JwtProvider
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.util.UUID

@RestController
@RequestMapping("/auth")
class AuthController(
    private val authService: AuthService,
    private val jwtProvider: JwtProvider,
) {
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    fun register(@Valid @RequestBody req: RegisterRequest): RegisterResponse {
        val u = authService.register(req.email, req.password, req.nickname)
        return RegisterResponse(u.id.toString(), u.status.name)
    }

    @PostMapping("/login")
    fun login(@Valid @RequestBody req: LoginRequest): LoginResponse {
        val t = authService.login(req.email, req.password)
        return LoginResponse(t.accessToken, t.refreshToken)
    }

    @GetMapping("/me")
    fun me(@RequestHeader("Authorization") authorization: String): MeResponse {
        val token = authorization.removePrefix("Bearer ").trim()
        val userId = UUID.fromString(jwtProvider.parseSubject(token))
        val u = authService.me(userId)
        return MeResponse(u.id.toString(), u.email, u.nickname, u.status.name)
    }

    @PostMapping("/refresh")
    fun refresh(@Valid @RequestBody req: RefreshRequest): AccessTokenResponse =
        AccessTokenResponse(authService.refresh(req.refreshToken))
}
```

- [ ] **Step 4: 컨트롤러 슬라이스 테스트 작성**

```kotlin
package com.desktop.figures.auth.user

import com.desktop.figures.auth.jwt.JwtProvider
import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Test
import org.mockito.Mockito.`when`
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@WebMvcTest(AuthController::class)
class AuthControllerTest {
    @Autowired lateinit var mockMvc: MockMvc
    @Autowired lateinit var objectMapper: ObjectMapper
    @MockBean lateinit var authService: AuthService
    @MockBean lateinit var jwtProvider: JwtProvider

    @Test
    fun `register는 201을 반환한다`() {
        `when`(authService.register("a@b.com", "pw123456", "닉"))
            .thenReturn(User(email = "a@b.com", passwordHash = "h", nickname = "닉"))
        mockMvc.perform(
            post("/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(RegisterRequest("a@b.com", "pw123456", "닉")))
        ).andExpect(status().isCreated)
    }

    @Test
    fun `PENDING 로그인은 403`() {
        `when`(authService.login("a@b.com", "pw123456"))
            .thenThrow(NotApprovedException(UserStatus.PENDING, null))
        mockMvc.perform(
            post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(LoginRequest("a@b.com", "pw123456")))
        ).andExpect(status().isForbidden)
    }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `./gradlew :services:auth-server:test`
Expected: PASS (전체 auth-server 테스트)

- [ ] **Step 6: 수동 E2E 확인**

PostgreSQL 기동 후 `./gradlew :services:auth-server:bootRun`. 다른 터미널에서:
```bash
curl -s -X POST localhost:8080/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"t@t.com","password":"pw123456","nickname":"테스트"}'
# → {"userId":"...","status":"PENDING"}
curl -s -X POST localhost:8080/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"t@t.com","password":"pw123456"}'
# → 403 {"status":"PENDING","rejectReason":null}
```

- [ ] **Step 7: Commit + PR1**

```bash
git add services/auth-server/src/main/kotlin/com/desktop/figures/auth/ services/auth-server/src/test/
git commit -m "feat(auth): add AuthController, DTOs, global exception handler"
git push -u origin feature/auth-member-api
gh pr create --title "feat(auth): member registration/login with admin-approval gate" --body "$(cat <<'EOF'
## Summary
- users 테이블 Flyway 마이그레이션 (status/reject_reason)
- register/login/me/refresh API, bcrypt, JWT
- 로그인은 APPROVED 회원만 통과(PENDING/REJECTED는 403)

## Test Plan
- [ ] ./gradlew :services:auth-server:test 통과
- [ ] curl register → PENDING, login → 403 확인
EOF
)"
```

---

# PR2 — admin-server (신규)

**브랜치 생성:**
```bash
git checkout main && git checkout -b feature/admin-server
```

## Task 8: admin-server Gradle 모듈 등록

**Files:**
- Modify: `settings.gradle.kts`
- Create: `services/admin-server/build.gradle.kts`

- [ ] **Step 1: settings.gradle.kts에 모듈 추가**

```kotlin
rootProject.name = "desktop-figures"

include(
    "services:auth-server",
    "services:socket-server",
    "services:admin-server"
)
```

- [ ] **Step 2: build.gradle.kts 작성 (JDBC template + Flyway, JPA 없음)**

```kotlin
plugins {
    kotlin("jvm")
    kotlin("plugin.spring")
    id("org.springframework.boot")
    id("io.spring.dependency-management")
}

java {
    toolchain { languageVersion = JavaLanguageVersion.of(17) }
}

kotlin {
    compilerOptions { freeCompilerArgs.addAll("-Xjsr305=strict") }
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-jdbc")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlin:kotlin-reflect")

    // JWT (admin 전용)
    implementation("io.jsonwebtoken:jjwt-api:0.12.6")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:0.12.6")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.12.6")

    // Flyway
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")

    runtimeOnly("org.postgresql:postgresql")
    implementation("com.github.ulisesbocchio:jasypt-spring-boot-starter:3.0.5")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")
}
```

- [ ] **Step 3: 모듈 인식 확인**

Run: `./gradlew :services:admin-server:dependencies --configuration compileClasspath` (또는 `./gradlew projects`)
Expected: `admin-server`가 프로젝트 목록에 표시됨

- [ ] **Step 4: Commit**

```bash
git add settings.gradle.kts services/admin-server/build.gradle.kts
git commit -m "chore(admin): register admin-server gradle module (JDBC + Flyway)"
```

---

## Task 9: admin-server 부트 클래스 + application.yml

**Files:**
- Create: `services/admin-server/src/main/kotlin/com/desktop/figures/admin/AdminApplication.kt`
- Create: `services/admin-server/src/main/resources/application.yml`

- [ ] **Step 1: AdminApplication 작성**

```kotlin
package com.desktop.figures.admin

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class AdminApplication

fun main(args: Array<String>) {
    runApplication<AdminApplication>(*args)
}
```

- [ ] **Step 2: application.yml 작성**

```yaml
spring:
  application:
    name: admin-server
  datasource:
    url: ${DATABASE_URL:jdbc:postgresql://localhost:5432/desktop_figures}
    username: ${DB_USERNAME:postgres}
    password: ENC(${DB_PASSWORD_ENC:postgres})
    driver-class-name: org.postgresql.Driver
  flyway:
    enabled: true
    table: flyway_schema_history_admin   # auth-server와 분리
    locations: classpath:db/migration
    baseline-on-migrate: true

server:
  port: 8081

admin-jwt:
  secret: ENC(${ADMIN_JWT_SECRET_ENC:dev-admin-secret-minimum-32-characters-xx})
  expiration: 3600000   # 1시간

admin-seed:
  username: ${ADMIN_SEED_USERNAME:operator}
  password: ${ADMIN_SEED_PASSWORD:operator1234}

jasypt:
  encryptor:
    algorithm: PBEWithMD5AndDES
    iv-generator-classname: org.jasypt.iv.NoIvGenerator
```

- [ ] **Step 3: 컴파일 확인**

Run: `./gradlew :services:admin-server:compileKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add services/admin-server/src/main/kotlin/com/desktop/figures/admin/AdminApplication.kt services/admin-server/src/main/resources/application.yml
git commit -m "feat(admin): add boot application and configuration"
```

---

## Task 10: admin_users 테이블 Flyway 마이그레이션

**Files:**
- Create: `services/admin-server/src/main/resources/db/migration/V1__create_admin_users.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
CREATE TABLE IF NOT EXISTS admin_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Commit**

```bash
git add services/admin-server/src/main/resources/db/migration/V1__create_admin_users.sql
git commit -m "feat(admin): add admin_users table migration"
```

---

## Task 11: admin JWT 제공자 + 보안 설정 + PasswordEncoder

**Files:**
- Create: `services/admin-server/src/main/kotlin/com/desktop/figures/admin/jwt/AdminJwtProvider.kt`
- Create: `services/admin-server/src/main/kotlin/com/desktop/figures/admin/config/AdminSecurityConfig.kt`

- [ ] **Step 1: AdminJwtProvider 작성**

```kotlin
package com.desktop.figures.admin.jwt

import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.util.Date
import javax.crypto.SecretKey

@Component
class AdminJwtProvider(
    @Value("\${admin-jwt.secret}") secret: String,
    @Value("\${admin-jwt.expiration}") private val expiration: Long,
) {
    private val key: SecretKey = Keys.hmacShaKeyFor(secret.toByteArray())

    fun createToken(username: String): String {
        val now = Date()
        return Jwts.builder()
            .subject(username)
            .issuedAt(now)
            .expiration(Date(now.time + expiration))
            .signWith(key)
            .compact()
    }

    fun parseSubject(token: String): String =
        Jwts.parser().verifyWith(key).build().parseSignedClaims(token).payload.subject
}
```

- [ ] **Step 2: AdminSecurityConfig 작성**

`/admin/login`과 정적 UI(`/`, `/index.html`)는 공개, `/admin/**` 나머지는 토큰 필요. 단순화를 위해 컨트롤러에서 토큰 검증하고 여기서는 permitAll + STATELESS로 둔다.
```kotlin
package com.desktop.figures.admin.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.web.SecurityFilterChain

@Configuration
class AdminSecurityConfig {
    @Bean fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    @Bean
    fun filterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .csrf { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests { it.anyRequest().permitAll() }
        return http.build()
    }
}
```

- [ ] **Step 3: 컴파일 확인**

Run: `./gradlew :services:admin-server:compileKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add services/admin-server/src/main/kotlin/com/desktop/figures/admin/jwt/ services/admin-server/src/main/kotlin/com/desktop/figures/admin/config/AdminSecurityConfig.kt
git commit -m "feat(admin): add admin JWT provider and security config"
```

---

## Task 12: 데이터 접근 (JDBC template) — AdminUserDao + RegistrationDao

**Files:**
- Create: `services/admin-server/src/main/kotlin/com/desktop/figures/admin/dao/AdminUserDao.kt`
- Create: `services/admin-server/src/main/kotlin/com/desktop/figures/admin/dao/RegistrationDao.kt`

- [ ] **Step 1: AdminUserDao 작성 (admin_users 조회/삽입)**

```kotlin
package com.desktop.figures.admin.dao

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository

data class AdminUserRow(val id: String, val username: String, val passwordHash: String)

@Repository
class AdminUserDao(private val jdbc: JdbcTemplate) {

    fun findByUsername(username: String): AdminUserRow? =
        jdbc.query(
            "SELECT id, username, password_hash FROM admin_users WHERE username = ?",
            { rs, _ -> AdminUserRow(rs.getString("id"), rs.getString("username"), rs.getString("password_hash")) },
            username,
        ).firstOrNull()

    fun existsByUsername(username: String): Boolean =
        jdbc.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM admin_users WHERE username = ?)",
            Boolean::class.java, username,
        ) ?: false

    fun insert(username: String, passwordHash: String) {
        jdbc.update(
            "INSERT INTO admin_users (username, password_hash) VALUES (?, ?)",
            username, passwordHash,
        )
    }
}
```

- [ ] **Step 2: RegistrationDao 작성 (users 조회/상태 갱신)**

```kotlin
package com.desktop.figures.admin.dao

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository

data class RegistrationRow(
    val userId: String,
    val email: String,
    val nickname: String,
    val status: String,
    val createdAt: String,
)

@Repository
class RegistrationDao(private val jdbc: JdbcTemplate) {

    fun findByStatus(status: String): List<RegistrationRow> =
        jdbc.query(
            """SELECT id, email, nickname, status, created_at
               FROM users WHERE status = ? ORDER BY created_at ASC""",
            { rs, _ ->
                RegistrationRow(
                    rs.getString("id"), rs.getString("email"), rs.getString("nickname"),
                    rs.getString("status"), rs.getString("created_at"),
                )
            },
            status,
        )

    fun approve(userId: String): Int =
        jdbc.update(
            """UPDATE users SET status = 'APPROVED', reject_reason = NULL, updated_at = now()
               WHERE id = ?::uuid AND status = 'PENDING'""",
            userId,
        )

    fun reject(userId: String, reason: String): Int =
        jdbc.update(
            """UPDATE users SET status = 'REJECTED', reject_reason = ?, updated_at = now()
               WHERE id = ?::uuid AND status = 'PENDING'""",
            reason, userId,
        )
}
```

- [ ] **Step 3: 컴파일 확인**

Run: `./gradlew :services:admin-server:compileKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add services/admin-server/src/main/kotlin/com/desktop/figures/admin/dao/
git commit -m "feat(admin): add JDBC DAOs for admin_users and registrations"
```

---

## Task 13: 운영자 시드 + 인증/승인 서비스

**Files:**
- Create: `services/admin-server/src/main/kotlin/com/desktop/figures/admin/AdminSeeder.kt`
- Create: `services/admin-server/src/main/kotlin/com/desktop/figures/admin/service/AdminService.kt`
- Create: `services/admin-server/src/main/kotlin/com/desktop/figures/admin/service/AdminExceptions.kt`

- [ ] **Step 1: 예외 작성**

```kotlin
package com.desktop.figures.admin.service

class AdminLoginFailedException : RuntimeException("운영자 인증 실패")
class RegistrationNotPendingException : RuntimeException("PENDING 상태의 가입 신청이 아닙니다.")
```

- [ ] **Step 2: AdminSeeder 작성 (부트 시 시드)**

```kotlin
package com.desktop.figures.admin

import com.desktop.figures.admin.dao.AdminUserDao
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Component

@Component
class AdminSeeder(
    private val adminUserDao: AdminUserDao,
    private val passwordEncoder: PasswordEncoder,
    @Value("\${admin-seed.username}") private val seedUsername: String,
    @Value("\${admin-seed.password}") private val seedPassword: String,
) {
    @EventListener(ApplicationReadyEvent::class)
    fun seed() {
        if (!adminUserDao.existsByUsername(seedUsername)) {
            adminUserDao.insert(seedUsername, passwordEncoder.encode(seedPassword))
        }
    }
}
```

- [ ] **Step 3: AdminService 작성**

```kotlin
package com.desktop.figures.admin.service

import com.desktop.figures.admin.dao.AdminUserDao
import com.desktop.figures.admin.dao.RegistrationDao
import com.desktop.figures.admin.dao.RegistrationRow
import com.desktop.figures.admin.jwt.AdminJwtProvider
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service

@Service
class AdminService(
    private val adminUserDao: AdminUserDao,
    private val registrationDao: RegistrationDao,
    private val passwordEncoder: PasswordEncoder,
    private val adminJwtProvider: AdminJwtProvider,
) {
    fun login(username: String, password: String): String {
        val admin = adminUserDao.findByUsername(username) ?: throw AdminLoginFailedException()
        if (!passwordEncoder.matches(password, admin.passwordHash)) throw AdminLoginFailedException()
        return adminJwtProvider.createToken(username)
    }

    fun verify(authorizationHeader: String?) {
        val token = authorizationHeader?.removePrefix("Bearer ")?.trim()
            ?: throw AdminLoginFailedException()
        adminJwtProvider.parseSubject(token) // 유효성 검증 (실패 시 예외)
    }

    fun pendingRegistrations(): List<RegistrationRow> = registrationDao.findByStatus("PENDING")

    fun approve(userId: String) {
        if (registrationDao.approve(userId) == 0) throw RegistrationNotPendingException()
    }

    fun reject(userId: String, reason: String) {
        if (registrationDao.reject(userId, reason) == 0) throw RegistrationNotPendingException()
    }
}
```

- [ ] **Step 4: 컴파일 확인**

Run: `./gradlew :services:admin-server:compileKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add services/admin-server/src/main/kotlin/com/desktop/figures/admin/AdminSeeder.kt services/admin-server/src/main/kotlin/com/desktop/figures/admin/service/
git commit -m "feat(admin): add operator seeder and approval service"
```

---

## Task 14: admin 컨트롤러 + 예외 핸들러

**Files:**
- Create: `services/admin-server/src/main/kotlin/com/desktop/figures/admin/web/AdminController.kt`
- Create: `services/admin-server/src/main/kotlin/com/desktop/figures/admin/web/AdminDtos.kt`
- Create: `services/admin-server/src/main/kotlin/com/desktop/figures/admin/config/AdminExceptionHandler.kt`
- Test: `services/admin-server/src/test/kotlin/com/desktop/figures/admin/web/AdminControllerTest.kt`

- [ ] **Step 1: DTO 작성**

```kotlin
package com.desktop.figures.admin.web

import jakarta.validation.constraints.NotBlank

data class AdminLoginRequest(@field:NotBlank val username: String, @field:NotBlank val password: String)
data class AdminLoginResponse(val adminToken: String)
data class RejectRequest(@field:NotBlank val reason: String)
```

- [ ] **Step 2: 예외 핸들러 작성**

```kotlin
package com.desktop.figures.admin.config

import com.desktop.figures.admin.service.AdminLoginFailedException
import com.desktop.figures.admin.service.RegistrationNotPendingException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class AdminExceptionHandler {
    @ExceptionHandler(AdminLoginFailedException::class)
    fun loginFailed(e: AdminLoginFailedException) =
        ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("message" to e.message))

    @ExceptionHandler(RegistrationNotPendingException::class)
    fun notPending(e: RegistrationNotPendingException) =
        ResponseEntity.status(HttpStatus.CONFLICT).body(mapOf("message" to e.message))
}
```

- [ ] **Step 3: 컨트롤러 작성**

```kotlin
package com.desktop.figures.admin.web

import com.desktop.figures.admin.dao.RegistrationRow
import com.desktop.figures.admin.service.AdminService
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/admin")
class AdminController(private val adminService: AdminService) {

    @PostMapping("/login")
    fun login(@Valid @RequestBody req: AdminLoginRequest): AdminLoginResponse =
        AdminLoginResponse(adminService.login(req.username, req.password))

    @GetMapping("/registrations")
    fun registrations(
        @RequestHeader(value = "Authorization", required = false) auth: String?,
        @RequestParam(defaultValue = "PENDING") status: String,
    ): List<RegistrationRow> {
        adminService.verify(auth)
        return adminService.pendingRegistrations()
    }

    @PostMapping("/registrations/{userId}/approve")
    fun approve(
        @RequestHeader(value = "Authorization", required = false) auth: String?,
        @PathVariable userId: String,
    ) {
        adminService.verify(auth)
        adminService.approve(userId)
    }

    @PostMapping("/registrations/{userId}/reject")
    fun reject(
        @RequestHeader(value = "Authorization", required = false) auth: String?,
        @PathVariable userId: String,
        @Valid @RequestBody req: RejectRequest,
    ) {
        adminService.verify(auth)
        adminService.reject(userId, req.reason)
    }
}
```

- [ ] **Step 4: 컨트롤러 슬라이스 테스트 작성**

```kotlin
package com.desktop.figures.admin.web

import com.desktop.figures.admin.service.AdminService
import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Test
import org.mockito.Mockito.`when`
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@WebMvcTest(AdminController::class)
class AdminControllerTest {
    @Autowired lateinit var mockMvc: MockMvc
    @Autowired lateinit var objectMapper: ObjectMapper
    @MockBean lateinit var adminService: AdminService

    @Test
    fun `로그인 성공 시 토큰 반환`() {
        `when`(adminService.login("operator", "operator1234")).thenReturn("admin-token")
        mockMvc.perform(
            post("/admin/login").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(AdminLoginRequest("operator", "operator1234")))
        ).andExpect(status().isOk)
    }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `./gradlew :services:admin-server:test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add services/admin-server/src/main/kotlin/com/desktop/figures/admin/web/ services/admin-server/src/main/kotlin/com/desktop/figures/admin/config/AdminExceptionHandler.kt services/admin-server/src/test/
git commit -m "feat(admin): add admin controller for login/approve/reject"
```

---

## Task 15: 최소 웹 UI + 수동 E2E

**Files:**
- Create: `services/admin-server/src/main/resources/static/index.html`

- [ ] **Step 1: 정적 UI 한 장 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>가입 승인 관리</title>
  <style>
    body { font-family: sans-serif; max-width: 760px; margin: 40px auto; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #ddd; padding: 8px; font-size: 14px; text-align: left; }
    button { cursor: pointer; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <h2>가입 승인 관리</h2>

  <div id="login">
    <input id="u" placeholder="운영자 ID" />
    <input id="p" type="password" placeholder="비밀번호" />
    <button onclick="login()">로그인</button>
  </div>

  <div id="panel" class="hidden">
    <button onclick="load()">새로고침</button>
    <table>
      <thead><tr><th>이메일</th><th>닉네임</th><th>신청일</th><th>처리</th></tr></thead>
      <tbody id="rows"></tbody>
    </table>
  </div>

  <script>
    let token = "";
    async function login() {
      const r = await fetch("/admin/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u.value, password: p.value }),
      });
      if (!r.ok) { alert("로그인 실패"); return; }
      token = (await r.json()).adminToken;
      login.classList?.add; document.getElementById("login").classList.add("hidden");
      document.getElementById("panel").classList.remove("hidden");
      load();
    }
    async function load() {
      const r = await fetch("/admin/registrations?status=PENDING", {
        headers: { Authorization: "Bearer " + token },
      });
      const list = await r.json();
      document.getElementById("rows").innerHTML = list.map(function (x) {
        return "<tr><td>" + x.email + "</td><td>" + x.nickname + "</td><td>" + x.createdAt +
          "</td><td><button onclick=\"approve('" + x.userId + "')\">승인</button> " +
          "<button onclick=\"reject('" + x.userId + "')\">거절</button></td></tr>";
      }).join("");
    }
    async function approve(id) {
      await fetch("/admin/registrations/" + id + "/approve", {
        method: "POST", headers: { Authorization: "Bearer " + token },
      });
      load();
    }
    async function reject(id) {
      const reason = prompt("거절 사유") || "사유 미기재";
      await fetch("/admin/registrations/" + id + "/reject", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason }),
      });
      load();
    }
  </script>
</body>
</html>
```

> 주: `RegistrationRow.userId`는 JSON 직렬화 시 `userId` 필드로 나간다(데이터 클래스 프로퍼티명과 일치).

- [ ] **Step 2: 수동 E2E (auth-server + admin-server 동시 기동)**

PostgreSQL 기동 상태에서 두 서버를 각각 실행한 뒤:
```bash
# auth-server로 가입(PENDING 생성)
curl -s -X POST localhost:8080/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"u1@t.com","password":"pw123456","nickname":"U1"}'
```
브라우저로 `http://localhost:8081/` 접속 → `operator / operator1234` 로그인 → 목록에 U1 표시 → [승인] 클릭.
```bash
# 승인 후 로그인 성공 확인
curl -s -X POST localhost:8080/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"u1@t.com","password":"pw123456"}'
# → 200 {"accessToken":"...","refreshToken":"..."}
```
Expected: 승인 전 403(PENDING) → 승인 후 200 토큰 발급

- [ ] **Step 3: Commit + PR2**

```bash
git add services/admin-server/src/main/resources/static/index.html
git commit -m "feat(admin): add minimal operator web UI"
git push -u origin feature/admin-server
gh pr create --title "feat(admin): admin-server for operator approval (JDBC + Flyway)" --body "$(cat <<'EOF'
## Summary
- 신규 admin-server (Spring Boot + JDBC template + Flyway)
- 운영자 시드 계정, admin JWT 로그인
- PENDING 가입 신청 목록 / 승인 / 거절 API + 웹 UI 1장

## Test Plan
- [ ] ./gradlew :services:admin-server:test 통과
- [ ] 웹 UI에서 승인 → auth-server 로그인 200 확인
EOF
)"
```

---

# PR3 — 데스크탑 로그인 게이트

**브랜치 생성:**
```bash
git checkout main && git checkout -b feature/desktop-auth-gate
```

> 주: 이 PR은 PR1의 auth-server API를 사용한다. 로컬에서 auth-server 기동 + `.env`의 `VITE_AUTH_SERVER_URL` 설정 필요.

## Task 16: authApi 래퍼

**Files:**
- Create: `apps/desktop/src/lib/authApi.ts`

- [ ] **Step 1: authApi 작성**

```typescript
const BASE = import.meta.env.VITE_AUTH_SERVER_URL ?? "http://localhost:8080";

export type UserStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Me {
  userId: string;
  email: string;
  nickname: string;
  status: UserStatus;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}

// 로그인 실패(403) 시 상태를 담아 던지는 에러
export class NotApprovedError extends Error {
  constructor(public status: UserStatus, public rejectReason?: string) {
    super("not approved");
  }
}

export async function register(email: string, password: string, nickname: string): Promise<void> {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, nickname }),
  });
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))).message ?? `가입 실패 (${res.status})`;
    throw new Error(msg);
  }
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    throw new NotApprovedError(body.status as UserStatus, body.rejectReason ?? undefined);
  }
  if (!res.ok) throw new Error(`로그인 실패 (${res.status})`);
  return (await res.json()) as LoginResult;
}

export async function fetchMe(accessToken: string): Promise<Me> {
  const res = await fetch(`${BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`프로필 조회 실패 (${res.status})`);
  return (await res.json()) as Me;
}
```

- [ ] **Step 2: 타입 확인**

Run: `cd apps/desktop && npx tsc --noEmit 2>&1 | grep authApi.ts || echo "no authApi errors"`
Expected: 빈 출력

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/authApi.ts
git commit -m "feat(desktop): add auth-server API wrapper"
```

---

## Task 17: authStore

**Files:**
- Create: `apps/desktop/src/store/authStore.ts`

- [ ] **Step 1: authStore 작성**

```typescript
import { create } from "zustand";
import type { Me } from "@/lib/authApi";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  me: Me | null;
  setSession: (accessToken: string, refreshToken: string, me: Me) => void;
  clear: () => void;
  isApproved: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  me: null,
  setSession: (accessToken, refreshToken, me) => set({ accessToken, refreshToken, me }),
  clear: () => set({ accessToken: null, refreshToken: null, me: null }),
  isApproved: () => get().me?.status === "APPROVED" && get().accessToken !== null,
}));
```

- [ ] **Step 2: 타입 확인**

Run: `cd apps/desktop && npx tsc --noEmit 2>&1 | grep authStore.ts || echo "no authStore errors"`
Expected: 빈 출력

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/store/authStore.ts
git commit -m "feat(desktop): add auth store"
```

---

## Task 18: 로그인/가입 모달 컴포넌트

**Files:**
- Create: `apps/desktop/src/components/AuthModal/index.tsx`

- [ ] **Step 1: AuthModal 작성**

로그인/가입 탭 전환. 로그인 성공 시 `fetchMe`로 상태를 받아 store에 저장, `APPROVED`면 `onApproved()` 호출. `PENDING`/`REJECTED`는 안내 메시지.
```tsx
import { useState } from "react";
import { login, register, fetchMe, NotApprovedError } from "@/lib/authApi";
import { useAuthStore } from "@/store/authStore";

interface Props {
  onClose: () => void;
  onApproved: () => void;
}

type Tab = "login" | "register";

export default function AuthModal({ onClose, onApproved }: Props) {
  const setSession = useAuthStore((s) => s.setSession);
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setBusy(true); setError(null); setInfo(null);
    try {
      const tokens = await login(email.trim(), password);
      const me = await fetchMe(tokens.accessToken);
      setSession(tokens.accessToken, tokens.refreshToken, me);
      onApproved();
    } catch (e) {
      if (e instanceof NotApprovedError) {
        setInfo(
          e.status === "PENDING"
            ? "운영자 승인 대기 중이에요. 승인 후 이용할 수 있어요."
            : `가입이 거절되었어요${e.rejectReason ? `: ${e.rejectReason}` : ""}.`
        );
      } else {
        setError(e instanceof Error ? e.message : "로그인 실패");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister() {
    setBusy(true); setError(null); setInfo(null);
    try {
      await register(email.trim(), password, nickname.trim());
      setInfo("가입 신청 완료! 운영자 승인 후 로그인할 수 있어요.");
      setTab("login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "가입 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-5 w-72 flex flex-col gap-3 shadow-xl">
        <div className="flex gap-2 text-sm font-semibold">
          <button onClick={() => setTab("login")} className={tab === "login" ? "text-blue-500" : "text-gray-400"}>로그인</button>
          <button onClick={() => setTab("register")} className={tab === "register" ? "text-blue-500" : "text-gray-400"}>가입</button>
          <button onClick={onClose} className="ml-auto text-gray-300 hover:text-gray-500">✕</button>
        </div>

        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일"
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="비밀번호(8자 이상)"
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
        {tab === "register" && (
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
        )}

        {info && <p className="text-xs text-blue-500">{info}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          onClick={tab === "login" ? handleLogin : handleRegister}
          disabled={busy}
          className="bg-blue-500 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-40 hover:bg-blue-600"
        >
          {tab === "login" ? "로그인" : "가입 신청"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입 확인**

Run: `cd apps/desktop && npx tsc --noEmit 2>&1 | grep AuthModal || echo "no AuthModal errors"`
Expected: 빈 출력

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/AuthModal/index.tsx
git commit -m "feat(desktop): add login/register modal"
```

---

## Task 19: 생성 게이트 훅

**Files:**
- Create: `apps/desktop/src/hooks/useGenerationGate.ts`

승인된 회원이 아니면 모달을 띄우는 게이트 훅. 모달 표시 상태와 "게이트 통과 시 실행할 액션"을 관리한다.

- [ ] **Step 1: useGenerationGate 작성**

```typescript
import { useState, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";

export function useGenerationGate() {
  const isApproved = useAuthStore((s) => s.isApproved);
  const [showModal, setShowModal] = useState(false);

  // 승인 회원이면 action 실행, 아니면 모달 오픈
  const runGated = useCallback(
    (action: () => void) => {
      if (isApproved()) {
        action();
      } else {
        setShowModal(true);
      }
    },
    [isApproved]
  );

  return { showModal, setShowModal, runGated, isApproved };
}
```

- [ ] **Step 2: 타입 확인**

Run: `cd apps/desktop && npx tsc --noEmit 2>&1 | grep useGenerationGate || echo "no gate errors"`
Expected: 빈 출력

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/hooks/useGenerationGate.ts
git commit -m "feat(desktop): add generation gate hook"
```

---

## Task 20: Setup / ActionForm 생성 게이트 적용

**Files:**
- Modify: `apps/desktop/src/pages/Setup/index.tsx`
- Modify: `apps/desktop/src/pages/ActionForm/index.tsx`

- [ ] **Step 1: Setup에 게이트 적용**

`SetupPage`에 import 추가:
```typescript
import AuthModal from "@/components/AuthModal";
import { useGenerationGate } from "@/hooks/useGenerationGate";
```

컴포넌트 본문 상단(상태 선언부 근처)에 추가:
```typescript
  const { showModal, setShowModal, runGated } = useGenerationGate();
```

기존 "캐릭터 만들기" 버튼의 `onClick={handleCreate}`를 게이트로 감싼다:
```tsx
        onClick={() => runGated(handleCreate)}
```

`return (...)`의 최상위 컨테이너 내부 끝(닫는 `</div>` 직전)에 모달 추가:
```tsx
      {showModal && (
        <AuthModal onClose={() => setShowModal(false)} onApproved={() => { setShowModal(false); handleCreate(); }} />
      )}
```

- [ ] **Step 2: ActionForm에 게이트 적용**

`ActionFormPage`에 동일 import 추가:
```typescript
import AuthModal from "@/components/AuthModal";
import { useGenerationGate } from "@/hooks/useGenerationGate";
```

본문에 추가:
```typescript
  const { showModal, setShowModal, runGated } = useGenerationGate();
```

행동 "생성" 버튼의 `onClick={handleStartGeneration}`를 감싼다:
```tsx
                onClick={() => runGated(handleStartGeneration)}
```

최상위 컨테이너 끝에 모달 추가:
```tsx
      {showModal && (
        <AuthModal onClose={() => setShowModal(false)} onApproved={() => { setShowModal(false); handleStartGeneration(); }} />
      )}
```

- [ ] **Step 3: 타입 + 빌드 확인**

Run: `cd apps/desktop && npx tsc --noEmit && npm run build 2>&1 | tail -3`
Expected: 컴파일 통과, 빌드 성공

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/pages/Setup/index.tsx apps/desktop/src/pages/ActionForm/index.tsx
git commit -m "feat(desktop): gate character/action generation behind member approval"
```

---

## Task 21: 수동 검증 + PR3

**Files:** 없음 (런타임 검증)

- [ ] **Step 1: 환경 변수 확인**

`apps/desktop/.env`에 `VITE_AUTH_SERVER_URL=http://localhost:8080` 존재 확인.

- [ ] **Step 2: 서버 3종 기동**

PostgreSQL + auth-server(:8080) + admin-server(:8081) 기동, 데스크탑 `npm run tauri dev`.

- [ ] **Step 3: 게이트 흐름 검증**

1. 비로그인 상태에서 캐릭터 "만들기" 클릭 → AuthModal 표시
2. 가입 신청 → "운영자 승인 대기" 안내
3. (미승인 상태로) 로그인 시도 → "승인 대기 중" 안내, 생성 차단
4. admin UI(:8081)에서 승인 → 데스크탑에서 다시 로그인 → 모달 닫히고 생성 진행
5. ActionForm의 행동 "생성"도 동일하게 게이트 동작 확인

- [ ] **Step 4: PR3 생성**

```bash
git push -u origin feature/desktop-auth-gate
gh pr create --title "feat(desktop): member-gated AI generation" --body "$(cat <<'EOF'
## Summary
- authApi/authStore + 로그인/가입 모달
- 캐릭터/행동 "생성"에 승인 회원 게이트 적용 (미승인은 안내 후 차단)
- Meshy 호출은 현행 클라이언트 직접 유지 (서버 프록시는 후속 TODO)

## Test Plan
- [ ] 미로그인 생성 클릭 → 모달
- [ ] 가입 → 승인 대기 안내
- [ ] admin 승인 후 로그인 → 생성 진행
EOF
)"
```

---

## Self-Review 결과

- **스펙 커버리지:** 토폴로지(PR1/PR2 분리) ✓, 데이터 모델(T2 users, T10 admin_users) ✓, 상태머신 PENDING/APPROVED/REJECTED(T6 게이트, T12 approve/reject) ✓, API(T7 auth, T14 admin) ✓, 운영자 시드(T13) ✓, 웹 UI(T15) ✓, 데스크탑 게이트(T16~20) ✓, Flyway 분리 히스토리(T1 `flyway_schema_history_auth`, T9 `flyway_schema_history_admin`) ✓, JDBC template(admin) vs JPA(auth) ✓
- **TODO 명시:** Meshy 서버 프록시 이전은 PR3 본문/스펙에 후속 TODO로 명기 ✓
- **타입 일관성:** `RegistrationRow.userId`(DAO) ↔ UI `x.userId` ↔ approve/reject path 일치 ✓ / `UserStatus`(auth Kotlin enum)와 데스크탑 `UserStatus`(TS 유니온) 값 일치(PENDING/APPROVED/REJECTED) ✓ / `TokenPair`↔`LoginResponse`↔ 데스크탑 `LoginResult` 필드(accessToken/refreshToken) 일치 ✓
- **플레이스홀더 스캔:** 없음(모든 스텝에 실제 코드/명령 포함) ✓
- **알려진 단순화:** SecurityConfig는 permitAll + 컨트롤러 내 토큰 검증(슬라이스 테스트 용이). 운영 강화(필터 기반 인증, admin IP 제한)는 인프라 단계 TODO.
