/**
 * 管理者専用ジャンル管理・直接追加画面のクライアントサイドUIコンポーネント
 */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CircularProgress } from '@mui/material';
import { useAuth } from '@/context/auth-context';
import { isAdminUser } from '@/lib/middleware-auth-cookies';
import { uploadImage, getGenreIconPath } from '@/services/storage';
import {
  validateGenreIconFile,
  GENRE_ICON_ACCEPT,
} from '@/lib/genre-icon-upload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface GenreMetadata {
  id: string;
  displayName: string;
  description: string;
  iconImageUrl: string | null;
  isActive: boolean;
  createdAt?: string | Date;
}

export default function AdminGenresClient() {
  const { user, authUser, loading } = useAuth();
  const router = useRouter();

  // 各種ステート定義
  const [genres, setGenres] = useState<GenreMetadata[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // フォームステート定義
  const [formGenreId, setFormGenreId] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIconFile, setFormIconFile] = useState<File | null>(null);
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null);
  const [iconError, setIconError] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [tempIconUrl, setTempIconUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AIアイコン生成処理の実行
  const handleGenerateIconAi = async () => {
    if (!authUser) {
      setIconError('ログインセッションが無効です。');
      return;
    }

    if (!formDisplayName.trim() || !formDescription.trim()) {
      setIconError('ジャンル名と説明を入力してください。');
      return;
    }

    setAiGenerating(true);
    setIconError(null);
    setErrorMessage(null);

    try {
      const token = await authUser.getIdToken();
      const res = await fetch('/api/genres/generate-icon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: formDisplayName,
          description: formDescription,
          userId: authUser.uid,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || '画像の生成に失敗しました。');
      }

      setTempIconUrl(data.iconImageUrl);
      setIconPreviewUrl(data.iconImageUrl);
      setFormIconFile(null); // 手動アップロードファイルをクリア
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('AIアイコン生成エラー:', err);
      setIconError(
        err instanceof Error
          ? err.message
          : '画像の生成に失敗しました。しばらくしてから再度お試しください。'
      );
    } finally {
      setAiGenerating(false);
    }
  };

  // 管理者チェック
  const isAdmin = Boolean(user && isAdminUser(user));

  // 認証・認可ガード
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/admin/genres');
      return;
    }
    if (!loading && user && !isAdmin) {
      router.push('/not-found');
    }
  }, [user, loading, isAdmin, router]);

  // ジャンル一覧データの取得
  const fetchGenres = async () => {
    if (!authUser) return;
    setFetchLoading(true);
    setErrorMessage(null);
    try {
      const token = await authUser.getIdToken();
      const res = await fetch('/api/admin/genres', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'ジャンル一覧の取得に失敗しました。');
      }

      const data = (await res.json()) as GenreMetadata[];
      setGenres(data);
    } catch (err) {
      console.error('ジャンル一覧取得エラー:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'ジャンル一覧の取得に失敗しました。'
      );
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && authUser) {
      void fetchGenres();
    }
  }, [isAdmin, authUser]);

  // アイコンファイル選択時のハンドラ
  const handleIconChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setIconError(null);
    setFormIconFile(null);
    setIconPreviewUrl(null);
    setTempIconUrl(null);

    if (!file) return;

    // クライアント側バリデーションの実行 (SEC-08)
    const validation = validateGenreIconFile(file);
    if (!validation.ok) {
      setIconError(validation.error);
      return;
    }

    setUploadLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/genres/upload-icon', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'アイコン画像のアップロードに失敗しました。');
      }

      setFormIconFile(file);
      setIconPreviewUrl(data.tempUrl);
      setTempIconUrl(data.tempUrl);
    } catch (err) {
      console.error('アイコンアップロードエラー:', err);
      setIconError(
        err instanceof Error ? err.message : 'アップロードに失敗しました。'
      );
    } finally {
      setUploadLoading(false);
    }
  };

  // ジャンルの追加登録送信処理
  const handleSubmitGenre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      setErrorMessage('ログインセッションが無効です。');
      return;
    }

    // ジャンルID形式チェック: 半角英数字とハイフンのみ
    if (!/^[a-z0-9-]+$/.test(formGenreId)) {
      setErrorMessage(
        'ジャンルIDは半角小文字の英数字とハイフンのみで入力してください。'
      );
      return;
    }

    setSubmitLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const iconImageUrl = tempIconUrl;

      const token = await authUser.getIdToken();
      const res = await fetch('/api/admin/genres', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: formGenreId,
          displayName: formDisplayName,
          description: formDescription,
          iconImageUrl,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'ジャンルの追加に失敗しました。');
      }

      setSuccessMessage(`ジャンル「${formDisplayName}」を新しく追加しました。`);

      // フォームのクリア
      setFormGenreId('');
      setFormDisplayName('');
      setFormDescription('');
      setFormIconFile(null);
      setIconPreviewUrl(null);
      setTempIconUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // 一覧を即時更新 (Stateの更新)
      if (data.data) {
        setGenres((prev) => [data.data, ...prev]);
      } else {
        void fetchGenres();
      }
    } catch (err) {
      console.error('ジャンル追加エラー:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'ジャンルの追加に失敗しました。'
      );
    } finally {
      setSubmitLoading(false);
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

      <div className="grid gap-6 md:grid-cols-3">
        {/* 新規追加フォーム */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">新規ジャンルを追加</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitGenre} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="genreId">ジャンルID</Label>
                <Input
                  id="genreId"
                  type="text"
                  placeholder="例: math-science"
                  value={formGenreId}
                  onChange={(e) => setFormGenreId(e.target.value.toLowerCase())}
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  半角小文字の英数字とハイフンのみ (例: world-history)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">ジャンル名 (日本語)</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="例: 数学・科学"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">説明</Label>
                <Textarea
                  id="description"
                  placeholder="このジャンルの説明を記入します"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="iconFile">アイコン画像</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateIconAi}
                    disabled={aiGenerating || submitLoading}
                  >
                    {aiGenerating ? (
                      <>
                        <CircularProgress size={12} color="inherit" className="mr-1" />
                        生成中...
                      </>
                    ) : (
                      '✨ AIで生成'
                    )}
                  </Button>
                </div>
                <div
                  className="cursor-pointer rounded-lg border border-dashed p-4 text-center transition-colors hover:bg-muted/50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {iconPreviewUrl ? (
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={iconPreviewUrl}
                        alt="プレビュー"
                        className="size-12 rounded object-cover"
                      />
                      <span className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">
                        {formIconFile ? formIconFile.name : '✨ AI生成画像'}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1 text-muted-foreground">
                      <span className="text-xl">🖼️</span>
                      <p className="text-xs">クリックしてファイルを選択</p>
                      <p className="text-[10px]">PNG, JPEG, GIF (最大 2MB)</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  id="iconFile"
                  type="file"
                  accept={GENRE_ICON_ACCEPT}
                  onChange={handleIconChange}
                  className="hidden"
                />
                {iconError && <p className="text-xs text-destructive">{iconError}</p>}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={submitLoading || !!iconError}
              >
                {submitLoading ? (
                  <>
                    <CircularProgress size={16} color="inherit" className="mr-2" /> 追加中...
                  </>
                ) : (
                  '➕ ジャンルを追加'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 登録済みジャンル一覧 */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">登録済みジャンル一覧</CardTitle>
          </CardHeader>
          <CardContent>
            {fetchLoading ? (
              // スケルトン表示 (Requirement 6, 8.1 準拠)
              <div
                data-testid="genres-management-skeleton"
                className="space-y-3"
              >
                <div className="h-10 w-full animate-pulse rounded bg-muted" />
                <div className="h-16 w-full animate-pulse rounded bg-muted" />
                <div className="h-16 w-full animate-pulse rounded bg-muted" />
                <div className="h-16 w-full animate-pulse rounded bg-muted" />
              </div>
            ) : genres.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                登録されているジャンルはありません。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">アイコン</TableHead>
                      <TableHead>表示名 / ID</TableHead>
                      <TableHead>説明</TableHead>
                      <TableHead className="w-[100px]">ステータス</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {genres.map((genre) => (
                      <TableRow key={genre.id}>
                        <TableCell>
                          <div className="flex size-10 items-center justify-center overflow-hidden rounded bg-muted">
                            {genre.iconImageUrl ? (
                              <img
                                src={genre.iconImageUrl}
                                alt={genre.displayName}
                                className="size-full object-cover"
                              />
                            ) : (
                              <span className="text-lg">🎭</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold">{genre.displayName}</div>
                          <code className="text-xs text-muted-foreground">{genre.id}</code>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {genre.description || '説明なし'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={genre.isActive ? 'default' : 'secondary'}>
                            {genre.isActive ? '有効' : '無効'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
