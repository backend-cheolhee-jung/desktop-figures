package com.desktop.figures.admin.jwt

import com.desktop.figures.admin.config.AdminJwtProperties
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.stereotype.Component
import java.util.Date
import javax.crypto.SecretKey

@Component
class AdminJwtProvider(props: AdminJwtProperties) {
    private val key: SecretKey = Keys.hmacShaKeyFor(props.secret.toByteArray())
    private val expiration: Long = props.expiration

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
