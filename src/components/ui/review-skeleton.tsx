import React from 'react';
import styles from './review-skeleton.module.css';

interface ReviewSkeletonProps {
  'data-testid'?: string;
}

export function ReviewSkeleton({ 'data-testid': testId = 'review-skeleton' }: ReviewSkeletonProps) {
  return (
    <div className={styles.skeletonWrapper} data-testid={testId}>
      <div className={`${styles.title} ${styles.pulse}`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
        <div className={`${styles.desc} ${styles.pulse}`} />
        <div className={`${styles.descLine2} ${styles.pulse}`} />
      </div>

      <div className={styles.genreSelector}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.genreCard}>
            <div className={`${styles.genreIcon} ${styles.pulse}`} />
            <div className={`${styles.genreLabel} ${styles.pulse}`} />
          </div>
        ))}
      </div>

      <div className={`${styles.startBtn} ${styles.pulse}`} />
    </div>
  );
}
