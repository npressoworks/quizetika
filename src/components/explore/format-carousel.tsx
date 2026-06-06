'use client';

import React from 'react';
import type { QuizFormat } from '@/lib/quiz-format';
import { EXPLORE_FORMAT_OPTIONS } from '@/lib/explore-formats';
import styles from './explore-carousel.module.css';

export interface FormatCarouselProps {
  selectedFormat: QuizFormat | '';
  onSelect: (format: QuizFormat | '') => void;
}

export function FormatCarousel({ selectedFormat, onSelect }: FormatCarouselProps) {
  return (
    <div className={styles.carousel} data-testid="format-carousel">
      {EXPLORE_FORMAT_OPTIONS.map((option) => {
        const selected = selectedFormat === option.id;
        return (
          <button
            key={option.id}
            type="button"
            className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
            data-testid={`format-carousel-card-${option.id}`}
            aria-pressed={selected}
            onClick={() => onSelect(selected ? '' : option.id)}
          >
            <div className={styles.cardIcon} aria-hidden>
              {option.icon}
            </div>
            <span className={styles.cardLabel}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
