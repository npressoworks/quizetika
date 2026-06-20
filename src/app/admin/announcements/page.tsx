import React, { Suspense } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import AdminAnnouncementsClient from './client';

export default function AdminAnnouncementsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      {/* サーバー側で即時描画される静的フレーム */}
      <header className="space-y-2">
        <Badge variant="secondary">🛡️ 管理者専用</Badge>
        <h1 className="text-2xl font-bold">運営からのお知らせ管理</h1>
        <p className="text-sm text-muted-foreground">
          デプロイやビルドを行うことなく、Web上から直接お知らせを追加・編集・削除できます。
        </p>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link href="/admin" className="hover:text-foreground hover:underline">
            ⚙️ 管理者ポータルへ
          </Link>
          <Link href="/admin/users" className="hover:text-foreground hover:underline">
            👤 ユーザー管理画面へ
          </Link>
        </div>
      </header>

      {/* 非同期データロード中のプレースホルダー (スケルトン) */}
      <Suspense
        fallback={
          <div
            data-testid="announcements-management-skeleton"
            className="space-y-4"
          >
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="h-16 w-full animate-pulse rounded bg-muted" />
            <div className="h-16 w-full animate-pulse rounded bg-muted" />
          </div>
        }
      >
        <AdminAnnouncementsClient />
      </Suspense>
    </div>
  );
}
