'use client';

import React from 'react';
import styles from './bookmark.module.css';
import type { BookmarkTab } from '@/hooks/useBookmarkFeed';

interface BookmarksTabsProps {
  activeTab: BookmarkTab;
  onTabChange: (tab: BookmarkTab) => void;
}

const TABS: { id: BookmarkTab; label: string; testId: string }[] = [
  { id: 'quiz', label: 'クイズ', testId: 'bookmarks-tab-quiz' },
  { id: 'list', label: 'リスト', testId: 'bookmarks-tab-list' },
  { id: 'question', label: '設問', testId: 'bookmarks-tab-question' },
];

export function BookmarksTabs({ activeTab, onTabChange }: BookmarksTabsProps) {
  return (
    <div className={styles.tabBar} data-testid="bookmarks-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabActive : ''}`}
          data-testid={tab.testId}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
