package com.desktop.figures.auth.user

import com.desktop.figures.auth.jwt.JwtProvider
import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@WebMvcTest(
    controllers = [AuthController::class],
    excludeAutoConfiguration = [
        org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration::class,
        org.springframework.boot.autoconfigure.security.servlet.SecurityFilterAutoConfiguration::class,
    ]
)
@org.springframework.test.context.TestPropertySource(properties = [
    "jwt.secret=test-secret-key-minimum-32-characters-long-xx",
    "jwt.access-expiration=900000",
    "jwt.refresh-expiration=604800000",
    "jasypt.encryptor.password=test",
])
class AuthControllerTest {

    @Autowired lateinit var mockMvc: MockMvc
    @Autowired lateinit var objectMapper: ObjectMapper
    @MockBean lateinit var authService: AuthService
    @MockBean lateinit var jwtProvider: JwtProvider

    @Test
    fun `register 성공 시 201 반환`() {
        whenever(authService.register(any(), any(), any()))
            .thenReturn(User(email = "a@b.com", passwordHash = "h", nickname = "닉"))

        mockMvc.perform(
            post("/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(RegisterRequest("a@b.com", "pw123456", "닉")))
        ).andExpect(status().isCreated)
         .andExpect(jsonPath("$.status").value("PENDING"))
    }

    @Test
    fun `PENDING 로그인은 403 반환`() {
        whenever(authService.login(any(), any()))
            .thenThrow(NotApprovedException(UserStatus.PENDING, null))

        mockMvc.perform(
            post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(LoginRequest("a@b.com", "pw123456")))
        ).andExpect(status().isForbidden)
         .andExpect(jsonPath("$.status").value("PENDING"))
    }

    @Test
    fun `중복 이메일은 409 반환`() {
        whenever(authService.register(any(), any(), any()))
            .thenThrow(EmailAlreadyExistsException())

        mockMvc.perform(
            post("/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(RegisterRequest("a@b.com", "pw123456", "닉")))
        ).andExpect(status().isConflict)
    }
}
