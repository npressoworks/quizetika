'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useActiveGenres } from '@/hooks/useActiveGenres';
import { getPlayerDashboardStats, getPlayerDrilldownHistory } from '@/services/dashboard';
import { PlayerDashboardStats, PlayHistoryPage } from '@/types/dashboard';
import { StatsSkeleton } from '@/components/charts/stats-skeleton';
import { ChartsSkeleton } from '@/components/charts/charts-skeleton';
import { Button } from '@/components/ui/button';
import { useDashboardFilters } from './use-dashboard-filters';
import { DashboardFilterBar } from './dashboard-filter-bar';
import {
  PlayerStatsGridSection,
  PlayerChartsSection,
  PlayerWordCloudSection,
  PlayerGenreTagAnalysisSection,
  PlayerRecentPlayHistorySection,
  PlayerFormatAnalysisSection,
} from './dashboard-sections';
import { PlayerDrilldown } from './player-drilldown';

export function PlayerDashboardClient() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { genreLabelById, loading: genresLoading } = useActiveGenres();

  const { filters, setFilters, reset } = useDashboardFilters('30d');

  const [stats, setStats] = useState<PlayerDashboardStats | null>(null);
  const [historyPage, setHistoryPage] = useState<PlayHistoryPage | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewState, setViewState] = useState<'summary' | 'drilldown'>('summary');

  const requestIdRef = useRef(0);

  const loadData = useCallback(async (currentFilters: any) => {
    if (!user) return;
    
    const reqId = ++requestIdRef.current;
    setLoadingData(true);
    setError(null);

    try {
      const [statsData, historyData] = await Promise.all([
        getPlayerDashboardStats(currentFilters),
        getPlayerDrilldownHistory(currentFilters, undefined, 5),
      ]);

      if (reqId !== requestIdRef.current) return;

      setStats(statsData);
      setHistoryPage(historyData);
    } catch (err: any) {
      if (reqId !== requestIdRef.current) return;
      console.error('[PlayerDashboardClient] データ取得失敗:', err);
      setError(err.message || 'データの取得に失敗しました');
    } finally {
      if (reqId === requestIdRef.current) {
        setLoadingData(false);
      }
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login?redirect=/creator/dashboard');
      return;
    }

    loadData(filters);
  }, [user, authLoading, filters, loadData, router]);

  const handleFiltersChange = (newFilters: any) => {
    setFilters(newFilters);
    setViewState('summary');
  };

  const handleResetFilters = () => {
    reset();
    setViewState('summary');
  };

  const handleRetry = () => {
    loadData(filters);
  };

  const isSkeleton = authLoading || genresLoading || (loadingData && !stats);

  if (isSkeleton) {
    return (
      <div className="space-y-6" data-testid="player-skeleton">
        <StatsSkeleton />
        <ChartsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="player-error" className="p-6 rounded-xl border border-destructive bg-destructive/10 text-center">
        <p className="text-destructive font-medium mb-4">{error}</p>
        <Button onClick={handleRetry}>再試行</Button>
      </div>
    );
  }

  if (!stats || !historyPage) {
    return null;
  }

  if (stats.kpi.totalPlays === 0) {
    return (
      <div className="space-y-6">
        <DashboardFilterBar
          filters={filters}
          onChange={handleFiltersChange}
          onReset={handleResetFilters}
          type="player"
        />
        <div data-testid="player-empty" className="p-12 rounded-xl border border-dashed text-center">
          <p className="text-muted-foreground">対象期間のプレイデータがありません。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardFilterBar
        filters={filters}
        onChange={handleFiltersChange}
        onReset={handleResetFilters}
        type="player"
      />

      {loadingData && (
        <div className="text-xs text-muted-foreground animate-pulse mb-2">
          最新データを読み込み中...
        </div>
      )}

      {viewState === 'summary' ? (
        <div className="space-y-10">
          <PlayerStatsGridSection stats={stats} />
          <PlayerChartsSection stats={stats} />
          <PlayerFormatAnalysisSection stats={stats} />
          <PlayerWordCloudSection stats={stats} />
          <PlayerGenreTagAnalysisSection stats={stats} genreLabelById={genreLabelById} />
          <div className="flex flex-col gap-4">
            <PlayerRecentPlayHistorySection
              history={historyPage.items}
              genreLabelById={genreLabelById}
            />
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewState('drilldown')}
                data-testid="show-drilldown-btn"
              >
                詳細なプレイ履歴を表示
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <PlayerDrilldown
          filters={filters}
          onBack={() => setViewState('summary')}
          genreLabelById={genreLabelById}
        />
      )}
    </div>
  );
}
