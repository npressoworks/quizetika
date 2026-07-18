'use client';

import React, { useEffect, useState } from 'react';
import { getPlayerDrilldownHistory, getAttemptDetail } from '@/services/dashboard';
import { PlayerDashboardFilter, PlayHistoryEntry, QuestionAnswerDetail } from '@/types/dashboard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowBackOutlined as ArrowBackIcon,
  AccessTimeOutlined as TimeIcon,
} from '@mui/icons-material';

interface PlayerDrilldownProps {
  filters: PlayerDashboardFilter;
  onBack: () => void;
  genreLabelById: Map<string, string>;
}

export function PlayerDrilldown({ filters, onBack, genreLabelById }: PlayerDrilldownProps) {
  const [history, setHistory] = useState<PlayHistoryEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [detailSummary, setDetailSummary] = useState<PlayHistoryEntry | null>(null);
  const [detailList, setDetailList] = useState<QuestionAnswerDetail[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      setSelectedAttemptId(null);

      try {
        const page = await getPlayerDrilldownHistory(filters, undefined, 10);
        if (!active) return;
        setHistory(page.items);
        setNextCursor(page.nextCursor);
      } catch (err: any) {
        if (!active) return;
        setError(err.message || '履歴の取得に失敗しました');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [filters]);

  const loadMore = async () => {
    if (loadingMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await getPlayerDrilldownHistory(filters, nextCursor, 10);
      setHistory((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err: any) {
      setError(err.message || '追加の履歴取得に失敗しました');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSelectAttempt = async (attempt: PlayHistoryEntry) => {
    setSelectedAttemptId(attempt.id);
    setDetailSummary(attempt);
    setDetailList(null);
    setLoadingDetail(true);
    setDetailError(null);

    try {
      const detail = await getAttemptDetail(attempt.id);
      setDetailSummary(detail.summary);
      setDetailList(detail.details);
    } catch (err: any) {
      setDetailError(err.message || '詳細データの取得に失敗しました');
    } finally {
      setLoadingDetail(false);
    }
  };

  const modeLabels: Record<string, string> = {
    normal: '通常',
    exam: '試験',
    flashcard: '暗記カード',
    review: '復習',
    list: 'リストプレイ',
    'question-list': '問題リストプレイ',
    'my-quiz': 'カスタムクイズ',
    'test-play': 'テストプレイ',
  };

  return (
    <div className="space-y-6" data-testid="player-drilldown">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={selectedAttemptId ? () => setSelectedAttemptId(null) : onBack}>
          <ArrowBackIcon className="size-4 mr-2" />
          {selectedAttemptId ? '一覧へ戻る' : '概要へ戻る'}
        </Button>
        <h2 className="text-xl font-bold">
          {selectedAttemptId ? '試行詳細明細' : 'プレイ履歴一覧'}
        </h2>
      </div>

      {selectedAttemptId ? (
        <Card data-testid="attempt-detail-view">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{detailSummary?.quizTitle}</CardTitle>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                  <Badge variant="outline">{detailSummary ? (modeLabels[detailSummary.mode] || detailSummary.mode) : ''}</Badge>
                  <span>{detailSummary ? new Date(detailSummary.completedAt).toLocaleString('ja-JP') : ''}</span>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-primary">{detailSummary?.score}</span>
                <span className="text-muted-foreground text-sm">/ {detailSummary?.totalQuestions} 問正解</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingDetail ? (
              <div className="py-12 text-center text-muted-foreground animate-pulse">明細を読み込み中...</div>
            ) : detailError ? (
              <div className="p-4 rounded border border-destructive bg-destructive/10 text-center text-destructive">{detailError}</div>
            ) : detailList === null || detailList.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground" data-testid="no-detail-note">
                <p className="font-medium">この試行には設問ごとの詳細データがありません。</p>
                <p className="text-xs mt-1">旧バージョンでのプレイ履歴か、詳細が永続化されていないプレイです。</p>
              </div>
            ) : (
              <div className="space-y-6" data-testid="detail-question-list">
                {detailList.map((q, idx) => (
                  <div key={idx} className="p-4 rounded-lg border bg-muted/10 space-y-3">
                    <div className="flex items-start justify-between gap-4 border-b pb-2">
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-muted-foreground">第 {idx + 1} 問</span>
                        <p className="font-medium text-sm">{q.questionText}</p>
                      </div>
                      <Badge variant={q.isCorrect ? 'default' : 'destructive'} className="shrink-0">
                        {q.isCorrect ? '正解' : '不正解'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block mb-0.5">あなたの解答:</span>
                        <span className="font-semibold">{q.userAnswer || '未解答'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">正解:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{q.correctAnswer}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <TimeIcon className="size-3 text-muted-foreground" />
                        <span>解答時間: {q.elapsedSeconds || 0} 秒</span>
                      </div>
                      <div className="mt-2">
                        <span>ヒント使用: </span>
                        <span className="font-semibold">{q.usedHint ? 'あり' : 'なし'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            {loading && history.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground animate-pulse">履歴を読み込み中...</div>
            ) : error ? (
              <div className="p-4 rounded border border-destructive bg-destructive/10 text-center text-destructive">{error}</div>
            ) : history.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">プレイ履歴がありません。</div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs uppercase">
                        <th className="pb-3 pt-2 font-medium">クイズ</th>
                        <th className="pb-3 pt-2 font-medium">モード</th>
                        <th className="pb-3 pt-2 font-medium">正解数</th>
                        <th className="pb-3 pt-2 font-medium">解答時間</th>
                        <th className="pb-3 pt-2 font-medium">日時</th>
                        <th className="pb-3 pt-2 font-medium text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {history.map((h) => (
                        <tr key={h.id} className="hover:bg-muted/50 transition-colors">
                          <td className="py-4 pr-3 font-medium truncate max-w-[200px]" title={h.quizTitle}>
                            {h.quizTitle}
                          </td>
                          <td className="py-4 pr-3">
                            <Badge variant="outline" className="text-xs">
                              {modeLabels[h.mode] || h.mode}
                            </Badge>
                          </td>
                          <td className="py-4 pr-3">
                            {h.score} / {h.totalQuestions}
                          </td>
                          <td className="py-4 pr-3">
                            {h.elapsedSeconds}秒
                          </td>
                          <td className="py-4 text-muted-foreground text-xs">
                            {new Date(h.completedAt).toLocaleString('ja-JP')}
                          </td>
                          <td className="py-4 text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleSelectAttempt(h)} data-testid={`view-detail-btn-${h.id}`}>
                              詳細
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {nextCursor && (
                  <div className="flex justify-center pt-4">
                    <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore} data-testid="load-more-btn">
                      {loadingMore ? '読み込み中...' : 'もっと見る'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
