'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { BookmarkRounded } from '@mui/icons-material';
import { BookmarkedQuestionEntry } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

function excerpt(text: string, maxLen = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}

interface BookmarkQuestionListProps {
  questions: BookmarkedQuestionEntry[];
  onRemove: (questionId: string) => void;
  filtered?: boolean;
}

export function BookmarkQuestionList({
  questions,
  onRemove,
  filtered = false,
}: BookmarkQuestionListProps) {
  const router = useRouter();

  if (questions.length === 0) {
    return (
      <Card className="py-16 text-center" data-testid="bookmarks-empty-question">
        <CardContent>
          <h2 className="mb-2 text-lg font-semibold">
            {filtered ? '条件に一致する問題がありません' : 'ブックマークした問題がありません'}
          </h2>
          <p className="text-muted-foreground">
            {filtered
              ? 'フィルター条件を変更してお試しください。'
              : 'プレイ中や結果画面から問題をブックマークできます。'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {questions.map((entry) => (
        <Card key={entry.question.id} className="flex flex-row items-stretch overflow-hidden">
          <div
            className="flex flex-1 cursor-pointer flex-col gap-2 p-4 transition-colors hover:bg-muted/30"
            role="button"
            tabIndex={0}
            onClick={() =>
              router.push(
                `/quiz/${entry.parentQuizId}/play?startAtQuestionId=${entry.question.id}`
              )
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                router.push(
                  `/quiz/${entry.parentQuizId}/play?startAtQuestionId=${entry.question.id}`
                );
              }
            }}
          >
            <p className="font-medium leading-snug">{excerpt(entry.question.questionText)}</p>
            <p className="text-sm text-muted-foreground">
              親クイズ: {entry.parentQuizTitle}
              {entry.bookmarkedAt && (
                <> · {entry.bookmarkedAt.toLocaleDateString('ja-JP')}</>
              )}
            </p>
          </div>
          <div className="flex items-center border-l px-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-primary"
              onClick={() => onRemove(entry.question.id)}
              title="ブックマーク解除"
            >
              <BookmarkRounded sx={{ fontSize: 20 }} className="fill-primary text-primary" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
