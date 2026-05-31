package com.desktop.figures.admin

import com.desktop.figures.admin.config.AdminJwtProperties
import com.desktop.figures.admin.config.AdminSeedProperties
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication

@SpringBootApplication
@EnableConfigurationProperties(AdminJwtProperties::class, AdminSeedProperties::class)
class AdminApplication

fun main(args: Array<String>) {
    runApplication<AdminApplication>(*args)
}
