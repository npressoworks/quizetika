'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { HistoryOutlined, RefreshOutlined } from '@mui/icons-material';
import {
  fetchPlayHistoryPage,
  getAttemptModeLabel,
  PlayHistoryApiError,
} from '@/lib/play-history-client';
import type { PlayHistoryEntry } from '@/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export interface ProfilePlayHistoryPanelProps {
  isActive: boolean;
}

export function ProfilePlayHistoryPanel({ isActive }: ProfilePlayHistoryPanelProps) {
  const [items, setItems] = useState<PlayHistoryEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const initialFetched = useRef(false);

  const loadPage = useCallback(async (cursor?: string | null, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
      setErrorStatus(null);
    }

    try {
      const page = await fetchPlayHistoryPage({ cursor: cursor ?? undefined });
      setItems((prev) => (append ? [...prev, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
    } catch (e) {
      const message =
        e instanceof PlayHistoryApiError
          ? e.message
          : 'プレイ履歴の取得に失敗しました';
      const status = e instanceof PlayHistoryApiError ? e.status : 500;
      setError(message);
      setErrorStatus(status);
      if (!append) {
        setItems([]);
        setNextCursor(null);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive || initialFetched.current) return;
    initialFetched.current = true;
    void loadPage();
  }, [isActive, loadPage]);

  const handleLoadMore = () => {
    if (!nextCursor || loadingMore) return;
    void loadPage(nextCursor, true);
  };

  const handleRetry = () => {
    initialFetched.current = true;
    void loadPage();
  };

  if (!isActive) {
    return null;
  }

  return (
    <div data-testid="play-history-section">
      {loading && items.length === 0 && (
        <div className="flex items-center py-8 text-muted-foreground">
          <HistoryOutlined sx={{ fontSize: 20 }} className="mr-2" />
          プレイ履歴を読み込み中...
        </div>
      )}

      {error && items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p>{error}</p>
            {errorStatus === 401 ? (
              <Link href="/login" className={cn(buttonVariants())}>
                ログインする
              </Link>
            ) : (
              <Button type="button" variant="secondary" onClick={handleRetry}>
                <RefreshOutlined sx={{ fontSize: 16 }} />
                再試行
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">まだプレイ履歴がありません</div>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((entry) => (
            <li key={entry.attemptId}>
              <Card data-testid="play-history-entry">
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/quiz/${entry.quizId}`} className="font-semibold text-primary hover:underline">
                      {entry.quizTitle}
                    </Link>
                    <span className="text-sm font-medium">
                      {entry.score} / {entry.totalQuestions} 正解
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <Badge variant="secondary">{getAttemptModeLabel(entry.mode)}</Badge>
                    <span>{entry.elapsedSeconds} 秒</span>
                    <span>
                      {entry.completedAt.toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <Link
                      href={`/quiz/${entry.quizId}`}
                      className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
                    >
                      もう一度プレイ
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {nextCursor && !error && (
        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            variant="secondary"
            data-testid="play-history-load-more"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? '読み込み中...' : 'もっと見る'}
          </Button>
        </div>
      )}
    </div>
  );
}
