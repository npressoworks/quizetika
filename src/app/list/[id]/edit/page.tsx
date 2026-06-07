import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { ListEditorSkeleton } from '@/components/quiz-list/list-skeleton';
import { ListEditorLoader } from './list-editor-loader';

export const metadata: Metadata = {
  title: 'リスト編集 | quizeum',
  description: '作成したリストのタイトルや説明文、収録クイズの順序を編集します。',
};

interface EditPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function QuizListEditPage({ params }: EditPageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={<ListEditorSkeleton data-testid="list-editor-skeleton" />}>
      <ListEditorLoader listId={id} />
    </Suspense>
  );
}
