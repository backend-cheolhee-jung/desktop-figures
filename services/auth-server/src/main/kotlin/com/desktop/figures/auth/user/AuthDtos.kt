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
