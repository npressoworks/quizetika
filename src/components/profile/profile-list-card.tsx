'use client';

import React from 'react';
import Link from 'next/link';
import { Layers } from 'lucide-react';
import type { QuizList } from '@/types';
import { resolveListType } from '@/types';
import {
  getProfileListItemCount,
  getProfileListTypeLabel,
} from '@/lib/profile-list-display';
import styles from '@/app/profile/[uid]/profile.module.css';

export interface ProfileListCardProps {
  list: QuizList;
}

export function ProfileListCard({ list }: ProfileListCardProps) {
  const listType = resolveListType(list);
  const typeLabel = getProfileListTypeLabel(listType);
  const { countLabel } = getProfileListItemCount(list);

  return (
    <Link
      href={`/list/${list.id}`}
      className={`${styles.quizCard} glass-card glass-card-hover`}
      data-testid="profile-list-card"
    >
      {list.coverImageUrl && (
        <div className={styles.quizThumbnailWrapper}>
          <img src={list.coverImageUrl} alt={list.title} className={styles.quizThumbnail} />
        </div>
      )}
      <div className={styles.quizCardBody}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--color-accent)',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <Layers size={14} />
          <span data-testid="profile-list-type-badge">{typeLabel}</span>
        </div>
        <h3 className={styles.quizTitle}>{list.title}</h3>
        {list.description && <p className={styles.quizDesc}>{list.description}</p>}
        <div className={styles.listMeta}>
          <span>{countLabel}</span>
        </div>
      </div>
    </Link>
  );
}
