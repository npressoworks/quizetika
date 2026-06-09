'use client';

import React from 'react';
import type { ListsVisibility } from '@/hooks/useListsSearch';
import styles from './lists.module.css';

interface ListsVisibilityTabsProps {
  activeTab: ListsVisibility;
  onTabChange: (tab: ListsVisibility) => void;
}

const TABS: { id: ListsVisibility; label: string; testId: string }[] = [
  { id: 'public', label: '公開リスト', testId: 'lists-tab-public' },
  { id: 'private', label: '非公開リスト', testId: 'lists-tab-private' },
];

export function ListsVisibilityTabs({ activeTab, onTabChange }: ListsVisibilityTabsProps) {
  return (
    <div className={styles.tabBar} data-testid="lists-visibility-tabs">
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
