'use client';

import React from 'react';
import { CheckOutlined } from '@mui/icons-material';
import type { MyQuizSourceFlags } from '@/lib/my-quiz-pool';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MyQuizSourcePanelProps {
  flags: MyQuizSourceFlags;
  onChange: (flags: MyQuizSourceFlags) => void;
}

const SOURCES: { key: keyof MyQuizSourceFlags; label: string; testId: string }[] = [
  { key: 'ownQuizzes', label: '自作クイズ', testId: 'my-quiz-source-own' },
  { key: 'bookmarkedQuizzes', label: 'ブックマーククイズ', testId: 'my-quiz-source-bookmarked-quiz' },
  { key: 'bookmarkedQuestions', label: 'ブックマーク問題', testId: 'my-quiz-source-bookmarked-question' },
];

export function MyQuizSourcePanel({ flags, onChange }: MyQuizSourcePanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>取得元</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2" role="group" aria-label="問題の取得元">
          {SOURCES.map((src) => {
            const pressed = flags[src.key];
            return (
              <Button
                key={src.key}
                type="button"
                variant={pressed ? 'default' : 'outline'}
                size="sm"
                className={cn('h-auto gap-1.5 px-3 py-2', !pressed && 'text-muted-foreground')}
                onClick={() => onChange({ ...flags, [src.key]: !pressed })}
                data-testid={src.testId}
                aria-pressed={pressed}
              >
                {pressed && <CheckOutlined className="size-3.5 shrink-0" aria-hidden />}
                {src.label}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
