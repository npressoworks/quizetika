import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { QuizDetailClient } from './quiz-detail-client';
import { QuizDualLeaderboard } from '@/components/quiz/quiz-dual-leaderboard';
import { DetailSkeleton } from '@/components/quiz/detail-skeleton';
import { LeaderboardSkeleton } from '@/components/quiz/leaderboard-skeleton';
import { getQuiz } from '@/services/quiz';
import styles from './page.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function QuizDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const quizId = resolvedParams.id;

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.backBtn}>
        <ArrowLeft size={16} />
        探索に戻る
      </Link>

      <div className={styles.layout}>
        <Suspense fallback={<DetailSkeleton data-testid="quiz-detail-skeleton" />}>
          <QuizDetailLoader quizId={quizId} />
        </Suspense>
      </div>

      <Suspense fallback={<LeaderboardSkeleton data-testid="leaderboard-skeleton" />}>
        <QuizLeaderboardLoader quizId={quizId} />
      </Suspense>
    </div>
  );
}

async function QuizDetailLoader({ quizId }: { quizId: string }) {
  const quiz = await getQuiz(quizId);

  if (!quiz) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', width: '100%' }}>
        <h2 style={{ color: 'var(--text-main)', marginBottom: '16px' }}>クイズが見つかりませんでした</h2>
        <p style={{ color: 'var(--text-muted)' }}>指定されたクイズは削除されたか、公開されていません。</p>
      </div>
    );
  }

  const plainQuiz = JSON.parse(JSON.stringify(quiz));

  return <QuizDetailClient quiz={plainQuiz} />;
}

async function QuizLeaderboardLoader({ quizId }: { quizId: string }) {
  const quiz = await getQuiz(quizId);

  if (!quiz) {
    return null;
  }

  const plainQuiz = JSON.parse(JSON.stringify(quiz));

  return <QuizDualLeaderboard quiz={plainQuiz} />;
}
