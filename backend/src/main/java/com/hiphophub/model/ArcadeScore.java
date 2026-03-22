package com.hiphophub.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "arcade_scores")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ArcadeScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Mode mode;

    @Column(nullable = false)
    private Integer points;

    @Column(name = "meta_label")
    private String metaLabel;

    @Column(name = "played_at", nullable = false)
    private LocalDateTime playedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @PrePersist
    protected void onCreate() {
        playedAt = LocalDateTime.now();
    }

    public enum Mode {
        RAPID_FIRE,
        COMPLETE_THE_LYRIC
    }
}
