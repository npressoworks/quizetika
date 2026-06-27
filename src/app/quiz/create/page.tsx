import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { EditorFormSkeleton } from '@/components/quiz/editor-skeleton';
import { QuizEditorLoader } from './quiz-editor-loader';

export const metadata: Metadata = {
  title: '新規クイズ作成 | quizetika',
  description: 'quizetikaで新しいクイズを作成・編集して投稿しましょう。',
};

export default function QuizCreatePage() {
  return (
    <Suspense fallback={<EditorFormSkeleton data-testid="quiz-editor-skeleton" />}>
      <QuizEditorLoader />
    </Suspense>
  );
}
