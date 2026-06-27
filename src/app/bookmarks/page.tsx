import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowBackOutlined as ArrowBackIcon, BookmarkBorderOutlined as BookmarkIcon } from '@mui/icons-material';
import { BookmarksClient } from './bookmarks-client';
import { BookmarksSkeleton } from '@/components/ui/bookmarks-skeleton';

export default async function BookmarksPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowBackIcon sx={{ fontSize: 16 }} /> ホームに戻る
      </Link>

      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight">
          <BookmarkIcon sx={{ fontSize: 32 }} className="text-primary" />
          ブックマーク
        </h1>
        <p className="mt-2 text-muted-foreground">
          クイズ・リスト・問題を種類ごとに管理できます。
        </p>
      </div>

      <Suspense fallback={<BookmarksSkeleton data-testid="bookmarks-skeleton" />}>
        <BookmarksClient />
      </Suspense>
    </div>
  );
}
