package com.hiphophub;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Main Application Class for HipHopHub Backend
 * 
 * This is the entry point of our Spring Boot application.
 * @SpringBootApplication annotation enables:
 * - Component scanning
 * - Auto-configuration
 * - Property support
 */
@SpringBootApplication
@EnableScheduling
public class HipHopHubApplication {

    public static void main(String[] args) {
        SpringApplication.run(HipHopHubApplication.class, args);
        System.out.println("\n🎵 HipHopHub Backend is running on http://localhost:8080 🎵\n");
    }
}
