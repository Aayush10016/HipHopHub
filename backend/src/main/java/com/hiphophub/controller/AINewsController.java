package com.hiphophub.controller;

import com.hiphophub.dto.AINewsResponse;
import com.hiphophub.service.AINewsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * News Controller
 *
 * Provides a lightweight, auto-updating DHH news feed.
 */
@RestController
@RequestMapping("/api/ai-news")
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:5173" })
public class AINewsController {

    @Autowired
    private AINewsService aiNewsService;

    @GetMapping
    public AINewsResponse getNews() {
        return aiNewsService.getLatestNews();
    }
}
