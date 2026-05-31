package com.desktop.figures.auth.user

import com.desktop.figures.auth.jwt.JwtProvider
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*
import java.util.UUID

@RestController
@RequestMapping("/auth")
class AuthController(
    private val authService: AuthService,
    private val jwtProvider: JwtProvider,
) {
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    fun register(@Valid @RequestBody req: RegisterRequest): RegisterResponse {
        val u = authService.register(req.email, req.password, req.nickname)
        return RegisterResponse(u.id.toString(), u.status.name)
    }

    @PostMapping("/login")
    fun login(@Valid @RequestBody req: LoginRequest): LoginResponse {
        val t = authService.login(req.email, req.password)
        return LoginResponse(t.accessToken, t.refreshToken)
    }

    @GetMapping("/me")
    fun me(@RequestHeader("Authorization") authorization: String): MeResponse {
        val token = authorization.removePrefix("Bearer ").trim()
        val userId = UUID.fromString(jwtProvider.parseSubject(token))
        val u = authService.me(userId)
        return MeResponse(u.id.toString(), u.email, u.nickname, u.status.name)
    }

    @PostMapping("/refresh")
    fun refresh(@Valid @RequestBody req: RefreshRequest): AccessTokenResponse =
        AccessTokenResponse(authService.refresh(req.refreshToken))
}
