import React, { Suspense } from 'react';
import { PlaySkeleton } from '@/components/quiz/play-skeleton';
import { TestPlayClientBoundary } from './test-play-client';
import styles from '@/app/quiz/[id]/play/play.module.css';

export default function TestPlayPage() {
  return (
    <div className={styles.container}>
      <Suspense fallback={<PlaySkeleton data-testid="quiz-play-skeleton" />}>
        <TestPlayClientBoundary />
      </Suspense>
    </div>
  );
}
