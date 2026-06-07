import React from 'react';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import styles from './recommend-skeleton.module.css';

interface RecommendSkeletonProps {
  'data-testid'?: string;
}

export function RecommendSkeleton({ 'data-testid': testId = 'recommend-skeleton' }: RecommendSkeletonProps) {
  return (
    <div className={styles.grid} data-testid={testId}>
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
