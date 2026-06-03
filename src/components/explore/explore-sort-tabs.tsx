'use client';

import React from 'react';
import type { QuizListSort } from '@/services/quiz';
import homeStyles from '@/app/page.module.css';

export interface ExploreSortTabsProps {
  activeSort: QuizListSort;
  onSortChange: (sort: QuizListSort) => void;
}

const TABS: { id: QuizListSort; label: string }[] = [
  { id: 'latest', label: '新着' },
  { id: 'popular', label: '人気' },
  { id: 'trending', label: 'トレンド' },
];

export function ExploreSortTabs({ activeSort, onSortChange }: ExploreSortTabsProps) {
  return (
    <div className={homeStyles.tabBar} data-testid="explore-sort-tabs">
      {TABS.map((tab) => (
        <div
          key={tab.id}
          role="tab"
          aria-selected={activeSort === tab.id}
          data-testid={`explore-sort-${tab.id}`}
          className={`${homeStyles.tab} ${activeSort === tab.id ? homeStyles.tabActive : ''}`}
          onClick={() => onSortChange(tab.id)}
        >
          {tab.label}
        </div>
      ))}
    </div>
  );
}
