package com.desktop.figures.admin.jwt

import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.util.Date
import javax.crypto.SecretKey

@Component
class AdminJwtProvider(
    @Value("\${admin-jwt.secret}") secret: String,
    @Value("\${admin-jwt.expiration}") private val expiration: Long,
) {
    private val key: SecretKey = Keys.hmacShaKeyFor(secret.toByteArray())

    fun createToken(username: String): String {
        val now = Date()
        return Jwts.builder()
            .subject(username)
            .issuedAt(now)
            .expiration(Date(now.time + expiration))
            .signWith(key)
            .compact()
    }

    fun parseSubject(token: String): String =
        Jwts.parser().verifyWith(key).build()
            .parseSignedClaims(token).payload.subject
}
