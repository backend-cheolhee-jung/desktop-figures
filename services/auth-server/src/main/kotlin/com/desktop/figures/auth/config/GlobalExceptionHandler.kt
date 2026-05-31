package com.desktop.figures.auth.config

import com.desktop.figures.auth.user.EmailAlreadyExistsException
import com.desktop.figures.auth.user.InvalidCredentialsException
import com.desktop.figures.auth.user.NotApprovedException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(EmailAlreadyExistsException::class)
    fun emailExists(e: EmailAlreadyExistsException) =
        ResponseEntity.status(HttpStatus.CONFLICT).body(mapOf("message" to e.message))

    @ExceptionHandler(InvalidCredentialsException::class)
    fun invalidCreds(e: InvalidCredentialsException) =
        ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("message" to e.message))

    @ExceptionHandler(NotApprovedException::class)
    fun notApproved(e: NotApprovedException) =
        ResponseEntity.status(HttpStatus.FORBIDDEN).body(
            mapOf("status" to e.status.name, "rejectReason" to e.rejectReason)
        )
}
