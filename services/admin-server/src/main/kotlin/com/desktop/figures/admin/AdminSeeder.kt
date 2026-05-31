package com.desktop.figures.admin

import com.desktop.figures.admin.config.AdminSeedProperties
import com.desktop.figures.admin.dao.AdminUserDao
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Component

@Component
class AdminSeeder(
    private val adminUserDao: AdminUserDao,
    private val passwordEncoder: PasswordEncoder,
    private val props: AdminSeedProperties,
) {
    @EventListener(ApplicationReadyEvent::class)
    fun seed() {
        if (!adminUserDao.existsByUsername(props.username)) {
            adminUserDao.insert(props.username, passwordEncoder.encode(props.password))
        }
    }
}
