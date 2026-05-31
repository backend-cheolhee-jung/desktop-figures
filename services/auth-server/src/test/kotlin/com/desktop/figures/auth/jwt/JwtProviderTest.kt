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
