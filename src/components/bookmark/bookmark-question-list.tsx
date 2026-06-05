'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { BookmarkedQuestionEntry } from '@/types';
import styles from './bookmark.module.css';

function excerpt(text: string, maxLen = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}

interface BookmarkQuestionListProps {
  questions: BookmarkedQuestionEntry[];
  onRemove: (questionId: string) => void;
}

export function BookmarkQuestionList({ questions, onRemove }: BookmarkQuestionListProps) {
  const router = useRouter();

  if (questions.length === 0) {
    return (
      <div className={styles.emptyState} data-testid="bookmarks-empty-question">
        <h2 style={{ color: 'var(--text-main)', marginBottom: '8px' }}>ブックマークした設問がありません</h2>
        <p style={{ color: 'var(--text-muted)' }}>プレイ中や結果画面から設問をブックマークできます。</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {questions.map((entry) => (
        <div key={entry.question.id} className={styles.cardRow}>
          <div
            className={styles.questionCard}
            style={{ flex: 1 }}
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
            <p className={styles.questionExcerpt}>{excerpt(entry.question.questionText)}</p>
            <p className={styles.questionMeta}>
              親クイズ: {entry.parentQuizTitle}
              {entry.bookmarkedAt && (
                <> · {entry.bookmarkedAt.toLocaleDateString('ja-JP')}</>
              )}
            </p>
          </div>
          <button
            type="button"
            className={`${styles.bookmarkToggleBtn} ${styles.bookmarked}`}
            onClick={() => onRemove(entry.question.id)}
            title="ブックマーク解除"
          >
            <Star size={20} fill="#ff007f" />
          </button>
        </div>
      ))}
    </div>
  );
}
