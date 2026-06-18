/**
 * ジャンル新設申請・投票画面
 */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, notFound } from 'next/navigation';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/context/auth-context';
import { submitGenreRequest, voteGenreRequest } from '@/services/tagMerge';
import { uploadImage, getGenreIconPath } from '@/services/storage';
import {
  validateGenreIconFile,
  GENRE_ICON_ACCEPT,
} from '@/lib/genre-icon-upload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { isAdminUser } from '@/lib/middleware-auth-cookies';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';

interface GenreRequest {
  id: string;
  genreId: string;
  displayName: string;
  iconImageUrl: string;
  requesterId: string;
  votesForCount: number;
  votesAgainstCount: number;
  weightedVotesFor: number;
  weightedVotesAgainst: number;
  votedUserIds: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date | Timestamp;
}

type TabType = 'request' | 'vote' | 'history';

export default function CommunityGenresPage() {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('request');
  const [pendingRequests, setPendingRequests] = useState<GenreRequest[]>([]);
  const [historyRequests, setHistoryRequests] = useState<GenreRequest[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [voteLoading, setVoteLoading] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [autoApprovalAlert, setAutoApprovalAlert] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const TIER_RANK: Record<string, number> = {
    newcomer: 0,
    contributor: 1,
    moderator: 2,
    senior_moderator: 3,
    admin: 4,
  };

  const isModerator = !!user && (TIER_RANK[user.moderationTier] ?? 0) >= TIER_RANK.moderator;
  const isSeniorModerator = user?.moderationTier === 'senior_moderator';
  const isAdmin = !!user && isAdminUser(user);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/community/genres');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'genreRequests'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(
        (d) =>
          ({
            id: d.id,
            ...d.data(),
          }) as GenreRequest,
      );
      setPendingRequests(requests);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (activeTab !== 'history' || !user) return;

    let cancelled = false;
    const fetchHistory = async () => {
      setFetchLoading(true);
      try {
        const q = query(
          collection(db, 'genreRequests'),
          where('status', 'in', ['approved', 'rejected']),
          orderBy('createdAt', 'desc'),
        );
        const snap = await getDocs(q);
        setHistoryRequests(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GenreRequest),
        );
      } catch (err) {
        console.error('履歴取得エラー:', err);
      } finally {
        if (!cancelled) setFetchLoading(false);
      }
    };
    void fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [activeTab, user]);

  const handleIconChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setIconError(null);
    setFormIconFile(null);
    setIconPreviewUrl(null);
    setTempIconUrl(null);

    if (!file) return;

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

  const handleGenerateIconAi = async () => {
    if (!firebaseUser) {
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
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/genres/generate-icon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: formDisplayName,
          description: formDescription,
          userId: firebaseUser.uid,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || '画像の生成に失敗しました。');
      }

      setTempIconUrl(data.iconImageUrl);
      setIconPreviewUrl(data.iconImageUrl);
      setFormIconFile(null); // ファイルアップロードをクリア
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

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!tempIconUrl) {
      setErrorMessage('アイコン画像を選択または生成してください。');
      return;
    }

    if (!/^[a-z][a-z0-9-]*$/.test(formGenreId)) {
      setErrorMessage(
        'ジャンルIDは小文字の英数字とハイフンのみ使用できます（例: my-genre）。',
      );
      return;
    }

    setSubmitLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      let iconUrl = '';

      if (tempIconUrl) {
        // 一時保存アイコン画像を正式パスに移行
        const token = await firebaseUser!.getIdToken();
        const migrateRes = await fetch('/api/genres/migrate-icon', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tempUrl: tempIconUrl,
            genreId: formGenreId,
            userId: firebaseUser!.uid,
          }),
        });

        const migrateData = await migrateRes.json().catch(() => ({}));
        if (!migrateRes.ok) {
          throw new Error(migrateData.message || 'アイコン画像の保存処理に失敗しました。');
        }
        iconUrl = migrateData.iconImageUrl;
      }

      await submitGenreRequest(formGenreId, formDisplayName, formDescription, iconUrl, user.id);

      setSuccessMessage(`「${formDisplayName}」のジャンル申請を送信しました。`);
      setFormGenreId('');
      setFormDisplayName('');
      setFormDescription('');
      setFormIconFile(null);
      setIconPreviewUrl(null);
      setTempIconUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: unknown) {
      console.error('申請送信エラー:', err);
      setErrorMessage(
        err instanceof Error ? err.message : '申請の送信に失敗しました。',
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleVote = async (genreRequest: GenreRequest, vote: 'approve' | 'reject') => {
    if (!user || !isModerator) return;

    setVoteLoading(genreRequest.id + vote);
    setSuccessMessage(null);
    setErrorMessage(null);
    setAutoApprovalAlert(null);

    try {
      await voteGenreRequest(genreRequest.id, user.id, vote);

      const weight = user.moderationTier === 'senior_moderator' ? 2 : 1;
      const isApprove = vote === 'approve';
      const nextWeightedFor = genreRequest.weightedVotesFor + (isApprove ? weight : 0);
      const nextWeightedAgainst = genreRequest.weightedVotesAgainst + (isApprove ? 0 : weight);
      const totalWeighted = nextWeightedFor + nextWeightedAgainst;
      const approveRate = totalWeighted > 0 ? nextWeightedFor / totalWeighted : 0;

      if (nextWeightedFor >= 5 && approveRate >= 0.8) {
        setAutoApprovalAlert(
          `🎉 ジャンル「${genreRequest.displayName}」が可決され、ジャンルが追加されました！`,
        );
      } else {
        setSuccessMessage(
          vote === 'approve' ? '👍 賛成票を投じました。' : '👎 反対票を投じました。',
        );
      }
    } catch (err: unknown) {
      console.error('投票エラー:', err);
      setErrorMessage(err instanceof Error ? err.message : '投票に失敗しました。');
    } finally {
      setVoteLoading(null);
    }
  };

  const formatDate = (date: Date | Timestamp) => {
    const d = date instanceof Timestamp ? date.toDate() : date;
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const calcApprovalRate = (req: GenreRequest) => {
    const totalWeight = req.weightedVotesFor + req.weightedVotesAgainst;
    if (totalWeight === 0) return 0;
    return Math.round((req.weightedVotesFor / totalWeight) * 100);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
        <p>読み込んでいます...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <header className="space-y-2">
        <Badge variant="secondary">🎭 コミュニティ</Badge>
        <h1 className="text-2xl font-bold">ジャンル新設申請</h1>
        <p className="text-sm text-muted-foreground">
          新しいジャンルを申請し、モデレータの投票で承認されればカタログに追加されます。
        </p>
        {isSeniorModerator && (
          <Badge variant="outline">⚡ シニアモデレータ — 投票の重み: x2</Badge>
        )}
      </header>

      {autoApprovalAlert && (
        <Alert>
          <AlertDescription>{autoApprovalAlert}</AlertDescription>
        </Alert>
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <TabsList>
          <TabsTrigger id="tab-request" value="request">
            📝 申請フォーム
          </TabsTrigger>
          {isModerator && (
            <TabsTrigger id="tab-vote" value="vote">
              🗳️ 投票
              {pendingRequests.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger id="tab-history" value="history">
            📜 承認・否決履歴
          </TabsTrigger>
        </TabsList>

        <TabsContent value="request" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>新ジャンルを申請する</CardTitle>
              <p className="text-sm text-muted-foreground">
                認証済みのユーザーなら誰でもジャンル追加を申請できます。
                モデレータの投票で可決されれば自動的に追加されます。
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="genreId">ジャンルID（英語・小文字・ハイフン区切り）</Label>
                  <Input
                    id="genreId"
                    type="text"
                    placeholder="例: japanese-history"
                    value={formGenreId}
                    onChange={(e) => setFormGenreId(e.target.value.toLowerCase())}
                    pattern="[a-z][a-z0-9\-]*"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    小文字の英数字とハイフンのみ使用できます
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName">ジャンル名（日本語）</Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="例: 日本史"
                    value={formDisplayName}
                    onChange={(e) => setFormDisplayName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">説明</Label>
                  <Input
                    id="description"
                    type="text"
                    placeholder="例: 日本の歴史や文化に関するクイズ"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>アイコン画像（PNG / JPEG / GIF、最大2MB）</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateIconAi}
                      disabled={aiGenerating || submitLoading}
                    >
                      {aiGenerating ? (
                        <>
                          <Loader2 className="mr-1 size-3 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        '✨ AIで生成'
                      )}
                    </Button>
                  </div>
                  <div
                    className="cursor-pointer rounded-lg border border-dashed p-6 text-center transition-colors hover:bg-muted/50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {iconPreviewUrl ? (
                      <div className="flex flex-col items-center gap-2">
                        <img
                          src={iconPreviewUrl}
                          alt="アイコンプレビュー"
                          className="size-16 rounded-md object-cover"
                        />
                        <span className="text-sm text-muted-foreground">
                          {formIconFile ? formIconFile.name : '✨ AI生成画像'}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1 text-muted-foreground">
                        <span className="text-2xl">🖼️</span>
                        <p className="text-sm">クリックしてファイルを選択</p>
                        <p className="text-xs">PNG, JPEG, GIF（最大2MB）</p>
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
                  {iconError && <p className="text-sm text-destructive">{iconError}</p>}
                </div>

                <Button
                  type="submit"
                  id="submit-genre-btn"
                  disabled={submitLoading || !tempIconUrl || !!iconError}
                >
                  {submitLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> アップロード中...
                    </>
                  ) : (
                    '🚀 ジャンルを申請する'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {isModerator && (
          <TabsContent value="vote" className="mt-4">
            {pendingRequests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                  <span className="text-3xl">✨</span>
                  <p>現在、投票待ちのジャンル申請はありません。</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((req) => {
                  const approvalRate = calcApprovalRate(req);
                  return (
                    <Card key={req.id}>
                      <CardContent className="space-y-4 p-6">
                        <div className="flex gap-4">
                          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                            {req.iconImageUrl ? (
                              <img
                                src={req.iconImageUrl}
                                alt={req.displayName}
                                className="size-full object-cover"
                              />
                            ) : (
                              <span>🎭</span>
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold">{req.displayName}</h3>
                            <code className="text-xs text-muted-foreground">{req.genreId}</code>
                            <p className="text-xs text-muted-foreground">
                              申請日: {formatDate(req.createdAt)}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>賛成率</span>
                            <span className="font-medium">{approvalRate}%</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${approvalRate}%` }}
                            />
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>👍 {req.weightedVotesFor}</span>
                            <span>👎 {req.weightedVotesAgainst}</span>
                            <span>
                              合計: {req.weightedVotesFor + req.weightedVotesAgainst} / 可決条件:
                              重み5以上 & 80%以上
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {isSeniorModerator && (
                            <Badge variant="outline">⚡ 投票の重み: x2</Badge>
                          )}
                          <Button
                            id={`genre-vote-approve-${req.id}`}
                            variant="outline"
                            onClick={() => handleVote(req, 'approve')}
                            disabled={voteLoading !== null}
                          >
                            {voteLoading === req.id + 'approve' ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              '👍 賛成'
                            )}
                          </Button>
                          <Button
                            id={`genre-vote-reject-${req.id}`}
                            variant="destructive"
                            onClick={() => handleVote(req, 'reject')}
                            disabled={voteLoading !== null}
                          >
                            {voteLoading === req.id + 'reject' ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              '👎 反対'
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="history" className="mt-4">
          {fetchLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : historyRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                <span className="text-3xl">📜</span>
                <p>まだ完了したジャンル申請はありません。</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ジャンル</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>申請日</TableHead>
                      <TableHead>結果</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {req.iconImageUrl ? (
                              <img
                                src={req.iconImageUrl}
                                alt={req.displayName}
                                className="size-8 rounded object-cover"
                              />
                            ) : (
                              <span>🎭</span>
                            )}
                            {req.displayName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs">{req.genreId}</code>
                        </TableCell>
                        <TableCell>{formatDate(req.createdAt)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={req.status === 'approved' ? 'default' : 'destructive'}
                          >
                            {req.status === 'approved' ? '✅ 承認' : '❌ 否決'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
