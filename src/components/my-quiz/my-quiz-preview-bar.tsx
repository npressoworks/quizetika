'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  initMyQuizSession,
} from '@/lib/my-quiz-session';
import type { MyQuizSessionEntry } from '@/lib/my-quiz-session';
import { Button } from '@/components/ui/button';

interface MyQuizPreviewBarProps {
  filteredCount: number;
  effectivePlayCount: number;
  hasAnySource: boolean;
  poolLoading?: boolean;
  buildEntries: () => MyQuizSessionEntry[];
}

export function MyQuizPreviewBar({
  filteredCount,
  effectivePlayCount,
  hasAnySource,
  poolLoading = false,
  buildEntries,
}: MyQuizPreviewBarProps) {
  const router = useRouter();
  const canStart =
    !poolLoading && hasAnySource && filteredCount > 0 && effectivePlayCount > 0;

  const handleStart = () => {
    const entries = buildEntries();
    if (entries.length === 0) return;
    const sessionId = crypto.randomUUID();
    initMyQuizSession(sessionId, entries);
    router.push(`/quiz/my-quiz/play?mode=my-quiz&sessionId=${sessionId}`);
  };

  return (
    <section className="flex flex-col gap-4 py-4">
      {poolLoading ? null : !hasAnySource ? (
        <p className="text-sm text-muted-foreground">取得元を1つ以上選択してください。</p>
      ) : filteredCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          条件に一致する問題がありません。フィルタや取得元を調整してください。
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          対象 {filteredCount} 問から {effectivePlayCount} 問を出題します
        </p>
      )}
      <Button
        type="button"
        disabled={!canStart}
        onClick={handleStart}
        data-testid="my-quiz-start-play"
        data-analytics="my-quiz-start-play"
      >
        クイズを始める
      </Button>
    </section>
  );
}
