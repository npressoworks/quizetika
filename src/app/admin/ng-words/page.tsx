/**
 * 管理者専用NGワードマスタ管理画面
 *
 * サーバーサイドで動作する Server Component です。
 * 静的フレーム (ヘッダー等) を即座に描画し、
 * データ取得・フォーム操作を行うクライアントコンポーネントを Suspense を用いてストリーミングします。
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.6, 10.9
 */
import React, { Suspense } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import AdminNgWordsClient from './admin-ng-words-client';

export default function AdminNgWordsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      {/* サーバー側で即時描画される静的フレーム */}
      <header className="space-y-2">
        <Badge variant="secondary">🛡️ 管理者専用</Badge>
        <h1 className="text-2xl font-bold">NGワードマスタ管理</h1>
        <p className="text-sm text-muted-foreground">
          クイズ公開時に検知される禁止語句（NGワード）の登録・編集・有効/無効切替を行います。
        </p>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link href="/admin" className="hover:text-foreground hover:underline">
            ⚙️ 管理者ポータルへ
          </Link>
        </div>
      </header>

      {/* 非同期データロード中のプレースホルダー (スケルトン) */}
      <Suspense
        fallback={
          <div data-testid="ng-words-management-skeleton" className="space-y-6">
            <div className="h-40 w-full animate-pulse rounded-xl bg-muted" />
            <div className="space-y-3">
              <div className="h-10 w-full animate-pulse rounded bg-muted" />
              <div className="h-12 w-full animate-pulse rounded bg-muted" />
              <div className="h-12 w-full animate-pulse rounded bg-muted" />
            </div>
          </div>
        }
      >
        <AdminNgWordsClient />
      </Suspense>
    </div>
  );
}
