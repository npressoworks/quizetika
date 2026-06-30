import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowBackOutlined } from '@mui/icons-material';
import { cookies } from 'next/headers';
import { getQuiz, getQuizzesByAuthor } from '@/services/quiz';
import { getAttemptByIdForUser } from '@/services/attempt-server';
import { Attempt, Quiz } from '@/types';
import { QuizResultClientBoundary } from './quiz-result-client';
import { RecommendListClient } from './recommend-list-client';
import { ResultSkeleton } from '@/components/quiz/result-skeleton';
import { RecommendSkeleton } from '@/components/quiz/recommend-skeleton';
import { resultClasses as styles } from './result-classes';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function QuizResultPage({ params, searchParams }: PageProps) {
  const { id: quizId } = await params;

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.backBtn}>
        <ArrowBackOutlined sx={{ fontSize: 16 }} />
        探索に戻る
      </Link>

      <Suspense fallback={<ResultSkeleton data-testid="quiz-result-skeleton" />}>
        <QuizResultDetailLoader quizId={quizId} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

interface DetailLoaderProps {
  quizId: string;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function serializeAttempt(attempt: Attempt): Attempt {
  return JSON.parse(
    JSON.stringify({
      ...attempt,
      completedAt:
        attempt.completedAt instanceof Date
          ? attempt.completedAt.toISOString()
          : attempt.completedAt,
    })
  );
}

async function QuizResultDetailLoader({ quizId, searchParams }: DetailLoaderProps) {
  const resolvedSearchParams = await searchParams;
  const attemptId = (resolvedSearchParams.attemptId as string) || undefined;
  const localId = (resolvedSearchParams.localId as string) || undefined;

  const quiz = await getQuiz(quizId);
  if (!quiz) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <h2 style={{ color: 'var(--text-main)' }}>クイズが見つかりませんでした</h2>
      </div>
    );
  }

  let initialAttempt: Attempt | null = null;
  let initialAttemptError: string | null = null;

  if (attemptId) {
    const cookieStore = await cookies();
    const uid = cookieStore.get('quizetika_uid')?.value;

    if (uid) {
      try {
        initialAttempt = await getAttemptByIdForUser(attemptId, uid);
      } catch (e) {
        console.error('[QuizResultDetailLoader] Attempt ロード失敗:', e);
      }
    }
  } else if (!localId) {
    initialAttemptError = '結果IDが指定されていません';
  }

  const plainQuiz = JSON.parse(JSON.stringify(quiz)) as Quiz;
  const plainAttempt = initialAttempt ? serializeAttempt(initialAttempt) : null;

  return (
    <QuizResultClientBoundary
      quiz={plainQuiz}
      attemptId={attemptId}
      localId={localId}
      initialAttempt={plainAttempt}
      initialAttemptError={initialAttemptError}
      recommendChildren={
        <Suspense key="quiz-recommend-suspense" fallback={<RecommendSkeleton data-testid="recommend-skeleton" />}>
          <QuizResultRecommendLoader
            authorId={quiz.authorId}
            currentQuizId={quiz.id}
          />
        </Suspense>
      }
    />
  );
}

interface RecommendLoaderProps {
  authorId: string;
  currentQuizId: string;
}

async function QuizResultRecommendLoader({ authorId, currentQuizId }: RecommendLoaderProps) {
  try {
    const quizzes = await getQuizzesByAuthor(authorId);
    const filtered = quizzes.filter((q) => q.id !== currentQuizId).slice(0, 3);

    if (filtered.length === 0) {
      return <p style={{ color: 'var(--text-muted)' }}>他におすすめのクイズはありません。</p>;
    }

    return <RecommendListClient recommendQuizzes={filtered} />;
  } catch (e) {
    console.error('[QuizResultRecommendLoader] おすすめクイズのロード失敗:', e);
    return <p style={{ color: 'var(--text-muted)' }}>おすすめクイズの読み込みに失敗しました。</p>;
  }
}
