import React, { Suspense } from 'react';
import { CreatorQuizManagementClient } from './creator-quiz-management-client';

export default function CreatorQuizzesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-8 space-y-1">
        <h1 className="text-2xl font-bold md:text-3xl">作成クイズ管理</h1>
        <p className="text-sm text-muted-foreground">
          作成したクイズの一覧・検索・並び替え・公開範囲の管理を行いましょう。
        </p>
      </div>

      <Suspense fallback={<div data-testid="creator-quiz-management-loading">読み込み中...</div>}>
        <CreatorQuizManagementClient />
      </Suspense>
    </div>
  );
}
