/**
 * システム管理者向けユーザー評判スコアリセット画面
 */
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CircularProgress } from '@mui/material';
import { useAuth } from '@/context/auth-context';
import { getUserProfile } from '@/services/user';
import { User } from '@/types';
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type PendingAction = 'reset' | 'ban' | 'unban' | null;

export default function AdminUsersPage() {
  const { user, authUser, loading } = useAuth();
  const router = useRouter();

  const [searchUid, setSearchUid] = useState('');
  const [searchedUser, setSearchedUser] = useState<User | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [reason, setReason] = useState('');
  const [banReason, setBanReason] = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUid.trim()) return;

    setFetchLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    setSearchedUser(null);
    setHasSearched(true);

    try {
      const u = await getUserProfile(searchUid.trim());
      setSearchedUser(u);
      if (!u) {
        setErrorMessage('指定されたUIDのユーザーが見つかりません。');
      }
    } catch (err) {
      console.error('ユーザー検索エラー:', err);
      setErrorMessage('ユーザー情報の取得中にエラーが発生しました。');
    } finally {
      setFetchLoading(false);
    }
  };

  const executeReset = async () => {
    if (!searchedUser || !authUser) return;

    setActionLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const token = await authUser.getIdToken();
      const res = await fetch('/api/admin/users/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUid: searchedUser.id,
          reason,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || data.error || 'リセット処理に失敗しました。');
      }

      setSuccessMessage('ユーザーの信頼スコアと権限ティアーをリセットしました。');
      setReason('');
      const updatedUser = await getUserProfile(searchedUser.id);
      setSearchedUser(updatedUser);
    } catch (err: unknown) {
      console.error('リセットエラー:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'リセット処理中にエラーが発生しました。',
      );
    } finally {
      setActionLoading(false);
      setPendingAction(null);
    }
  };

  const executeBan = async () => {
    if (!searchedUser || !authUser) return;

    setActionLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const token = await authUser.getIdToken();
      const res = await fetch('/api/admin/users/ban', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUid: searchedUser.id,
          reason: banReason,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || data.error || 'BAN処理に失敗しました。');
      }

      setSuccessMessage('ユーザーアカウントを停止（BAN）しました。');
      setBanReason('');
      const updatedUser = await getUserProfile(searchedUser.id);
      setSearchedUser(updatedUser);
    } catch (err: unknown) {
      console.error('BANエラー:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'BAN処理中にエラーが発生しました。',
      );
    } finally {
      setActionLoading(false);
      setPendingAction(null);
    }
  };

  const executeUnban = async () => {
    if (!searchedUser || !authUser) return;

    setActionLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const token = await authUser.getIdToken();
      const res = await fetch('/api/admin/users/unban', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUid: searchedUser.id,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || data.error || 'BAN解除に失敗しました。');
      }

      setSuccessMessage('ユーザーアカウントの停止（BAN）を解除しました。');
      const updatedUser = await getUserProfile(searchedUser.id);
      setSearchedUser(updatedUser);
    } catch (err: unknown) {
      console.error('UNBANエラー:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'BAN解除処理中にエラーが発生しました。',
      );
    } finally {
      setActionLoading(false);
      setPendingAction(null);
    }
  };

  const handleResetRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchedUser) return;
    if (reason.length < 10) {
      setErrorMessage('リセット理由は10文字以上で入力してください。');
      return;
    }
    setPendingAction('reset');
  };

  const handleBanRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchedUser) return;
    if (banReason.length < 10) {
      setErrorMessage('BAN理由は10文字以上で入力してください。');
      return;
    }
    setPendingAction('ban');
  };

  const handleConfirmAction = () => {
    if (pendingAction === 'reset') void executeReset();
    else if (pendingAction === 'ban') void executeBan();
    else if (pendingAction === 'unban') void executeUnban();
  };

  const getTierLabel = (tier: string) => {
    const labels: Record<string, string> = {
      newcomer: 'Newcomer (新規)',
      contributor: 'Contributor (貢献者)',
      moderator: 'Moderator (一般モデレータ)',
      senior_moderator: 'Senior Moderator (上級モデレータ)',
      admin: 'Admin (システム管理者)',
    };
    return labels[tier] ?? tier;
  };

  const confirmDialogProps = {
    reset: {
      title: '評判スコア・権限ティアーをリセットしますか？',
      description:
        '対象ユーザーの信頼スコアは 0 に、モデレーター権限ティアーは Newcomer に強制リセットされます。この操作は監査ログに記録されます。',
      confirmLabel: 'リセットを実行',
    },
    ban: {
      title: 'このユーザーをBANしますか？',
      description:
        '対象ユーザーは即座に強制ログアウトされ、すべての機能へのアクセスが遮断されます。この操作は監査ログに記録されます。',
      confirmLabel: 'BANを実行',
    },
    unban: {
      title: 'BANを解除しますか？',
      description: 'このユーザーのアカウント停止を解除し、通常のアクセスを復帰させます。',
      confirmLabel: 'BANを解除',
    },
  } as const;

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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ユーザー検索</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              type="text"
              placeholder="ユーザーUIDを入力..."
              value={searchUid}
              onChange={(e) => setSearchUid(e.target.value)}
              disabled={fetchLoading || actionLoading}
              required
              className="flex-1"
            />
            <Button type="submit" disabled={fetchLoading || actionLoading}>
              {fetchLoading ? <CircularProgress size={16} /> : '検索'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {searchedUser && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start gap-4">
              <img
                src={
                  searchedUser.avatarUrl ||
                  `https://api.dicebear.com/7.x/bottts/svg?seed=${searchedUser.id}`
                }
                alt={searchedUser.displayName}
                className="size-16 rounded-full border"
              />
              <div className="flex-1 space-y-1">
                <CardTitle>{searchedUser.displayName}</CardTitle>
                <p className="font-mono text-xs text-muted-foreground">UID: {searchedUser.id}</p>
                {searchedUser.isBanned ? (
                  <Badge variant="destructive">BAN済み</Badge>
                ) : searchedUser.deleteStatus === 'delete_pending' ? (
                  <Badge variant="secondary">退会申請中</Badge>
                ) : (
                  <Badge variant="outline">アクティブ</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>項目</TableHead>
                    <TableHead>値</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>現在の信頼スコア</TableCell>
                    <TableCell className="font-medium">
                      {searchedUser.reputationScore ?? 0} pt
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>現在の権限ティアー</TableCell>
                    <TableCell>{getTierLabel(searchedUser.moderationTier)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>公開クイズ数</TableCell>
                    <TableCell>{searchedUser.createdQuizzesCount ?? 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>総プレイ回数</TableCell>
                    <TableCell>{searchedUser.totalPlayCount ?? 0}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">評判スコア・権限ティアーの初期化</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                【注意】この操作を実行すると、対象ユーザーの信頼スコアは <strong>0</strong>{' '}
                に、モデレーター権限ティアーは <strong>Newcomer</strong>{' '}
                に強制リセットされます。実行履歴は監査ログとして保存されます。
              </p>
              <form onSubmit={handleResetRequest} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resetReason">リセット理由（10文字以上必須）</Label>
                  <Textarea
                    id="resetReason"
                    placeholder="ユーザーに評判スコアをリセットするに至った具体的な理由を入力してください..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={actionLoading}
                    rows={4}
                    required
                  />
                  <p className="text-xs text-muted-foreground">現在の文字数: {reason.length} 文字</p>
                </div>
                <Button
                  type="submit"
                  id="execute-reset-btn"
                  variant="destructive"
                  disabled={actionLoading || reason.length < 10}
                >
                  {actionLoading && pendingAction === 'reset' ? (
                    <>
                      <CircularProgress size={16} /> 処理中...
                    </>
                  ) : (
                    '🚨 評判と権限を緊急リセットする'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {searchedUser.isBanned
                  ? 'アカウント停止の解除 (UNBAN)'
                  : 'アカウントの停止 (BAN)'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {searchedUser.isBanned ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    現在このユーザーはアカウントが停止（BAN）されています。
                    <br />
                    理由: <strong>{searchedUser.bannedReason || '（理由なし）'}</strong>
                  </p>
                  <Button
                    type="button"
                    id="execute-unban-btn"
                    onClick={() => setPendingAction('unban')}
                    disabled={actionLoading}
                  >
                    {actionLoading && pendingAction === 'unban' ? (
                      <>
                        <CircularProgress size={16} /> 処理中...
                      </>
                    ) : (
                      '🟢 アカウント停止を解除する'
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    【注意】この操作を実行すると、対象ユーザーはシステムから即座に強制ログアウトされ、すべての機能へのアクセスが遮断されます。実行履歴は監査ログとして保存されます。
                  </p>
                  <form onSubmit={handleBanRequest} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="banReason">BAN理由（10文字以上必須）</Label>
                      <Textarea
                        id="banReason"
                        placeholder="ユーザーアカウントを停止する具体的な理由を入力してください..."
                        value={banReason}
                        onChange={(e) => setBanReason(e.target.value)}
                        disabled={actionLoading}
                        rows={4}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        現在の文字数: {banReason.length} 文字
                      </p>
                    </div>
                    <Button
                      type="submit"
                      id="execute-ban-btn"
                      variant="destructive"
                      disabled={actionLoading || banReason.length < 10}
                    >
                      {actionLoading && pendingAction === 'ban' ? (
                        <>
                          <CircularProgress size={16} /> 処理中...
                        </>
                      ) : (
                        '🚨 このユーザーをBANする'
                      )}
                    </Button>
                  </form>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {hasSearched && !searchedUser && !fetchLoading && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <span className="text-3xl">🔍</span>
            <p>
              指定されたUIDのユーザーが見つかりませんでした。入力されたUIDが正しいかご確認ください。
            </p>
          </CardContent>
        </Card>
      )}

      {pendingAction && (
        <ConfirmActionDialog
          open={!!pendingAction}
          onOpenChange={(open) => {
            if (!open && !actionLoading) setPendingAction(null);
          }}
          title={confirmDialogProps[pendingAction].title}
          description={confirmDialogProps[pendingAction].description}
          confirmLabel={confirmDialogProps[pendingAction].confirmLabel}
          onConfirm={handleConfirmAction}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
