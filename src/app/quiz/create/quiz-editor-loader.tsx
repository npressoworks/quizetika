import React from 'react';
import { listActiveGenres, listActiveTags } from '@/services/quiz';
import { QuizEditor } from '@/components/quiz/quiz-editor';
import type { GenreMetadata, TagMetadata } from '@/types';

function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export async function QuizEditorLoader() {
  const [genres, tags] = await Promise.all([listActiveGenres(), listActiveTags()]);
  const plainGenres = serialize<GenreMetadata[]>(genres);
  const plainTags = serialize<TagMetadata[]>(tags);

  return <QuizEditor initialGenres={plainGenres} initialTags={plainTags} />;
}
