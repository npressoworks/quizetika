import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, List } from 'lucide-react';
import { ListsClient } from './lists-client';
import styles from './lists.module.css';
import cardStyles from '../page.module.css';

export default function ListsPage() {
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
          <List size={32} />
          リスト
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          公開リストを探索するか、自分の非公開リストを管理できます。
        </p>
      </div>

      <Suspense fallback={<div data-testid="lists-skeleton">読み込み中...</div>}>
        <ListsClient />
      </Suspense>
    </div>
  );
}
