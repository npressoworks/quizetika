'use client';

import React from 'react';
import type { QuizList } from '@/types';
import { ListDiscoveryCard } from './list-discovery-card';
import styles from './lists.module.css';

interface ListsGridProps {
  lists: QuizList[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function ListsGrid({ lists, loading, error, onRetry }: ListsGridProps) {
  if (loading) {
    return <div className={styles.loadingState}>読み込み中...</div>;
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <p>{error}</p>
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          再試行
        </button>
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className={styles.emptyState} data-testid="lists-empty-state">
        <p>条件に一致するリストが見つかりませんでした。</p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {lists.map((list) => (
        <ListDiscoveryCard key={list.id} list={list} />
      ))}
    </div>
  );
}
