import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { EditorFormSkeleton } from '@/components/quiz/editor-skeleton';
import { QuizEditorLoader } from './quiz-editor-loader';

export const metadata: Metadata = {
  title: 'クイズ編集 | quizeum',
  description: '作成したクイズを編集して、再度公開・下書き保存することができます。',
};

interface EditPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function QuizEditPage({ params }: EditPageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={<EditorFormSkeleton data-testid="quiz-editor-skeleton" />}>
      <QuizEditorLoader quizId={id} />
    </Suspense>
  );
}
