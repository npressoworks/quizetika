'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  initMyQuizSession,
  buildMyQuizPlayUrl,
} from '@/lib/my-quiz-session';
import type { MyQuizSessionEntry } from '@/lib/my-quiz-session';
import styles from './my-quiz.module.css';

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
    const session = { sessionId, entries, currentIndex: 0 };
    router.push(buildMyQuizPlayUrl(session, 0));
  };

  return (
    <section className={styles.previewBar}>
      {poolLoading ? null : !hasAnySource ? (
        <p className={styles.emptyHint}>取得元を1つ以上選択してください。</p>
      ) : filteredCount === 0 ? (
        <p className={styles.emptyHint}>条件に一致する問題がありません。フィルタや取得元を調整してください。</p>
      ) : (
        <p className={styles.previewText}>
          対象 {filteredCount} 問から {effectivePlayCount} 問を出題します
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary"
        disabled={!canStart}
        onClick={handleStart}
        data-testid="my-quiz-start-play"
        data-analytics="my-quiz-start-play"
      >
        クイズを始める
      </button>
    </section>
  );
}
