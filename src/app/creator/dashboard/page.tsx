import React, { Suspense } from 'react';
import { DashboardActions } from './dashboard-actions';
import { CreatorDashboardClient } from './dashboard-client';
import { StatsSkeleton } from '@/components/charts/stats-skeleton';

export default function CreatorDashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold md:text-3xl">ダッシュボード</h1>
          <p className="text-sm text-muted-foreground">
            プレイ履歴の分析や、作成した作品のパフォーマンス管理を行いましょう。
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
