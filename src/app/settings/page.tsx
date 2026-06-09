import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';
import { SettingsClient } from './settings-client';
import styles from './settings.module.css';
import cardStyles from '../page.module.css';

export default function SettingsPage() {
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
          <Settings size={32} />
          設定
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          表示テーマやアカウント関連の設定を変更できます。
        </p>
      </div>

      <Suspense fallback={<div data-testid="settings-skeleton">読み込み中...</div>}>
        <SettingsClient />
      </Suspense>
    </div>
  );
}
