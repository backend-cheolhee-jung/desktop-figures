package com.desktop.figures.socket

import com.desktop.figures.socket.plugins.configureRouting
import com.desktop.figures.socket.plugins.configureSockets
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*

fun main() {
    embeddedServer(
        Netty,
        port = System.getenv("PORT")?.toInt() ?: 9090,
        host = "0.0.0.0",
        module = Application::module,
    ).start(wait = true)
}

fun Application.module() {
    configureSockets()
    configureRouting()
}
