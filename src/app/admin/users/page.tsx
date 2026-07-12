/**
 * システム管理者向けユーザー評判スコアリセット画面
 */
'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CircularProgress } from '@mui/material';
import { useAuth } from '@/context/auth-context';
import { Badge } from '@/components/ui/badge';
import { AdminUserSearchPanel } from './admin-user-search-panel';

export default function AdminUsersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const isAuthorized =
    (user?.moderationTier as string) === 'admin' ||
    (user as { role?: string })?.role === 'admin';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/admin/users');
      return;
    }
    if (!loading && user && !isAuthorized) {
      router.push('/not-found');
    }
  }, [user, loading, isAuthorized, router]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <CircularProgress size={32} />
        <p>認証情報を確認しています...</p>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <div className="flex gap-4">
          <Link
            href="/admin"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            ⚙️ 管理者ポータルへ
          </Link>
          <Link
            href="/admin/moderation"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            🛡️ モデレーション審査画面へ
          </Link>
          <Link
            href="/admin/genres"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            🎭 ジャンル直接管理画面へ
          </Link>
        </div>
      </div>

      <header className="space-y-2">
        <Badge variant="secondary">🛡️ 特権管理者専用</Badge>
        <h1 className="text-2xl font-bold">ユーザー評判管理</h1>
        <p className="text-sm text-muted-foreground">
          不適切行為を行ったユーザーの信頼スコア（reputationScore）および権限ティアー（moderationTier）を強制的に初期値へリセットします。
        </p>
      </header>

      <AdminUserSearchPanel />
    </div>
  );
}
