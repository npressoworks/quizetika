/**
 * 管理者専用NGワードマスタ管理画面のクライアントサイドUIコンポーネント
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.6, 10.9
 */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircularProgress } from '@mui/material';
import { useAuth } from '@/context/auth-context';
import { isAdminUser } from '@/lib/middleware-auth-cookies';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface NgWord {
  id: string;
  word: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function AdminNgWordsClient() {
  const { user, authUser, loading } = useAuth();
  const router = useRouter();

  // 一覧・グローバルステート
  const [ngWords, setNgWords] = useState<NgWord[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 新規登録フォームステート
  const [newWord, setNewWord] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);

  // 行内編集ステート
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [rowSubmittingId, setRowSubmittingId] = useState<string | null>(null);

  // 管理者チェック
  const isAdmin = Boolean(user && isAdminUser(user));

  // 認証・認可ガード
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/admin/ng-words');
      return;
    }
    if (!loading && user && !isAdmin) {
      router.push('/not-found');
    }
  }, [user, loading, isAdmin, router]);

  // NGワード一覧の取得
  const fetchNgWords = async () => {
    if (!authUser) return;
    setFetchLoading(true);
    setErrorMessage(null);
    try {
      const token = await authUser.getIdToken();
      const res = await fetch('/api/admin/ng-words', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'NGワード一覧の取得に失敗しました。');
      }

      const data = (await res.json()) as NgWord[];
      setNgWords(data);
    } catch (err) {
      console.error('NGワード一覧取得エラー:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'NGワード一覧の取得に失敗しました。'
      );
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && authUser) {
      void fetchNgWords();
    }
  }, [isAdmin, authUser]);

  // 新規NGワードの登録送信処理
  const handleSubmitNewWord = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setSuccessMessage(null);
    setErrorMessage(null);

    const trimmed = newWord.trim();
    if (trimmed.length === 0) {
      setAddError('NGワードは空文字または空白のみでは登録できません。');
      return;
    }

    if (!authUser) {
      setErrorMessage('ログインセッションが無効です。');
      return;
    }

    setAddSubmitting(true);

    try {
      const token = await authUser.getIdToken();
      const res = await fetch('/api/admin/ng-words', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ word: trimmed }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'NGワードの登録に失敗しました。');
      }

      setSuccessMessage(`NGワード「${trimmed}」を登録しました。`);
      setNewWord('');

      if (data.data) {
        setNgWords((prev) => [data.data, ...prev]);
      } else {
        void fetchNgWords();
      }
    } catch (err) {
      console.error('NGワード登録エラー:', err);
      setAddError(
        err instanceof Error ? err.message : 'NGワードの登録に失敗しました。'
      );
    } finally {
      setAddSubmitting(false);
    }
  };

  // 行内編集の開始
  const handleStartEdit = (ngWord: NgWord) => {
    setEditingId(ngWord.id);
    setEditValue(ngWord.word);
    setEditError(null);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  // 行内編集のキャンセル
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
    setEditError(null);
  };

  // 行内編集の保存
  const handleSaveEdit = async (id: string) => {
    setEditError(null);

    const trimmed = editValue.trim();
    if (trimmed.length === 0) {
      setEditError('NGワードは空文字または空白のみでは登録できません。');
      return;
    }

    if (!authUser) {
      setErrorMessage('ログインセッションが無効です。');
      return;
    }

    setRowSubmittingId(id);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const token = await authUser.getIdToken();
      const res = await fetch(`/api/admin/ng-words/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ word: trimmed }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'NGワードの編集に失敗しました。');
      }

      setNgWords((prev) =>
        prev.map((w) => (w.id === id ? (data.data as NgWord) : w))
      );
      setSuccessMessage('NGワードを更新しました。');
      setEditingId(null);
      setEditValue('');
    } catch (err) {
      console.error('NGワード編集エラー:', err);
      const message =
        err instanceof Error ? err.message : 'NGワードの編集に失敗しました。';
      setEditError(message);
      setErrorMessage(message);
    } finally {
      setRowSubmittingId(null);
    }
  };

  // 有効/無効切替
  const handleToggleActive = async (ngWord: NgWord) => {
    if (!authUser) {
      setErrorMessage('ログインセッションが無効です。');
      return;
    }

    const nextIsActive = !ngWord.isActive;
    setRowSubmittingId(ngWord.id);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const token = await authUser.getIdToken();
      const res = await fetch(`/api/admin/ng-words/${ngWord.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: nextIsActive }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'NGワードの有効/無効切替に失敗しました。');
      }

      setNgWords((prev) =>
        prev.map((w) => (w.id === ngWord.id ? (data.data as NgWord) : w))
      );
      setSuccessMessage('NGワードの状態を更新しました。');
    } catch (err) {
      console.error('NGワード有効/無効切替エラー:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'NGワードの有効/無効切替に失敗しました。'
      );
    } finally {
      setRowSubmittingId(null);
    }
  };

  // 認証のローディング中
  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <CircularProgress size={32} color="inherit" />
        <p>認証情報を確認しています...</p>
      </div>
    );
  }

  // 管理者以外はコンテンツを描画しない
  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
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

      {/* 新規登録フォーム */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">新規NGワードを登録</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitNewWord} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="newWord">NGワード</Label>
              <Input
                id="newWord"
                type="text"
                placeholder="登録する語句を入力"
                value={newWord}
                onChange={(e) => {
                  setNewWord(e.target.value);
                  if (addError) setAddError(null);
                }}
              />
              {addError && <p className="text-xs text-destructive">{addError}</p>}
            </div>
            <Button type="submit" disabled={addSubmitting}>
              {addSubmitting ? (
                <>
                  <CircularProgress size={16} color="inherit" className="mr-2" /> 追加中...
                </>
              ) : (
                '➕ 追加'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 登録済みNGワード一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">登録済みNGワード一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {fetchLoading ? (
            <div data-testid="ng-words-list-skeleton" className="space-y-3">
              <div className="h-10 w-full animate-pulse rounded bg-muted" />
              <div className="h-12 w-full animate-pulse rounded bg-muted" />
              <div className="h-12 w-full animate-pulse rounded bg-muted" />
            </div>
          ) : ngWords.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              登録されているNGワードはありません。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>語句</TableHead>
                    <TableHead className="w-[100px]">ステータス</TableHead>
                    <TableHead className="w-[180px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ngWords.map((ngWord) => {
                    const isEditing = editingId === ngWord.id;
                    const isRowSubmitting = rowSubmittingId === ngWord.id;
                    return (
                      <TableRow key={ngWord.id}>
                        <TableCell>
                          {isEditing ? (
                            <div className="space-y-1">
                              <Input
                                type="text"
                                value={editValue}
                                onChange={(e) => {
                                  setEditValue(e.target.value);
                                  if (editError) setEditError(null);
                                }}
                              />
                              {editError && (
                                <p className="text-xs text-destructive">{editError}</p>
                              )}
                            </div>
                          ) : (
                            ngWord.word
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={ngWord.isActive}
                              onCheckedChange={() => handleToggleActive(ngWord)}
                              disabled={isRowSubmitting}
                              data-testid={`ngword-toggle-${ngWord.id}`}
                            />
                            <Badge variant={ngWord.isActive ? 'default' : 'secondary'}>
                              {ngWord.isActive ? '有効' : '無効'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={isRowSubmitting}
                                onClick={() => handleSaveEdit(ngWord.id)}
                              >
                                {isRowSubmitting ? (
                                  <CircularProgress size={14} color="inherit" />
                                ) : (
                                  '保存'
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isRowSubmitting}
                                onClick={handleCancelEdit}
                              >
                                キャンセル
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isRowSubmitting}
                              onClick={() => handleStartEdit(ngWord)}
                            >
                              編集
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
