package com.desktop.figures.admin.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "admin-jwt")
data class AdminJwtProperties(
    val secret: String,
    val expiration: Long,
)

@ConfigurationProperties(prefix = "admin-seed")
data class AdminSeedProperties(
    val username: String,
    val password: String,
)
