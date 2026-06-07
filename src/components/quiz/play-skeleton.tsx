import React from 'react';
import styles from './play-skeleton.module.css';

interface PlaySkeletonProps {
  'data-testid'?: string;
}

export function PlaySkeleton({
  'data-testid': testId = 'quiz-play-skeleton',
}: PlaySkeletonProps) {
  return (
    <div className={styles.skeletonRoot} data-testid={testId}>
      <div className={styles.headerRow}>
        <div className={`${styles.backBtn} ${styles.pulse}`} />
        <div className={`${styles.statusChip} ${styles.pulse}`} />
      </div>

      <div>
        <div className={`${styles.progressBar} ${styles.pulse}`}>
          <div className={styles.progressFill} />
        </div>
        <div className={styles.progressMeta}>
          <div className={`${styles.metaLine} ${styles.pulse}`} />
          <div className={`${styles.metaLine} ${styles.pulse}`} />
        </div>
      </div>

      <div className={styles.quizCard}>
        <div className={`${styles.questionType} ${styles.pulse}`} />
        <div className={`${styles.questionText} ${styles.pulse}`} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${styles.choice} ${styles.pulse}`} />
        ))}
      </div>
    </div>
  );
}
