'use client';

import React from 'react';
import { getDifficultyColor } from '@/lib/difficulty-color';
import styles from './difficulty-vote-stars.module.css';

export interface DifficultyVoteStarsProps {
  value: number | null;
  onVote: (level: number) => void;
  disabled?: boolean;
  maxLevel?: number;
}

export function DifficultyVoteStars({
  value,
  onVote,
  disabled = false,
  maxLevel = 5,
}: DifficultyVoteStarsProps) {
  const levels = Array.from({ length: maxLevel }, (_, i) => i + 1);

  return (
    <div
      className={styles.starsRow}
      data-testid="difficulty-vote-stars"
      aria-label="体感難易度を星で投票"
    >
      {levels.map((level) => {
        const isFilled = value !== null && level <= value;
        const starColor = getDifficultyColor(value !== null && level <= value ? value : level);

        return (
          <button
            key={level}
            type="button"
            className={`${styles.starBtn} ${isFilled ? styles.starBtnFilled : ''}`}
            data-testid={`difficulty-vote-star-${level}`}
            style={{ color: starColor }}
            onClick={() => onVote(level)}
            disabled={disabled}
            aria-label={`難易度 ${level}`}
          >
            {isFilled ? '★' : '☆'}
          </button>
        );
      })}
    </div>
  );
}
