import React from 'react';
import { SkeletonCard } from './skeleton-card';
import styles from '@/app/page.module.css';

interface GridSkeletonProps {
  'data-testid'?: string;
  count?: number;
}

export function GridSkeleton({ 'data-testid': testId = 'home-feed-skeleton', count = 6 }: GridSkeletonProps) {
  return (
    <div className={styles.grid} data-testid={testId}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
