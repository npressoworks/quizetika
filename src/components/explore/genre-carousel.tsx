'use client';

import React from 'react';
import Image from 'next/image';
import type { GenreMetadata } from '@/types';
import styles from './explore-carousel.module.css';

export interface GenreCarouselProps {
  genres: GenreMetadata[];
  loading: boolean;
  error: string | null;
  selectedGenreId: string;
  onSelect: (genreId: string) => void;
  onRetry?: () => void;
  emptyMessage?: string;
}

export function GenreCarousel({
  genres,
  loading,
  error,
  selectedGenreId,
  onSelect,
  onRetry,
  emptyMessage = '表示できるジャンルがありません。',
}: GenreCarouselProps) {
  if (loading) {
    return <p className={styles.status}>ジャンルを読み込み中...</p>;
  }

  if (error) {
    return (
      <p className={`${styles.status} ${styles.error}`} role="alert">
        {error}
        {onRetry && (
          <button type="button" className={styles.retryBtn} onClick={onRetry}>
            再試行
          </button>
        )}
      </p>
    );
  }

  if (genres.length === 0) {
    return <p className={styles.status}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.carousel} data-testid="genre-carousel">
      {genres.map((genre) => {
        const selected = selectedGenreId === genre.id;
        return (
          <button
            key={genre.id}
            type="button"
            className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
            data-testid={`genre-carousel-card-${genre.id}`}
            aria-pressed={selected}
            onClick={() => onSelect(selected ? '' : genre.id)}
          >
            <div className={styles.cardIcon}>
              {genre.iconImageUrl ? (
                <Image
                  src={genre.iconImageUrl}
                  alt=""
                  width={32}
                  height={32}
                  unoptimized
                />
              ) : (
                <span aria-hidden>📚</span>
              )}
            </div>
            <span className={styles.cardLabel}>{genre.displayName}</span>
          </button>
        );
      })}
    </div>
  );
}
