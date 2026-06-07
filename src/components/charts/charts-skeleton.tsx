import React from 'react';
import styles from './charts-skeleton.module.css';

interface ChartsSkeletonProps {
  'data-testid'?: string;
}

export function ChartsSkeleton({ 'data-testid': testId = 'charts-skeleton' }: ChartsSkeletonProps) {
  return (
    <div className={styles.analyticsRow} data-testid={testId}>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className={styles.card}>
          <div className={`${styles.title} ${styles.pulse}`} />
          <div className={`${styles.chart} ${styles.pulse}`} />
        </div>
      ))}
    </div>
  );
}
