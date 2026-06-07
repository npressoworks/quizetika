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
  const [genres, tags, quiz] = await Promise.all([
    listActiveGenres(),
    listActiveTags(),
    getQuiz(quizId),
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
