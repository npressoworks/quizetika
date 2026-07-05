/**
 * タグ/ジャンルマージリクエスト画面
 */
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/auth-context';
import { createMergeRequest, voteMergeRequest } from '@/services/tagMerge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CircularProgress } from '@mui/material';

interface MergeRequest {
  id: string;
  targetType: 'tag' | 'genre';
  sourceId: string;
  targetId: string;
  requesterId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  votesForCount: number;
  votesAgainstCount: number;
  weightedVotesFor: number;
  weightedVotesAgainst: number;
  createdAt: Date;
}

/** `merge_requests` の投票状況をポーリングで再取得する間隔（ミリ秒） */
const MERGE_REQUESTS_POLL_INTERVAL_MS = 15000;

function mapMergeRequestRow(row: {
  id: string;
  target_type: string;
  source_id: string;
  target_id: string;
  requester_id: string | null;
  reason: string;
  status: string;
  votes_for_count: number;
  votes_against_count: number;
  weighted_votes_for: number;
  weighted_votes_against: number;
  created_at: string;
}): MergeRequest {
  return {
    id: row.id,
    targetType: row.target_type as MergeRequest['targetType'],
    sourceId: row.source_id,
    targetId: row.target_id,
    requesterId: row.requester_id ?? '',
    reason: row.reason,
    status: row.status as MergeRequest['status'],
    votesForCount: row.votes_for_count,
    votesAgainstCount: row.votes_against_count,
    weightedVotesFor: row.weighted_votes_for,
    weightedVotesAgainst: row.weighted_votes_against,
    createdAt: new Date(row.created_at),
  };
}

const supabase = createClient();

type TabType = 'propose' | 'votes';

export default function CommunityMergePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('votes');
  const [mergeRequests, setMergeRequests] = useState<MergeRequest[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [voteLoading, setVoteLoading] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formSourceId, setFormSourceId] = useState('');
  const [formTargetId, setFormTargetId] = useState('');
  const [formType, setFormType] = useState<'tag' | 'genre'>('tag');
  const [formReasoning, setFormReasoning] = useState('');

  const TIER_RANK: Record<string, number> = {
    newcomer: 0,
    contributor: 1,
    moderator: 2,
    senior_moderator: 3,
  };

  const isAuthorized =
    !!user && (TIER_RANK[user.moderationTier] ?? 0) >= TIER_RANK.moderator;

  const isSeniorModerator = user?.moderationTier === 'senior_moderator';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/community/merge');
      return;
    }
    if (!loading && user && !isAuthorized) {
      router.push('/not-found');
    }
  }, [user, loading, isAuthorized, router]);

  useEffect(() => {
    if (!isAuthorized) return;

    let cancelled = false;
    const fetchMergeRequests = async () => {
      const { data, error } = await supabase
        .from('merge_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error('マージリクエスト取得エラー:', error);
        setErrorMessage('マージリクエストの読み込みに失敗しました。');
      } else {
        setMergeRequests((data ?? []).map(mapMergeRequestRow));
      }
      setFetchLoading(false);
    };

    void fetchMergeRequests();
    const intervalId = setInterval(fetchMergeRequests, MERGE_REQUESTS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isAuthorized]);

  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formSourceId.trim() || !formTargetId.trim()) return;

    setSubmitLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await createMergeRequest(
        formSourceId.trim(),
        formTargetId.trim(),
        formType,
        formReasoning,
        user.id,
      );
      setSuccessMessage(
        `「${formSourceId}」→「${formTargetId}」のマージ提案を起案しました。`,
      );
      setFormSourceId('');
      setFormTargetId('');
      setFormReasoning('');
      setActiveTab('votes');
    } catch (err) {
      console.error('起案失敗:', err);
      setErrorMessage('マージ提案の送信に失敗しました。');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleVote = async (mergeRequestId: string, vote: 'approve' | 'reject') => {
    if (!user) return;

    setVoteLoading(mergeRequestId + vote);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await voteMergeRequest(mergeRequestId, user.id, vote);
      setSuccessMessage(
        vote === 'approve' ? '👍 賛成票を投じました。' : '👎 反対票を投じました。',
      );
    } catch (err) {
      console.error('投票失敗:', err);
      setErrorMessage('投票に失敗しました。');
    } finally {
      setVoteLoading(null);
    }
  };

  const openSourceList = (sourceId: string, type: 'tag' | 'genre') => {
    const path = type === 'tag' ? `/tags/${sourceId}` : `/genres/${sourceId}`;
    window.open(path, '_blank');
  };

  const calcApprovalRate = (req: MergeRequest): number => {
    const totalWeighted = req.weightedVotesFor + req.weightedVotesAgainst;
    if (totalWeighted === 0) return 0;
    return Math.round((req.weightedVotesFor / totalWeighted) * 100);
  };

  const formatDate = (date: Date) => date.toLocaleDateString('ja-JP');

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <CircularProgress size={32} />
        <p>読み込んでいます...</p>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <header className="space-y-2">
        <Badge variant="secondary">🔀 モデレータ専用</Badge>
        <h1 className="text-2xl font-bold">タグ / ジャンル マージリクエスト</h1>
        <p className="text-sm text-muted-foreground">
          表記揺れのタグやジャンルを統合するマージ提案を起案・投票できます。
        </p>
        {isSeniorModerator && (
          <Badge variant="outline">⚡ シニアモデレータ — 投票の重み: x2</Badge>
        )}
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <TabsList>
          <TabsTrigger id="tab-votes" value="votes">
            📋 投票一覧
            {mergeRequests.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {mergeRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger id="tab-propose" value="propose">
            ✏️ 提案起案
          </TabsTrigger>
        </TabsList>

        <TabsContent value="votes" className="mt-4">
          {fetchLoading ? (
            <div className="flex justify-center py-12">
              <CircularProgress size={32} className="text-muted-foreground" />
            </div>
          ) : mergeRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                <span className="text-3xl">🌿</span>
                <p>現在、保留中のマージ提案はありません。</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {mergeRequests.map((req) => {
                const approvalRate = calcApprovalRate(req);
                return (
                  <Card key={req.id}>
                    <CardContent className="space-y-4 p-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant="outline">
                          {req.targetType === 'tag' ? '🏷️ タグ' : '🎭 ジャンル'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(req.createdAt)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <button
                          type="button"
                          className="font-medium text-primary hover:underline"
                          onClick={() => openSourceList(req.sourceId, req.targetType)}
                          title="クリックして一覧を別ウィンドウで開く"
                        >
                          {req.sourceId} ↗
                        </button>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{req.targetId}</span>
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
                            合計重み: {req.weightedVotesFor + req.weightedVotesAgainst}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {isSeniorModerator && (
                          <Badge variant="outline">⚡ 投票の重み: x2</Badge>
                        )}
                        <Button
                          id={`vote-approve-${req.id}`}
                          variant="outline"
                          onClick={() => handleVote(req.id, 'approve')}
                          disabled={voteLoading !== null}
                        >
                          {voteLoading === req.id + 'approve' ? (
                            <CircularProgress size={16} />
                          ) : (
                            '👍 賛成'
                          )}
                        </Button>
                        <Button
                          id={`vote-reject-${req.id}`}
                          variant="destructive"
                          onClick={() => handleVote(req.id, 'reject')}
                          disabled={voteLoading !== null}
                        >
                          {voteLoading === req.id + 'reject' ? (
                            <CircularProgress size={16} />
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

        <TabsContent value="propose" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>マージ提案を起案する</CardTitle>
              <p className="text-sm text-muted-foreground">
                統合を提案するソースと統合先ターゲットを入力し、理由を記載してください。
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePropose} className="space-y-4">
                <div className="space-y-2">
                  <Label>対象タイプ</Label>
                  <div className="flex gap-4">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="type"
                        value="tag"
                        checked={formType === 'tag'}
                        onChange={() => setFormType('tag')}
                      />
                      🏷️ タグ
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="type"
                        value="genre"
                        checked={formType === 'genre'}
                        onChange={() => setFormType('genre')}
                      />
                      🎭 ジャンル
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sourceId">ソース（統合される側）</Label>
                  <Input
                    id="sourceId"
                    type="text"
                    placeholder="例: javascipt（表記揺れ）"
                    value={formSourceId}
                    onChange={(e) => setFormSourceId(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetId">ターゲット（統合先の正規名）</Label>
                  <Input
                    id="targetId"
                    type="text"
                    placeholder="例: javascript（正規）"
                    value={formTargetId}
                    onChange={(e) => setFormTargetId(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reasoning">統合の理由</Label>
                  <Textarea
                    id="reasoning"
                    placeholder="なぜこのマージが必要か、根拠を説明してください。"
                    value={formReasoning}
                    onChange={(e) => setFormReasoning(e.target.value)}
                    rows={4}
                  />
                </div>

                <Button type="submit" id="submit-propose-btn" disabled={submitLoading}>
                  {submitLoading ? (
                    <>
                      <CircularProgress size={16} /> 送信中...
                    </>
                  ) : (
                    '🚀 マージ提案を起案する'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
