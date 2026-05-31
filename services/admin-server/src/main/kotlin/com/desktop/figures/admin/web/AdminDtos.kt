package com.desktop.figures.admin.web

import jakarta.validation.constraints.NotBlank

data class AdminLoginRequest(
    @field:NotBlank val username: String,
    @field:NotBlank val password: String,
)
data class AdminLoginResponse(val adminToken: String)
data class RejectRequest(@field:NotBlank val reason: String)
