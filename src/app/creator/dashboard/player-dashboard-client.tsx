'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { listUserPlayHistory } from '@/services/attempt';
import { getQuiz } from '@/services/quiz';
import { computePlayerStats, type PlayerStats } from '@/lib/player-stats';
import { useActiveGenres } from '@/hooks/useActiveGenres';
import { PlayHistoryEntry } from '@/types';
import { StatsSkeleton } from '@/components/charts/stats-skeleton';
import { ChartsSkeleton } from '@/components/charts/charts-skeleton';
import {
  PlayerStatsGridSection,
  PlayerChartsSection,
  PlayerWordCloudSection,
  PlayerGenreTagAnalysisSection,
  PlayerRecentPlayHistorySection,
} from './dashboard-sections';

export function PlayerDashboardClient() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { genres, loading: genresLoading, genreLabelById } = useActiveGenres();

  const [history, setHistory] = useState<PlayHistoryEntry[] | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login?redirect=/creator/dashboard');
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoadingData(true);
        // 直近最大 100 件の完了済みプレイ履歴を取得
        const page = await listUserPlayHistory({ uid: user.id, limit: 100 });
        if (cancelled) return;

        const items = page.items || [];
        setHistory(items);

        // ユニークなクイズIDを抽出してクイズメタデータをバッチロード
        const quizIds = [...new Set(items.map((entry) => entry.quizId).filter(Boolean))];
        const quizMap = new Map<string, { genre: string; tags: string[]; title: string }>();

        if (quizIds.length > 0) {
          const quizzes = await Promise.all(quizIds.map((id) => getQuiz(id)));
          if (cancelled) return;

          quizzes.forEach((quiz, idx) => {
            if (quiz) {
              quizMap.set(quizIds[idx], {
                genre: quiz.genre || '',
                tags: quiz.tags || [],
                title: quiz.title || '',
              });
            }
          });
        }

        // 統計情報の集計
        const computed = computePlayerStats(items, quizMap);
        if (!cancelled) {
          setStats(computed);
        }
      } catch (err) {
        console.error('[PlayerDashboardClient] データ取得失敗:', err);
        if (!cancelled) {
          setHistory([]);
          setStats(computePlayerStats([], new Map()));
        }
      } finally {
        if (!cancelled) {
          setLoadingData(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router]);

  const isLoading = authLoading || genresLoading || loadingData || !stats || !history;

  if (isLoading) {
    return (
      <div className="space-y-10" data-testid="player-skeleton">
        <StatsSkeleton />
        <ChartsSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* 基本統計グリッド */}
      <PlayerStatsGridSection stats={stats} />

      {/* プレイトレンド & モード割合グラフ */}
      <PlayerChartsSection stats={stats} />

      {/* プレイ傾向ワードクラウド (タグ / タイトルキーワード) */}
      <PlayerWordCloudSection stats={stats} />

      {/* ジャンル・タグの頻度・正答率分析 */}
      <PlayerGenreTagAnalysisSection stats={stats} genreLabelById={genreLabelById} />

      {/* 最近のプレイ履歴 (直近5件) */}
      <PlayerRecentPlayHistorySection history={history.slice(0, 5)} genreLabelById={genreLabelById} />
    </div>
  );
}
