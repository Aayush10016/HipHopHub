package com.hiphophub.controller;

import com.hiphophub.model.ArcadeScore;
import com.hiphophub.model.User;
import com.hiphophub.repository.ArcadeScoreRepository;
import com.hiphophub.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/user")
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:5173" })
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ArcadeScoreRepository arcadeScoreRepository;

    @GetMapping("/profile/{userId}")
    public ResponseEntity<?> getUserProfile(@PathVariable Long userId) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        User user = userOpt.get();

        Map<String, Object> profile = new HashMap<>();
        profile.put("id", user.getId());
        profile.put("username", user.getUsername());
        profile.put("email", user.getEmail());
        profile.put("joinDate", user.getCreatedAt() != null ? user.getCreatedAt().toString() : null);

        Map<String, Integer> scores = new HashMap<>();
        for (ArcadeScore.Mode mode : ArcadeScore.Mode.values()) {
            Integer bestScore = arcadeScoreRepository.getBestScoreByUserAndMode(userId, mode);
            scores.put(mode.name(), bestScore != null ? bestScore : 0);
        }
        profile.put("scores", scores);

        // Mock top fan badge for now
        profile.put("topFanBadge", "Seedhe Maut");

        return ResponseEntity.ok(profile);
    }
}
