import React from 'react';
import { getQuizList } from '@/services/quiz-list';
import { QuizListEditor } from '@/components/quiz-list/quiz-list-editor';
import type { QuizList } from '@/types';

function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

interface ListEditorLoaderProps {
  listId: string;
}

export async function ListEditorLoader({ listId }: ListEditorLoaderProps) {
  let initialList: QuizList | null = null;
  try {
    const list = await getQuizList(listId);
    initialList = list ? serialize<QuizList>(list) : null;
  } catch (e) {
    console.error('[ListEditorLoader] リスト取得失敗:', e);
  }

  return <QuizListEditor listId={listId} initialList={initialList} />;
}
