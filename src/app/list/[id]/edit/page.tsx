import React from 'react';
import { QuizListEditor } from '@/components/quiz-list/quiz-list-editor';
import { Metadata } from 'next';

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
  return <QuizListEditor listId={id} />;
}
