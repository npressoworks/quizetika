'use client';

import React from 'react';
import Link from 'next/link';
import { Bookmark, Layers } from 'lucide-react';
import { QuizList, resolveListType } from '@/types';
import { getProfileListTypeLabel } from '@/lib/profile-list-display';
import styles from './bookmark.module.css';

interface BookmarkListGridProps {
  lists: QuizList[];
  onRemove: (listId: string) => void;
}

export function BookmarkListGrid({ lists, onRemove }: BookmarkListGridProps) {
  if (lists.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h2 style={{ color: 'var(--text-main)', marginBottom: '8px' }}>ブックマークしたリストがありません</h2>
        <p style={{ color: 'var(--text-muted)' }}>お気に入りのクイズリストをブックマークしましょう。</p>
      </div>
    );
  }

  return (
    <div className={styles.listGrid}>
      {lists.map((list) => (
        <div key={list.id} className={styles.cardRow}>
          <Link href={`/list/${list.id}`} className={styles.listCard} style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-accent)', fontSize: '0.85rem', fontWeight: 600 }}>
              <Layers size={14} />
              <span>{getProfileListTypeLabel(resolveListType(list))}</span>
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>{list.title}</h3>
            {list.description && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{list.description}</p>
            )}
          </Link>
          <button
            type="button"
            className={`${styles.bookmarkToggleBtn} ${styles.bookmarked}`}
            onClick={() => onRemove(list.id)}
            title="ブックマーク解除"
          >
            <Bookmark size={20} fill="#00ff66" color="#00ff66" />
          </button>
        </div>
      ))}
    </div>
  );
}
