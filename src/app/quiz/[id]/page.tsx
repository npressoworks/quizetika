import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowBackOutlined } from '@mui/icons-material';
import { QuizDetailClient } from './quiz-detail-client';
import { QuizDualLeaderboard } from '@/components/quiz/quiz-dual-leaderboard';
import { DetailSkeleton } from '@/components/quiz/detail-skeleton';
import { LeaderboardSkeleton } from '@/components/quiz/leaderboard-skeleton';
import { getQuiz } from '@/services/quiz';
import { detailClasses as styles } from './detail-classes';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function QuizDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const quizId = resolvedParams.id;

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.backBtn}>
        <ArrowBackOutlined sx={{ fontSize: 16 }} />
        探索に戻る
      </Link>

      <div className={styles.layout}>
        <Suspense fallback={<DetailSkeleton data-testid="quiz-detail-skeleton" />}>
          <QuizDetailLoader quizId={quizId} />
        </Suspense>

        <Suspense fallback={<LeaderboardSkeleton data-testid="leaderboard-skeleton" />}>
          <QuizLeaderboardLoader quizId={quizId} />
        </Suspense>
      </div>
    </div>
  );
}

async function QuizDetailLoader({ quizId }: { quizId: string }) {
  // クライアント側でフェッチを行わせる
  return <QuizDetailClient quizId={quizId} />;
}

async function QuizLeaderboardLoader({ quizId }: { quizId: string }) {
  // クライアント側でフェッチを行わせる
  return <QuizDualLeaderboard quizId={quizId} />;
}
