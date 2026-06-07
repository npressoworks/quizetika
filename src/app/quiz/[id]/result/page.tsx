import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getQuiz, getQuizzesByAuthor } from '@/services/quiz';
import { Quiz } from '@/types';
import { QuizResultClient } from './quiz-result-client';
import { RecommendListClient } from './recommend-list-client';
import { ResultSkeleton } from '@/components/quiz/result-skeleton';
import { RecommendSkeleton } from '@/components/quiz/recommend-skeleton';
import styles from './result.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function QuizResultPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const quizId = resolvedParams.id;

  const attemptId = (resolvedSearchParams.attemptId as string) || undefined;
  const localId = (resolvedSearchParams.localId as string) || undefined;

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.backBtn}>
        <ArrowLeft size={16} />
        探索に戻る
      </Link>

      <Suspense fallback={<ResultSkeleton data-testid="quiz-result-skeleton" />}>
        <QuizResultDetailLoader
          quizId={quizId}
          attemptId={attemptId}
          localId={localId}
        />
      </Suspense>
    </div>
  );
}

interface DetailLoaderProps {
  quizId: string;
  attemptId?: string;
  localId?: string;
}

async function QuizResultDetailLoader({ quizId, attemptId, localId }: DetailLoaderProps) {
  // 1. クイズデータの読み込み
  const quiz = await getQuiz(quizId);
  if (!quiz) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <h2 style={{ color: 'var(--text-main)' }}>クイズが見つかりませんでした</h2>
      </div>
    );
  }

  return (
    <QuizResultClient
      quiz={quiz}
      attemptId={attemptId}
      localId={localId}
      recommendChildren={
        <Suspense fallback={<RecommendSkeleton data-testid="recommend-skeleton" />}>
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
