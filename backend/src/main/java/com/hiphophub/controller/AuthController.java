package com.hiphophub.controller;

import com.hiphophub.model.User;
import com.hiphophub.repository.UserRepository;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:5173" })
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PostMapping("/signup")
    public ResponseEntity<Map<String, Object>> signup(@RequestBody Map<String, String> payload) {
        String username = safe(payload.get("username"));
        String email = safe(payload.get("email"));
        String password = safe(payload.get("password"));

        if (username.isBlank() || email.isBlank() || password.isBlank()) {
            return ResponseEntity.badRequest().body(error("All fields are required."));
        }
        if (password.length() < 6) {
            return ResponseEntity.badRequest().body(error("Password must be at least 6 characters."));
        }
        if (userRepository.existsByUsername(username)) {
            return ResponseEntity.badRequest().body(error("Username is already taken."));
        }
        if (userRepository.existsByEmail(email)) {
            return ResponseEntity.badRequest().body(error("Email is already registered."));
        }

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        userRepository.save(user);

        return ResponseEntity.ok(userResponse(user));
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> payload) {
        String identifier = safe(payload.get("identifier"));
        String password = safe(payload.get("password"));

        if (identifier.isBlank() || password.isBlank()) {
            return ResponseEntity.badRequest().body(error("Identifier and password are required."));
        }

        Optional<User> userOpt = userRepository.findByUsername(identifier);
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByEmail(identifier);
        }

        if (userOpt.isEmpty() || !passwordEncoder.matches(password, userOpt.get().getPasswordHash())) {
            return ResponseEntity.status(401).body(error("Invalid credentials."));
        }

        return ResponseEntity.ok(userResponse(userOpt.get()));
    }

    private Map<String, Object> userResponse(User user) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", user.getId());
        response.put("username", user.getUsername());
        response.put("email", user.getEmail());
        return response;
    }

    private Map<String, Object> error(String message) {
        Map<String, Object> response = new HashMap<>();
        response.put("error", message);
        return response;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
