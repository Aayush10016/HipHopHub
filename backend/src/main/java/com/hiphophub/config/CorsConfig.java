package com.hiphophub.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS Configuration
 *
 * Allows our React frontend (running on localhost) to talk to the backend with credentials.
 */
@Configuration
public class CorsConfig {

    private static final List<String> LOCAL_ORIGINS = List.of(
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173");

    /** Vercel deployment patterns (wildcards need allowedOriginPatterns) */
    private static final List<String> DEPLOYED_PATTERNS = List.of(
            "https://*.vercel.app");

    /**
     * MVC-level CORS for controllers.
     */
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOrigins(LOCAL_ORIGINS.toArray(new String[0]))
                        .allowedOriginPatterns(DEPLOYED_PATTERNS.toArray(new String[0]))
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .allowCredentials(false);
            }
        };
    }

    /**
     * Security CORS configuration so Spring Security uses the same rules.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(LOCAL_ORIGINS);
        config.setAllowedOriginPatterns(DEPLOYED_PATTERNS);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(false);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
