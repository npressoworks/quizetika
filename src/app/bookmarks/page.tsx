import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bookmark } from 'lucide-react';
import { BookmarksClient } from './bookmarks-client';
import { BookmarksSkeleton } from '@/components/ui/bookmarks-skeleton';
import styles from './bookmarks.module.css';
import cardStyles from '../page.module.css';

export default async function BookmarksPage() {
  return (
    <div className={styles.container}>
      <Link
        href="/"
        className={cardStyles.backBtn}
        style={{
          alignSelf: 'flex-start',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--text-muted)',
        }}
      >
        <ArrowLeft size={16} /> ホームに戻る
      </Link>

      <div className={styles.titleSection}>
        <h1 className={styles.title}>
          <Bookmark size={32} fill="#00ff66" style={{ color: '#00ff66' }} />
          ブックマーク
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          クイズ・リスト・問題を種類ごとに管理できます。
        </p>
      </div>

      <Suspense fallback={<BookmarksSkeleton data-testid="bookmarks-skeleton" />}>
        <BookmarksClient />
      </Suspense>
    </div>
  );
}
