'use client';

import React from 'react';
import type { MyQuizSourceFlags } from '@/lib/my-quiz-pool';
import styles from './my-quiz.module.css';

interface MyQuizSourcePanelProps {
  flags: MyQuizSourceFlags;
  onChange: (flags: MyQuizSourceFlags) => void;
}

const SOURCES: { key: keyof MyQuizSourceFlags; label: string; testId: string }[] = [
  { key: 'ownQuizzes', label: '自作クイズ', testId: 'my-quiz-source-own' },
  { key: 'bookmarkedQuizzes', label: 'ブックマーククイズ', testId: 'my-quiz-source-bookmarked-quiz' },
  { key: 'bookmarkedLists', label: 'ブックマークリスト内クイズ', testId: 'my-quiz-source-bookmarked-list' },
  { key: 'bookmarkedQuestions', label: 'ブックマーク問題', testId: 'my-quiz-source-bookmarked-question' },
];

export function MyQuizSourcePanel({ flags, onChange }: MyQuizSourcePanelProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>取得元</h2>
      <div className={styles.sourceChipGrid} role="group" aria-label="問題の取得元">
        {SOURCES.map((src) => {
          const active = flags[src.key];
          return (
            <button
              key={src.key}
              type="button"
              className={`${styles.sourceChip} ${active ? styles.sourceChipActive : ''}`}
              aria-pressed={active}
              data-testid={src.testId}
              onClick={() => onChange({ ...flags, [src.key]: !active })}
            >
              {src.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
