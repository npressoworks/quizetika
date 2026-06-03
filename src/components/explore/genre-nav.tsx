'use client';

import React from 'react';
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

export function GenreNav({ genres, loading, error, onRetry }: GenreNavProps) {
  const router = useRouter();

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

  return (
    <nav className={styles.nav} aria-label="ジャンル" data-testid="genre-nav">
      {genres.map((genre) => (
        <button
          key={genre.id}
          type="button"
          className={styles.button}
          data-testid={`genre-nav-item-${genre.id}`}
          onClick={() => router.push(`/genres/${encodeURIComponent(genre.id)}`)}
        >
          <span className={styles.iconWrap}>
            {genre.iconImageUrl ? (
              <Image
                src={genre.iconImageUrl}
                alt=""
                width={40}
                height={40}
                className={styles.iconImg}
                unoptimized
              />
            ) : (
              <span aria-hidden>📚</span>
            )}
          </span>
          <span className={styles.label}>{genre.displayName}</span>
        </button>
      ))}
    </nav>
  );
}
