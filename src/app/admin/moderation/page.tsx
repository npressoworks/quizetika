/**
 * 管理者モデレーション審査画面
 *
 * 機能:
 * - 通報5回以上で suspended となったクイズの審査キュー表示
 * - 各アイテムの通報理由・詳細の表示
 * - 公開復帰（通報リセット）・コンテンツ削除のアクションボタン
 * - 対象クイズクリック時の管理者審査用特別閲覧ビューへの遷移
 * - moderationTier によるクライアントサイドアクセスガード
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1, 5.2, 5.3, 5.6, 5.7
 * Boundary: AdminModeration-Queue, AdminModeration-Action, Seed UI
 */
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CircularProgress } from '@mui/material';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/auth-context';
import { isAdminUser } from '@/lib/middleware-auth-cookies';
import { resolveFlag } from '@/services/moderation';
import { assertSeedGenresAccess } from '@/lib/seed-genres-access';
import { mapRowToQuiz, type QuizRowWithRelations } from '@/services/quiz';
import { Quiz } from '@/types';
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/** 通報フラグの詳細情報 */
interface FlagDetail {
  id: string;
  quizId: string;
  reporterId: string;
  reason: string;
  createdAt: Date;
}

/** 審査キューアイテム（クイズ＋関連フラグ群） */
interface ModerationQueueItem {
  quiz: Quiz;
  flags: FlagDetail[];
}

type PendingAction = { quizId: string; action: 'restore' | 'delete' } | null;

const supabase = createClient();

export default function AdminModerationPage() {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();

  const [queueItems, setQueueItems] = useState<ModerationQueueItem[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedSuccessMessage, setSeedSuccessMessage] = useState<string | null>(null);
  const [seedErrorMessage, setSeedErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const isAuthorized =
    user?.moderationTier === 'senior_moderator' ||
    (user?.moderationTier as string) === 'admin' ||
    (user && isAdminUser(user));

  const isAdmin = Boolean(user && isAdminUser(user));

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/admin/moderation');
      return;
    }
    if (!loading && user && !isAuthorized) {
      router.push('/not-found');
    }
  }, [user, loading, isAuthorized, router]);

  useEffect(() => {
    if (!isAuthorized) return;

    const fetchQueue = async () => {
      setFetchLoading(true);
      try {
        const { data: quizRows, error: quizError } = await supabase
          .from('quizzes')
          .select('*')
          .eq('status', 'suspended')
          .order('flags_count', { ascending: false });

        if (quizError) throw quizError;

        const quizzes = (quizRows ?? []).map((row) =>
          mapRowToQuiz(row as QuizRowWithRelations),
        );
        const quizIds = quizzes.map((quiz) => quiz.id);

        const { data: flagRows, error: flagError } =
          quizIds.length > 0
            ? await supabase.from('flags').select('*').in('quiz_id', quizIds)
            : { data: [], error: null };

        if (flagError) throw flagError;

        const flagsByQuizId = new Map<string, FlagDetail[]>();
        for (const row of flagRows ?? []) {
          const detail: FlagDetail = {
            id: row.id,
            quizId: row.quiz_id,
            reporterId: row.reporter_id,
            reason: row.reason,
            createdAt: new Date(row.created_at),
          };
          const list = flagsByQuizId.get(row.quiz_id) ?? [];
          list.push(detail);
          flagsByQuizId.set(row.quiz_id, list);
        }

        setQueueItems(
          quizzes.map((quiz) => ({ quiz, flags: flagsByQuizId.get(quiz.id) ?? [] })),
        );
      } catch (err) {
        console.error('審査キューの取得に失敗しました:', err);
        setErrorMessage('審査キューの読み込みに失敗しました。');
      } finally {
        setFetchLoading(false);
      }
    };

    fetchQueue();
  }, [isAuthorized]);

  const executeAction = async (quizId: string, action: 'restore' | 'delete') => {
    setActionLoading(quizId + action);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      if (!user) throw new Error('ユーザーがログインしていません');
      await resolveFlag(quizId, action, user.id);
      setQueueItems((prev) => prev.filter((item) => item.quiz.id !== quizId));
      setSuccessMessage(
        action === 'restore'
          ? 'コンテンツを公開に復帰しました。'
          : 'コンテンツを削除し、作成者に通知しました。',
      );
    } catch (err) {
      console.error('アクション失敗:', err);
      setErrorMessage('操作に失敗しました。もう一度お試しください。');
    } finally {
      setActionLoading(null);
      setPendingAction(null);
    }
  };

  const handleConfirmAction = () => {
    if (!pendingAction) return;
    void executeAction(pendingAction.quizId, pendingAction.action);
  };

  const handleSeedGenres = async () => {
    if (!firebaseUser) {
      setSeedErrorMessage('ログインセッションが無効です。再度ログインしてください。');
      return;
    }

    setSeedLoading(true);
    setSeedSuccessMessage(null);
    setSeedErrorMessage(null);

    try {
      await assertSeedGenresAccess(firebaseUser.uid);

      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/admin/seed-genres', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        added?: number;
        updated?: number;
      };

      if (!res.ok) {
        throw new Error(
          data.message ||
            data.error ||
            '初期ジャンルの一括投入に失敗しました。',
        );
      }

      const added = data.added ?? 0;
      const updated = data.updated ?? 0;
      setSeedSuccessMessage(
        `初期ジャンルの一括投入が完了しました（新規: ${added}件、更新: ${updated}件）。`,
      );
    } catch (err) {
      console.error('初期ジャンル投入エラー:', err);
      setSeedErrorMessage(
        err instanceof Error ? err.message : '初期ジャンルの一括投入に失敗しました。',
      );
    } finally {
      setSeedLoading(false);
    }
  };

  const getReason = (reason: string) => {
    const labels: Record<string, string> = {
      harassment: '🔥 ハラスメント',
      spam: '📧 スパム',
      inappropriate: '🚫 不適切なコンテンツ',
      misinformation: '❌ 誤情報',
      copyright: '©️ 著作権侵害',
      other: '🔖 その他',
    };
    return labels[reason] ?? reason;
  };

  const confirmDialogProps = {
    restore: {
      title: 'コンテンツを公開に復帰しますか？',
      description: '通報フラグをリセットし、このクイズを公開状態に戻します。',
      confirmLabel: '公開に復帰',
    },
    delete: {
      title: 'コンテンツを削除しますか？',
      description: 'このクイズを削除し、作成者に通知します。この操作は取り消せません。',
      confirmLabel: 'コンテンツ削除',
    },
  } as const;

  if (loading || fetchLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <CircularProgress size={32} color="inherit" />
        <p>審査キューを読み込んでいます...</p>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header className="space-y-2">
        <Badge variant="secondary">🛡️ 管理者専用</Badge>
        <h1 className="text-2xl font-bold">モデレーション審査</h1>
        <p className="text-sm text-muted-foreground">
          通報が5回に達した保留コンテンツを審査し、公開復帰または削除を行います。
        </p>
        {isAdmin && (
          <div className="flex gap-4">
            <Link
              href="/admin"
              className="inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              ⚙️ 管理者ポータルへ
            </Link>
            <Link
              href="/admin/users"
              className="inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              👤 ユーザー評判管理画面へ
            </Link>
            <Link
              href="/admin/genres"
              className="inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              🎭 ジャンル直接管理画面へ
            </Link>
          </div>
        )}
      </header>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg" id="seed-genres-heading">
              初期ジャンル一括投入 (Seed Initial Genres)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              `src/data/initial_genres.json` に定義された標準ジャンルを
              metadata_genres へ冪等に登録します。
            </p>
            {seedSuccessMessage && (
              <Alert>
                <AlertDescription>✅ {seedSuccessMessage}</AlertDescription>
              </Alert>
            )}
            {seedErrorMessage && (
              <Alert variant="destructive">
                <AlertDescription>⚠️ {seedErrorMessage}</AlertDescription>
              </Alert>
            )}
            <Button
              type="button"
              id="seed-genres-btn"
              onClick={handleSeedGenres}
              disabled={seedLoading}
            >
              {seedLoading ? (
                <>
                  <CircularProgress size={16} color="inherit" className="mr-2" /> 投入中...
                </>
              ) : (
                '🌱 初期ジャンル一括投入'
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Alert>
          <AlertDescription>✅ {successMessage}</AlertDescription>
        </Alert>
      )}
      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>⚠️ {errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold">{queueItems.length}</span>
        <span className="text-muted-foreground">件の審査待ちコンテンツ</span>
      </div>

      {queueItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <span className="text-3xl">✨</span>
            <p>現在、審査待ちのコンテンツはありません。</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {queueItems.map(({ quiz, flags }) => (
            <Card key={quiz.id}>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">📝 クイズ</Badge>
                  <Badge variant="destructive">🚩 {quiz.flagsCount} 件の通報</Badge>
                </div>
                <Link
                  href={`/quiz/${quiz.id}?admin_review=1`}
                  target="_blank"
                  className="group flex items-start gap-2 hover:text-primary"
                >
                  <CardTitle className="text-lg group-hover:underline">{quiz.title}</CardTitle>
                  <span className="text-muted-foreground">🔍</span>
                </Link>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>作成者: {quiz.authorName}</span>
                  <span>問題数: {quiz.questionCount}問</span>
                  <span>ジャンル: {quiz.genre}</span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <h3 className="mb-2 text-sm font-semibold">通報詳細</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>理由</TableHead>
                        <TableHead>通報者</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flags.map((flag) => (
                        <TableRow key={flag.id}>
                          <TableCell>{getReason(flag.reason)}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {flag.reporterId.slice(0, 8)}...
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    id={`restore-btn-${quiz.id}`}
                    variant="default"
                    onClick={() => setPendingAction({ quizId: quiz.id, action: 'restore' })}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === quiz.id + 'restore' ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      '✅ 公開に復帰'
                    )}
                  </Button>
                  <Button
                    id={`delete-btn-${quiz.id}`}
                    variant="destructive"
                    onClick={() => setPendingAction({ quizId: quiz.id, action: 'delete' })}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === quiz.id + 'delete' ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      '🗑️ コンテンツ削除'
                    )}
                  </Button>
                  <Button variant="outline" render={<Link href={`/quiz/${quiz.id}?admin_review=1`} target="_blank" />}>
                    🔍 管理者審査ビューで確認
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pendingAction && (
        <ConfirmActionDialog
          open={!!pendingAction}
          onOpenChange={(open) => {
            if (!open && !actionLoading) setPendingAction(null);
          }}
          title={confirmDialogProps[pendingAction.action].title}
          description={confirmDialogProps[pendingAction.action].description}
          confirmLabel={confirmDialogProps[pendingAction.action].confirmLabel}
          onConfirm={handleConfirmAction}
          loading={actionLoading !== null}
        />
      )}
    </div>
  );
}
