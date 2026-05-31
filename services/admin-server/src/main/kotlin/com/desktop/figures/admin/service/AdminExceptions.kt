package com.desktop.figures.admin.service

class AdminLoginFailedException : RuntimeException("운영자 인증 실패")
class RegistrationNotPendingException : RuntimeException("PENDING 상태의 가입 신청이 아닙니다.")
