'use client';

import React from 'react';
import type { BookmarkTab } from '@/hooks/useBookmarkFeed';
import { Tabs, UnderlineTabsList, UnderlineTabsTrigger } from '@/components/ui/underline-tabs';

interface BookmarksTabsProps {
  activeTab: BookmarkTab;
  onTabChange: (tab: BookmarkTab) => void;
}

const TABS: { id: BookmarkTab; label: string; testId: string }[] = [
  { id: 'quiz', label: 'クイズ', testId: 'bookmarks-tab-quiz' },
  { id: 'question', label: '問題', testId: 'bookmarks-tab-question' },
];

export function BookmarksTabs({ activeTab, onTabChange }: BookmarksTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as BookmarkTab)}
      className="mb-6"
    >
      <UnderlineTabsList data-testid="bookmarks-tabs">
        {TABS.map((tab) => (
          <UnderlineTabsTrigger key={tab.id} value={tab.id} data-testid={tab.testId}>
            {tab.label}
          </UnderlineTabsTrigger>
        ))}
      </UnderlineTabsList>
    </Tabs>
  );
}
