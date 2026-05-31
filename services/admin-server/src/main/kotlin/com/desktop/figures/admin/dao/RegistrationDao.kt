package com.desktop.figures.admin.dao

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository

data class RegistrationRow(
    val userId: String,
    val email: String,
    val nickname: String,
    val status: String,
    val createdAt: String,
)

@Repository
class RegistrationDao(private val jdbc: JdbcTemplate) {

    fun findByStatus(status: String): List<RegistrationRow> =
        jdbc.query(
            """SELECT id, email, nickname, status, created_at
               FROM users WHERE status = ? ORDER BY created_at ASC""",
            { rs, _ ->
                RegistrationRow(
                    userId = rs.getString("id"),
                    email = rs.getString("email"),
                    nickname = rs.getString("nickname"),
                    status = rs.getString("status"),
                    createdAt = rs.getString("created_at"),
                )
            },
            status,
        )

    fun approve(userId: String): Int =
        jdbc.update(
            """UPDATE users SET status = 'APPROVED', reject_reason = NULL, updated_at = now()
               WHERE id = ?::uuid AND status = 'PENDING'""",
            userId,
        )

    fun reject(userId: String, reason: String): Int =
        jdbc.update(
            """UPDATE users SET status = 'REJECTED', reject_reason = ?, updated_at = now()
               WHERE id = ?::uuid AND status = 'PENDING'""",
            reason,
            userId,
        )
}
