plugins {
    kotlin("jvm") version "2.0.21" apply false
    kotlin("plugin.spring") version "2.0.21" apply false
    kotlin("plugin.serialization") version "2.0.21" apply false
    id("org.springframework.boot") version "3.4.5" apply false
    id("io.spring.dependency-management") version "1.1.7" apply false
    id("io.ktor.plugin") version "3.1.2" apply false
}

allprojects {
    group = "com.desktop.figures"
    version = "1.0.0"

    repositories {
        mavenCentral()
    }
}
