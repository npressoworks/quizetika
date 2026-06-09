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
      <div className={styles.sourceGrid}>
        {SOURCES.map((src) => (
          <label key={src.key} className={styles.sourceLabel}>
            <input
              type="checkbox"
              checked={flags[src.key]}
              onChange={(e) => onChange({ ...flags, [src.key]: e.target.checked })}
              data-testid={src.testId}
            />
            <span>{src.label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
