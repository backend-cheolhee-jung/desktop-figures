package com.desktop.figures.admin.web

import com.desktop.figures.admin.service.AdminLoginFailedException
import com.desktop.figures.admin.service.AdminService
import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.http.MediaType
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@WebMvcTest(
    controllers = [AdminController::class],
    excludeAutoConfiguration = [
        org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration::class,
        org.springframework.boot.autoconfigure.security.servlet.SecurityFilterAutoConfiguration::class,
    ]
)
@TestPropertySource(properties = [
    "admin-jwt.secret=test-admin-secret-key-minimum-32-characters-xx",
    "admin-jwt.expiration=3600000",
    "admin-seed.username=operator",
    "admin-seed.password=operator1234",
    "jasypt.encryptor.password=test",
])
class AdminControllerTest {

    @Autowired lateinit var mockMvc: MockMvc
    @Autowired lateinit var objectMapper: ObjectMapper
    @MockBean lateinit var adminService: AdminService

    @Test
    fun `로그인 성공 시 토큰 반환`() {
        whenever(adminService.login(any(), any())).thenReturn("admin-token")

        mockMvc.perform(
            post("/admin/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(AdminLoginRequest("operator", "operator1234")))
        ).andExpect(status().isOk)
         .andExpect(jsonPath("$.adminToken").value("admin-token"))
    }

    @Test
    fun `잘못된 자격증명은 401 반환`() {
        whenever(adminService.login(any(), any())).thenThrow(AdminLoginFailedException())

        mockMvc.perform(
            post("/admin/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(AdminLoginRequest("operator", "wrong")))
        ).andExpect(status().isUnauthorized)
    }
}
