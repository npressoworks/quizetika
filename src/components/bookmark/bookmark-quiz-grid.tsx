'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BookmarkRounded } from '@mui/icons-material';
import { Quiz } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface BookmarkQuizGridProps {
  quizzes: Quiz[];
  onRemove: (quizId: string) => void;
}

export function BookmarkQuizGrid({ quizzes, onRemove }: BookmarkQuizGridProps) {
  if (quizzes.length === 0) {
    return (
      <Card className="py-16 text-center">
        <CardContent>
          <h2 className="mb-2 text-lg font-semibold">ブックマークしたクイズがありません</h2>
          <p className="text-muted-foreground">
            気になるクイズをお気に入り登録してコレクションしましょう！
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {quizzes.map((quiz) => (
        <Card key={quiz.id} className="overflow-hidden transition-shadow hover:shadow-md">
          <Link href={`/quiz/${quiz.id}`} className="block">
            {quiz.reviewBadge && !quiz.isReviewMasked && (
              <div className="px-4 pt-4">
                <Badge variant="secondary">🏅 {quiz.reviewBadge}</Badge>
              </div>
            )}
            <div className="relative aspect-video bg-muted">
              {quiz.thumbnailUrl ? (
                <Image src={quiz.thumbnailUrl} alt={quiz.title} fill sizes="300px" className="object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-3xl">💡</span>
              )}
            </div>
            <CardContent className="p-4">
              <span className="text-xs font-medium text-muted-foreground">{quiz.genre}</span>
              <h3 className="mt-1 line-clamp-2 font-semibold">{quiz.title}</h3>
              <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                <span>⏱️ {quiz.questionCount} 問</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onRemove(quiz.id);
                  }}
                  title="ブックマーク解除"
                >
                  <BookmarkRounded sx={{ fontSize: 18 }} className="fill-primary text-primary" />
                </Button>
              </div>
            </CardContent>
          </Link>
        </Card>
      ))}
    </div>
  );
}
