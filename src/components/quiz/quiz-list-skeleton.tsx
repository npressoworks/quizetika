import React from 'react';
import styles from './quiz-list-skeleton.module.css';

interface QuizListSkeletonProps {
  'data-testid'?: string;
}

export function QuizListSkeleton({ 'data-testid': testId = 'quiz-list-skeleton' }: QuizListSkeletonProps) {
  return (
    <div className={styles.card} data-testid={testId}>
      <div className={`${styles.title} ${styles.pulse}`} />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={styles.row}>
          <div>
            <div className={`${styles.lineTitle} ${styles.pulse}`} />
            <div className={`${styles.lineMeta} ${styles.pulse}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
