import React from 'react';
import styles from './feedback-skeleton.module.css';

interface FeedbackSkeletonProps {
  'data-testid'?: string;
}

export function FeedbackSkeleton({ 'data-testid': testId = 'feedback-list-skeleton' }: FeedbackSkeletonProps) {
  return (
    <div className={styles.card} data-testid={testId}>
      <div className={`${styles.title} ${styles.pulse}`} />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={styles.feedbackCard}>
          <div className={`${styles.lineShort} ${styles.pulse}`} />
          <div className={`${styles.lineBody} ${styles.pulse}`} />
          <div className={`${styles.lineBody} ${styles.pulse}`} style={{ width: '70%' }} />
        </div>
      ))}
    </div>
  );
}
