import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowBackOutlined, SettingsOutlined } from '@mui/icons-material';
import { SettingsClient } from './settings-client';

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowBackOutlined sx={{ fontSize: 16 }} /> ホームに戻る
      </Link>

      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight">
          <SettingsOutlined sx={{ fontSize: 32 }} />
          設定
        </h1>
        <p className="mt-2 text-muted-foreground">
          表示テーマやアカウント関連の設定を変更できます。
        </p>
      </div>

      <Suspense fallback={<div data-testid="settings-skeleton">読み込み中...</div>}>
        <SettingsClient />
      </Suspense>
    </div>
  );
}
