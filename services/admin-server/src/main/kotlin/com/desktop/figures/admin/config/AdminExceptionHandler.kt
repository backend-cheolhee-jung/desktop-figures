package com.desktop.figures.admin.config

import com.desktop.figures.admin.service.AdminLoginFailedException
import com.desktop.figures.admin.service.RegistrationNotPendingException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class AdminExceptionHandler {

    @ExceptionHandler(AdminLoginFailedException::class)
    fun loginFailed(e: AdminLoginFailedException) =
        ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("message" to e.message))

    @ExceptionHandler(RegistrationNotPendingException::class)
    fun notPending(e: RegistrationNotPendingException) =
        ResponseEntity.status(HttpStatus.CONFLICT).body(mapOf("message" to e.message))
}
