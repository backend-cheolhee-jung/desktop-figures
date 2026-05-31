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
        adminJwtProvider.parseSubject(token)
    }

    fun pendingRegistrations(): List<RegistrationRow> =
        registrationDao.findByStatus("PENDING")

    fun approve(userId: String) {
        if (registrationDao.approve(userId) == 0) throw RegistrationNotPendingException()
    }

    fun reject(userId: String, reason: String) {
        if (registrationDao.reject(userId, reason) == 0) throw RegistrationNotPendingException()
    }
}
