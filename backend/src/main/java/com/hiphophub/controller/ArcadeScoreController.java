package com.hiphophub.controller;

import com.hiphophub.model.ArcadeScore;
import com.hiphophub.model.User;
import com.hiphophub.repository.ArcadeScoreRepository;
import com.hiphophub.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/arcade")
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:5173" })
public class ArcadeScoreController {

    @Autowired
    private ArcadeScoreRepository arcadeScoreRepository;

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/score")
    public ResponseEntity<Map<String, Object>> saveScore(@RequestBody Map<String, Object> payload) {
        Long userId = parseLong(payload.get("userId"));
        Integer points = parseInteger(payload.get("points"));
        String modeValue = payload.get("mode") == null ? "" : payload.get("mode").toString().trim();
        String metaLabel = payload.get("metaLabel") == null ? "" : payload.get("metaLabel").toString().trim();

        if (userId == null || points == null || points < 0 || modeValue.isBlank()) {
            return ResponseEntity.badRequest().body(error("Invalid arcade score payload."));
        }

        ArcadeScore.Mode mode;
        try {
            mode = ArcadeScore.Mode.valueOf(modeValue);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(error("Unsupported arcade mode."));
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.badRequest().body(error("User not found."));
        }

        ArcadeScore score = new ArcadeScore();
        score.setUser(user);
        score.setMode(mode);
        score.setPoints(points);
        score.setMetaLabel(metaLabel.isBlank() ? null : metaLabel);
        arcadeScoreRepository.save(score);

        Integer best = arcadeScoreRepository.getBestScoreByUserAndMode(userId, mode);
        Map<String, Object> response = new HashMap<>();
        response.put("saved", true);
        response.put("bestScore", best == null ? points : best);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/leaderboard")
    public List<Map<String, Object>> getLeaderboard(@RequestParam String mode) {
        ArcadeScore.Mode parsedMode = ArcadeScore.Mode.valueOf(mode.trim().toUpperCase());
        return arcadeScoreRepository.getModeLeaderboard(parsedMode).stream()
                .limit(20)
                .map(row -> {
                    Map<String, Object> entry = new HashMap<>();
                    entry.put("userId", row[0]);
                    entry.put("username", row[1]);
                    entry.put("bestPoints", row[2]);
                    return entry;
                })
                .toList();
    }

    private Map<String, Object> error(String message) {
        Map<String, Object> response = new HashMap<>();
        response.put("error", message);
        return response;
    }

    private Long parseLong(Object raw) {
        try {
            return raw == null ? null : Long.valueOf(raw.toString());
        } catch (Exception e) {
            return null;
        }
    }

    private Integer parseInteger(Object raw) {
        try {
            return raw == null ? null : Integer.valueOf(raw.toString());
        } catch (Exception e) {
            return null;
        }
    }
}
