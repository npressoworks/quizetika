'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { GenreMetadata } from '@/types';
import styles from './genre-nav.module.css';

export interface GenreNavProps {
  genres: GenreMetadata[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

const PRIMARY_GENRE_COUNT = 6;

export function GenreNav({ genres, loading, error, onRetry }: GenreNavProps) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);

  if (loading) {
    return (
      <nav className={styles.nav} aria-label="ジャンル" data-testid="genre-nav">
        <p className={styles.status}>ジャンルを読み込み中...</p>
      </nav>
    );
  }

  if (error) {
    return (
      <nav className={styles.nav} aria-label="ジャンル" data-testid="genre-nav">
        <p className={`${styles.status} ${styles.error}`} role="alert">
          {error}
          {onRetry && (
            <button type="button" className={styles.retryBtn} onClick={onRetry}>
              再試行
            </button>
          )}
        </p>
      </nav>
    );
  }

  if (genres.length === 0) {
    return (
      <nav className={styles.nav} aria-label="ジャンル" data-testid="genre-nav">
        <p className={styles.status}>表示できるジャンルがありません。</p>
      </nav>
    );
  }

  const displayedGenres = showAll ? genres : genres.slice(0, PRIMARY_GENRE_COUNT);
  const hasMore = genres.length > PRIMARY_GENRE_COUNT;

  return (
    <div className={styles.wrapper}>
      <nav className={`${styles.nav} ${showAll ? styles.wrap : styles.scroll}`} aria-label="ジャンル" data-testid="genre-nav">
        {displayedGenres.map((genre) => (
          <button
            key={genre.id}
            type="button"
            className={styles.pill}
            data-testid={`genre-nav-item-${genre.id}`}
            onClick={() => router.push(`/genres/${encodeURIComponent(genre.id)}`)}
          >
            <span className={styles.iconWrap}>
              {genre.iconImageUrl ? (
                <Image
                  src={genre.iconImageUrl}
                  alt=""
                  width={20}
                  height={20}
                  className={styles.iconImg}
                  unoptimized
                />
              ) : (
                <span aria-hidden>📚</span>
              )}
            </span>
            <span className={styles.label}>{genre.displayName}</span>
            {genre.description && (
              <span className={styles.tooltip} role="tooltip">
                {genre.description}
              </span>
            )}
          </button>
        ))}

        {hasMore && (
          <button
            type="button"
            className={`${styles.pill} ${styles.togglePill}`}
            onClick={() => setShowAll(!showAll)}
          >
            <span className={styles.label}>{showAll ? '閉じる' : 'すべて見る'}</span>
          </button>
        )}
      </nav>
    </div>
  );
}
