package com.desktop.figures.admin.dao

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository

data class AdminUserRow(val id: String, val username: String, val passwordHash: String)

@Repository
class AdminUserDao(private val jdbc: JdbcTemplate) {

    fun findByUsername(username: String): AdminUserRow? =
        jdbc.query(
            "SELECT id, username, password_hash FROM admin_users WHERE username = ?",
            { rs, _ ->
                AdminUserRow(
                    rs.getString("id"),
                    rs.getString("username"),
                    rs.getString("password_hash"),
                )
            },
            username,
        ).firstOrNull()

    fun existsByUsername(username: String): Boolean =
        jdbc.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM admin_users WHERE username = ?)",
            Boolean::class.java,
            username,
        ) ?: false

    fun insert(username: String, passwordHash: String) {
        jdbc.update(
            "INSERT INTO admin_users (username, password_hash) VALUES (?, ?)",
            username,
            passwordHash,
        )
    }
}
