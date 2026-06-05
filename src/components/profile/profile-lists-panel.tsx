'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { QuizList } from '@/types';
import { resolveListType } from '@/types';
import { ProfileListCard } from '@/components/profile/profile-list-card';
import styles from '@/app/profile/[uid]/profile.module.css';

export type ProfileListFilter = 'all' | 'quiz' | 'question';

export interface ProfileListsPanelProps {
  lists: QuizList[];
  isMyProfile: boolean;
}

function filterLists(lists: QuizList[], filter: ProfileListFilter): QuizList[] {
  if (filter === 'all') return lists;
  return lists.filter((list) => resolveListType(list) === filter);
}

export function ProfileListsPanel({ lists, isMyProfile }: ProfileListsPanelProps) {
  const [filter, setFilter] = useState<ProfileListFilter>('all');

  const filteredLists = useMemo(() => filterLists(lists, filter), [lists, filter]);

  if (lists.length === 0) {
    return (
      <div
        className={styles.gridContainer}
        data-testid="profile-lists-panel"
      >
        <div
          className={styles.emptyState}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}
        >
          <p>作成したリストはまだありません。</p>
          {isMyProfile && (
            <Link
              href="/list/create"
              className="btn btn-primary"
              style={{ padding: '8px 20px', fontSize: '0.9rem' }}
            >
              新しいリストを作成する
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.gridContainer} data-testid="profile-lists-panel">
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 16,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(
            [
              { id: 'all' as const, label: 'すべて' },
              { id: 'quiz' as const, label: 'クイズリストのみ' },
              { id: 'question' as const, label: '設問リストのみ' },
            ] as const
          ).map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={filter === chip.id ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              data-testid={`profile-list-filter-${chip.id}`}
              onClick={() => setFilter(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>
        {isMyProfile && (
          <Link
            href="/list/create"
            className="btn btn-primary"
            style={{ padding: '8px 20px', fontSize: '0.9rem' }}
          >
            新しいリストを作成する
          </Link>
        )}
      </div>

      {filteredLists.length === 0 ? (
        <div
          className={styles.emptyState}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}
          data-testid="profile-list-filter-empty"
        >
          <p>該当するリストがありません</p>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem' }}
            onClick={() => setFilter('all')}
          >
            フィルタを解除（すべて）
          </button>
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {filteredLists.map((list) => (
            <ProfileListCard key={list.id} list={list} />
          ))}
        </div>
      )}
    </div>
  );
}
