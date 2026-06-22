'use client';

import React from 'react';
import { CheckCircleOutlined, WarningAmberOutlined } from '@mui/icons-material';
import { parseMarkdownToHtml } from '@/lib/security/sanitize';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PostAnswerFeedbackProps {
  isCorrect: boolean;
  explanation?: string;
  correctAnswerDisplay?: string;
  isLastQuestion: boolean;
  onNext: () => void;
  onViewResults: () => void;
  quickPressTime?: number | null;
}

export function PostAnswerFeedback({
  isCorrect,
  explanation,
  correctAnswerDisplay,
  isLastQuestion,
  onNext,
  onViewResults,
  quickPressTime,
}: PostAnswerFeedbackProps) {
  return (
    <div className="flex w-full flex-col gap-4" data-testid="play-answer-feedback">
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border p-4',
          isCorrect
            ? 'border-emerald-500/50 bg-emerald-500/10 dark:border-emerald-400/50 dark:bg-emerald-400/10'
            : 'border-destructive/50 bg-destructive/10'
        )}
      >
        {isCorrect ? (
          <>
            <CheckCircleOutlined sx={{ fontSize: 32 }} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <div>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">正解！</div>
              {quickPressTime != null && (
                <div className="text-sm text-muted-foreground">
                  早押しタイム:{' '}
                  <strong className="text-base text-emerald-600 dark:text-emerald-400">{quickPressTime}</strong> 秒
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <WarningAmberOutlined sx={{ fontSize: 32 }} className="shrink-0 text-destructive" aria-hidden="true" />
            <div>
              <div className="text-xl font-bold text-destructive">不正解...</div>
              {quickPressTime != null && (
                <div className="text-sm text-muted-foreground">
                  早押しタイム: {quickPressTime} 秒 (正解時のみ記録されます)
                </div>
              )}
              {correctAnswerDisplay && (
                <div className="text-sm text-muted-foreground">正解: {correctAnswerDisplay}</div>
              )}
            </div>
          </>
        )}
      </div>

      {isCorrect && explanation && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed">
          <strong className="mb-2 block text-foreground">💡 解説:</strong>
          <div className="prose max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(explanation) }} />
        </div>
      )}

      {isLastQuestion ? (
        <Button
          type="button"
          className="h-12 w-full text-base font-bold"
          data-testid="play-view-results"
          data-analytics="quiz-play-view-results"
          onClick={onViewResults}
        >
          結果を見る ➔
        </Button>
      ) : (
        <Button
          type="button"
          className="h-12 w-full text-base font-bold"
          data-testid="play-next-question"
          data-analytics="quiz-play-next-question"
          onClick={onNext}
        >
          次へ ➔
        </Button>
      )}
    </div>
  );
}
