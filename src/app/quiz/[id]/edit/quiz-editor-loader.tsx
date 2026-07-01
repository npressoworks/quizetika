import React from 'react';
import { getQuiz, listActiveGenres, listActiveTags } from '@/services/quiz';
import { QuizEditor } from '@/components/quiz/quiz-editor';
import type { GenreMetadata, TagMetadata, Quiz } from '@/types';

function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

interface QuizEditorLoaderProps {
  quizId: string;
}

export async function QuizEditorLoader({ quizId }: QuizEditorLoaderProps) {
  let quiz: Quiz | null = null;
  try {
    quiz = await getQuiz(quizId);
  } catch (e: any) {
    if (e?.code !== 'permission-denied') {
      console.error('QuizEditorLoader getQuiz error:', e);
    }
  }

  const [genres, tags] = await Promise.all([
    listActiveGenres(),
    listActiveTags(),
  ]);

  const plainGenres = serialize<GenreMetadata[]>(genres);
  const plainTags = serialize<TagMetadata[]>(tags);
  const plainQuiz = quiz ? serialize<Quiz>(quiz) : null;

  return (
    <QuizEditor
      quizId={quizId}
      initialGenres={plainGenres}
      initialTags={plainTags}
      initialQuiz={plainQuiz}
    />
  );
}
