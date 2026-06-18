/**
 * 管理者専用ジャンル管理・直接追加画面
 *
 * サーバーサイドで動作する Server Component です。
 * 静的フレーム (ヘッダー、ナビゲーション等) を即座に描画し、
 * データ取得・フォーム操作を行うクライアントコンポーネントを Suspense を用いてストリーミングします。
 *
 * Requirements: 6.10, 6.11, 6.12, 6.16, 7.8
 */
import React, { Suspense } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import AdminGenresClient from './admin-genres-client';

export default function AdminGenresPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      {/* サーバー側で即時描画される静的フレーム */}
      <header className="space-y-2">
        <Badge variant="secondary">🛡️ 管理者専用</Badge>
        <h1 className="text-2xl font-bold">ジャンル直接管理</h1>
        <p className="text-sm text-muted-foreground">
          コミュニティ投票を経由せずに、新しいジャンルを即時に定義・追加します。
        </p>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link href="/admin" className="hover:text-foreground hover:underline">
            ⚙️ 管理者ポータルへ
          </Link>
          <Link href="/admin/moderation" className="hover:text-foreground hover:underline">
            🛡️ モデレーション審査画面へ
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
            data-testid="genres-management-skeleton"
            className="grid gap-6 md:grid-cols-3"
          >
            {/* フォーム側プレースホルダー */}
            <div className="h-[400px] animate-pulse rounded-xl bg-muted md:col-span-1" />
            
            {/* テーブル側プレースホルダー */}
            <div className="space-y-3 md:col-span-2">
              <div className="h-10 w-full animate-pulse rounded bg-muted" />
              <div className="h-16 w-full animate-pulse rounded bg-muted" />
              <div className="h-16 w-full animate-pulse rounded bg-muted" />
              <div className="h-16 w-full animate-pulse rounded bg-muted" />
            </div>
          </div>
        }
      >
        <AdminGenresClient />
      </Suspense>
    </div>
  );
}
