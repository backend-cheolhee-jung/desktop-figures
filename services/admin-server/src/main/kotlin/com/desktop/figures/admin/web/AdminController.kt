package com.desktop.figures.admin.web

import com.desktop.figures.admin.dao.RegistrationRow
import com.desktop.figures.admin.service.AdminService
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/admin")
class AdminController(private val adminService: AdminService) {

    @PostMapping("/login")
    fun login(@Valid @RequestBody req: AdminLoginRequest): AdminLoginResponse =
        AdminLoginResponse(adminService.login(req.username, req.password))

    @GetMapping("/registrations")
    fun registrations(
        @RequestHeader(value = "Authorization", required = false) auth: String?,
        @RequestParam(defaultValue = "PENDING") status: String,
    ): List<RegistrationRow> {
        adminService.verify(auth)
        return adminService.pendingRegistrations()
    }

    @PostMapping("/registrations/{userId}/approve")
    fun approve(
        @RequestHeader(value = "Authorization", required = false) auth: String?,
        @PathVariable userId: String,
    ) {
        adminService.verify(auth)
        adminService.approve(userId)
    }

    @PostMapping("/registrations/{userId}/reject")
    fun reject(
        @RequestHeader(value = "Authorization", required = false) auth: String?,
        @PathVariable userId: String,
        @Valid @RequestBody req: RejectRequest,
    ) {
        adminService.verify(auth)
        adminService.reject(userId, req.reason)
    }
}
