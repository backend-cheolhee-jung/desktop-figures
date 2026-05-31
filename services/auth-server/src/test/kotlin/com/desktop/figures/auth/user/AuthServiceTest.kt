package com.desktop.figures.auth.user

import com.desktop.figures.auth.jwt.JwtProvider
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder

class AuthServiceTest {
    private val encoder = BCryptPasswordEncoder()
    private val jwt = JwtProvider("test-secret-key-minimum-32-characters-long-xx", 900000, 604800000)

    private fun newService(repo: UserRepository) = AuthService(repo, encoder, jwt)

    @Test
    fun `가입하면 PENDING 상태로 저장된다`() {
        val repo = mock<UserRepository> {
            on { existsByEmail("a@b.com") } doReturn false
            onGeneric { save(any()) } doAnswer { it.arguments[0] as User }
        }
        val user = newService(repo).register("a@b.com", "pw123456", "닉")
        assertEquals(UserStatus.PENDING, user.status)
        assertTrue(encoder.matches("pw123456", user.passwordHash))
    }

    @Test
    fun `중복 이메일 가입은 예외`() {
        val repo = mock<UserRepository> {
            on { existsByEmail("a@b.com") } doReturn true
        }
        assertThrows<EmailAlreadyExistsException> { newService(repo).register("a@b.com", "x", "y") }
    }

    @Test
    fun `PENDING 회원 로그인은 NotApproved 예외`() {
        val stored = User(email = "a@b.com", passwordHash = encoder.encode("pw123456"), nickname = "닉")
        val repo = mock<UserRepository> {
            on { findByEmail("a@b.com") } doReturn stored
        }
        val ex = assertThrows<NotApprovedException> { newService(repo).login("a@b.com", "pw123456") }
        assertEquals(UserStatus.PENDING, ex.status)
    }

    @Test
    fun `APPROVED 회원은 토큰을 받는다`() {
        val stored = User(
            id = java.util.UUID.randomUUID(),
            email = "a@b.com",
            passwordHash = encoder.encode("pw123456"),
            nickname = "닉",
            status = UserStatus.APPROVED,
        )
        val repo = mock<UserRepository> {
            on { findByEmail("a@b.com") } doReturn stored
        }
        val tokens = newService(repo).login("a@b.com", "pw123456")
        assertNotNull(tokens.accessToken)
        assertNotNull(tokens.refreshToken)
    }
}
