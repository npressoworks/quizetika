import React, { Suspense } from 'react';
import { getQuiz } from '@/services/quiz';
import { obfuscateQuickPressQuestions } from '@/lib/quick-press-obfuscate';
import { PlaySkeleton } from '@/components/quiz/play-skeleton';
import { QuizPlayClientBoundary } from './quiz-play-client';
import styles from './play.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function QuizPlayPage({ params }: PageProps) {
  const { id: quizId } = await params;

  return (
    <div className={styles.container}>
      <Suspense fallback={<PlaySkeleton data-testid="quiz-play-skeleton" />}>
        <QuizPlayLoader quizId={quizId} />
      </Suspense>
    </div>
  );
}

async function QuizPlayLoader({ quizId }: { quizId: string }) {
  const data = await getQuiz(quizId);

  if (!data) {
    return (
      <div className={styles.container}>
        <p>クイズが見つかりませんでした。</p>
      </div>
    );
  }

  const plainQuiz = JSON.parse(
    JSON.stringify({
      ...data,
      questions: obfuscateQuickPressQuestions(data.questions ?? []),
    })
  );

  return <QuizPlayClientBoundary quizId={quizId} initialQuiz={plainQuiz} />;
}
