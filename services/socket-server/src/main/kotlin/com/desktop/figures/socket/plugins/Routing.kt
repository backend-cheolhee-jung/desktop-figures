package com.desktop.figures.socket.plugins

import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.websocket.*
import io.ktor.websocket.*

fun Application.configureRouting() {
    routing {
        get("/health") {
            call.respondText("OK")
        }

        webSocket("/ws/status") {
            send("connected")
            for (frame in incoming) {
                if (frame is Frame.Text) {
                    val text = frame.readText()
                    // TODO: 친구 상태 브로드캐스트 구현 (feature/friend-status-broadcast)
                    send("echo: $text")
                }
            }
        }
    }
}
