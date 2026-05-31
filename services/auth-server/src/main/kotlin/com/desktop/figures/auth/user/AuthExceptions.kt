package com.desktop.figures.auth.user

class EmailAlreadyExistsException : RuntimeException("이미 가입된 이메일입니다.")
class InvalidCredentialsException : RuntimeException("이메일 또는 비밀번호가 올바르지 않습니다.")
class NotApprovedException(val status: UserStatus, val rejectReason: String?) :
    RuntimeException("로그인이 허용되지 않은 계정입니다: $status")
