import React from 'react';
import { SkeletonCard } from './skeleton-card';
import styles from './bookmarks-skeleton.module.css';

interface BookmarksSkeletonProps {
  'data-testid'?: string;
}

export function BookmarksSkeleton({ 'data-testid': testId = 'bookmarks-skeleton' }: BookmarksSkeletonProps) {
  return (
    <div className={styles.skeletonWrapper} data-testid={testId}>
      <div className={`${styles.backBtn} ${styles.pulse}`} />
      
      <div className={styles.titleSection}>
        <div className={`${styles.title} ${styles.pulse}`} />
        <div className={`${styles.desc} ${styles.pulse}`} />
      </div>

      <div className={styles.tabBar}>
        <div className={`${styles.tab} ${styles.pulse}`} />
        <div className={`${styles.tab} ${styles.pulse}`} />
        <div className={`${styles.tab} ${styles.pulse}`} />
      </div>

      <div className={styles.grid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
