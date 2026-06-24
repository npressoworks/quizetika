'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Quiz } from '@/types';
import { QuizCard } from '@/components/quiz/quiz-card';
import { Card, CardContent } from '@/components/ui/card';

interface BookmarkQuizGridProps {
  quizzes: Quiz[];
  onRemove: (quizId: string) => void;
  filtered?: boolean;
}

export function BookmarkQuizGrid({ quizzes, onRemove, filtered = false }: BookmarkQuizGridProps) {
  const router = useRouter();

  if (quizzes.length === 0) {
    return (
      <Card className="py-16 text-center" data-testid="bookmarks-empty-quiz">
        <CardContent>
          <h2 className="mb-2 text-lg font-semibold">
            {filtered ? '条件に一致するクイズがありません' : 'ブックマークしたクイズがありません'}
          </h2>
          <p className="text-muted-foreground">
            {filtered
              ? 'フィルター条件を変更してお試しください。'
              : '気になるクイズをお気に入り登録してコレクションしましょう！'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const handlePlayClick = (quizId: string) => {
    router.push(`/quiz/${quizId}/play`);
  };

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
      {quizzes.map((quiz) => (
        <QuizCard
          key={quiz.id}
          quiz={quiz}
          isBookmarked={true}
          onBookmarkToggle={async (id) => onRemove(id)}
          onPlayClick={handlePlayClick}
        />
      ))}
    </div>
  );
}
