package com.desktop.figures.auth.user

import com.desktop.figures.auth.jwt.JwtProvider
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import java.util.UUID

data class TokenPair(val accessToken: String, val refreshToken: String)

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val jwtProvider: JwtProvider,
) {
    fun register(email: String, password: String, nickname: String): User {
        if (userRepository.existsByEmail(email)) throw EmailAlreadyExistsException()
        val user = User(
            email = email,
            passwordHash = passwordEncoder.encode(password),
            nickname = nickname,
        )
        return userRepository.save(user)
    }

    fun login(email: String, password: String): TokenPair {
        val user = userRepository.findByEmail(email) ?: throw InvalidCredentialsException()
        if (!passwordEncoder.matches(password, user.passwordHash)) throw InvalidCredentialsException()
        if (user.status != UserStatus.APPROVED) throw NotApprovedException(user.status, user.rejectReason)
        val id = user.id!!
        return TokenPair(jwtProvider.createAccessToken(id), jwtProvider.createRefreshToken(id))
    }

    fun me(userId: UUID): User =
        userRepository.findById(userId).orElseThrow { InvalidCredentialsException() }

    fun refresh(refreshToken: String): String {
        val userId = UUID.fromString(jwtProvider.parseSubject(refreshToken))
        return jwtProvider.createAccessToken(userId)
    }
}
