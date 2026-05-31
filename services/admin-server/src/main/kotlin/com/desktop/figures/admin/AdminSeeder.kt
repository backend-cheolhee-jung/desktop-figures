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
