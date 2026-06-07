import React from 'react';
import styles from './stats-skeleton.module.css';

interface StatsSkeletonProps {
  'data-testid'?: string;
}

export function StatsSkeleton({ 'data-testid': testId = 'stats-skeleton' }: StatsSkeletonProps) {
  return (
    <div className={styles.statsGrid} data-testid={testId}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={styles.statCard}>
          <div className={`${styles.icon} ${styles.pulse}`} />
          <div>
            <div className={`${styles.lineShort} ${styles.pulse}`} />
            <div className={`${styles.lineValue} ${styles.pulse}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
