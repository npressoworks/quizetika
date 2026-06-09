'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { ThemeToggle } from '@/components/settings/theme-toggle';
import styles from './settings.module.css';

export function SettingsClient() {
  const { user } = useAuth();

  return (
    <div data-testid="settings-page-container">
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>表示テーマ</h2>
        <p className={styles.sectionDesc}>アプリ全体の配色を切り替えます。</p>
        <ThemeToggle />
      </section>

      {user && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>アカウント</h2>
          <p className={styles.sectionDesc}>プロフィール情報を編集できます。</p>
          <Link
            href="/profile/edit"
            className="btn btn-secondary"
            data-testid="settings-profile-edit-link"
            style={{ alignSelf: 'flex-start' }}
          >
            プロフィールを編集
          </Link>
        </section>
      )}
    </div>
  );
}
