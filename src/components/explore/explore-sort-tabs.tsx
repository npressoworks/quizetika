'use client';

import React from 'react';
import type { QuizListSort } from '@/services/quiz';
import { Tabs, UnderlineTabsList, UnderlineTabsTrigger } from '@/components/ui/underline-tabs';

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
    <Tabs
      value={activeSort}
      onValueChange={(value) => onSortChange(value as QuizListSort)}
      data-testid="explore-sort-tabs"
    >
      <UnderlineTabsList className="h-auto gap-6 p-0">
        {TABS.map((tab) => (
          <UnderlineTabsTrigger
            key={tab.id}
            value={tab.id}
            data-testid={`explore-sort-${tab.id}`}
            className="rounded-none px-2 py-3"
          >
            {tab.label}
          </UnderlineTabsTrigger>
        ))}
      </UnderlineTabsList>
    </Tabs>
  );
}
