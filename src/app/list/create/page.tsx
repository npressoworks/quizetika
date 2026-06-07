import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { ListEditorSkeleton } from '@/components/quiz-list/list-skeleton';
import { ListEditorLoader } from './list-editor-loader';

export const metadata: Metadata = {
  title: '新規リスト作成 | quizeum',
  description: '自作クイズや好みのクイズを組み合わせて、新しいリストを作成します。',
};

export default function QuizListCreatePage() {
  return (
    <Suspense fallback={<ListEditorSkeleton data-testid="list-editor-skeleton" />}>
      <ListEditorLoader />
    </Suspense>
  );
}
