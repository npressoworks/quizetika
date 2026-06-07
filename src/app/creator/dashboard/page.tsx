import React, { Suspense } from 'react';
import { DashboardActions } from './dashboard-actions';
import { CreatorDashboardClient } from './dashboard-client';
import { StatsSkeleton } from '@/components/charts/stats-skeleton';
import styles from './dashboard.module.css';

export default function CreatorDashboardPage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>作家ダッシュボード</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            あなたの作品のパフォーマンス管理と改善を行いましょう。
          </p>
        </div>
        <DashboardActions />
      </div>

      <Suspense fallback={<StatsSkeleton data-testid="stats-skeleton" />}>
        <CreatorDashboardClient />
      </Suspense>
    </div>
  );
}
