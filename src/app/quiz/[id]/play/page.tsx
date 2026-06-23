import React, { Suspense } from 'react';
import { getQuiz } from '@/services/quiz';
import { obfuscateQuickPressQuestions } from '@/lib/quick-press-obfuscate';
import { PlaySkeleton } from '@/components/quiz/play-skeleton';
import { QuizPlayClientBoundary } from './quiz-play-client';
import { playClasses as styles } from './play-classes';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function QuizPlayPage({ params }: PageProps) {
  const { id: quizId } = await params;

  return (
    <div className={styles.container}>
      <QuizPlayClientBoundary quizId={quizId} />
    </div>
  );
}
