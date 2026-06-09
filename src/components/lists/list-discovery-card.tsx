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
import styles from './lists.module.css';

interface ListDiscoveryCardProps {
  list: QuizList;
}

export function ListDiscoveryCard({ list }: ListDiscoveryCardProps) {
  const listType = resolveListType(list);
  const typeLabel = getProfileListTypeLabel(listType);
  const { countLabel } = getProfileListItemCount(list);

  return (
    <Link
      href={`/list/${list.id}`}
      className={`${styles.card} glass-card glass-card-hover`}
      data-testid="lists-discovery-card"
    >
      <div className={styles.cardBadge}>
        <Layers size={14} />
        <span>{typeLabel}</span>
      </div>
      <h3 className={styles.cardTitle}>{list.title}</h3>
      {list.description && <p className={styles.cardDesc}>{list.description}</p>}
      <span className={styles.cardMeta}>{countLabel}</span>
    </Link>
  );
}
