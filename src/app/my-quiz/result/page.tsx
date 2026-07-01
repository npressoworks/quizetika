import React, { Suspense } from 'react';
import { MyQuizResultClient } from './my-quiz-result-client';
import { PlaySkeleton } from '@/components/quiz/play-skeleton';

export const dynamic = 'force-dynamic';

export default function MyQuizResultPage() {
  return (
    <Suspense fallback={<PlaySkeleton />}>
      <MyQuizResultClient />
    </Suspense>
  );
}
