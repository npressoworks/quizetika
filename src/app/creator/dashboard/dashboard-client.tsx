'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { getReportsForCreator, resolveReport } from '@/services/review';
import { getCreatorDashboardStats } from '@/services/dashboard';
import { Quiz, FeedbackReport } from '@/types';
import { CreatorDashboardStats } from '@/types/dashboard';
import { FeedbackSection } from './dashboard-sections';
import { StatsSkeleton } from '@/components/charts/stats-skeleton';
import { ChartsSkeleton } from '@/components/charts/charts-skeleton';
import { FeedbackSkeleton } from '@/components/quiz/feedback-skeleton';
import { Tabs, UnderlineTabsList, UnderlineTabsTrigger, TabsContent } from '@/components/ui/underline-tabs';
import { PlayerDashboardClient } from './player-dashboard-client';
import { useDashboardFilters } from './use-dashboard-filters';
import { DashboardFilterBar } from './dashboard-filter-bar';
import { Button } from '@/components/ui/button';
import {
  CreatorStatsGridSection,
  CreatorChartsSection,
  CreatorQuizRankingSection,
  CreatorFormatPerformanceSection,
} from './creator-dashboard-sections';
import { CreatorQuizAnalysis } from './creator-quiz-analysis';

export function CreatorDashboardClient() {
  return (
    <Tabs defaultValue="player" className="w-full">
      <UnderlineTabsList className="mb-8 w-full">
        <UnderlineTabsTrigger value="player" data-testid="dashboard-tab-player" className="flex-1 justify-center">
          プレイヤー
        </UnderlineTabsTrigger>
        <UnderlineTabsTrigger value="creator" data-testid="dashboard-tab-creator" className="flex-1 justify-center">
          クリエイター
        </UnderlineTabsTrigger>
      </UnderlineTabsList>
      <TabsContent value="player" className="space-y-10 focus-visible:outline-none">
        <PlayerDashboardClient />
      </TabsContent>
      <TabsContent value="creator" className="space-y-10 focus-visible:outline-none">
        <CreatorDashboardClientInner />
      </TabsContent>
    </Tabs>
  );
}

function CreatorDashboardClientInner() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const { filters, setFilters, reset } = useDashboardFilters('30d');

  const [stats, setStats] = useState<CreatorDashboardStats | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackReport[] | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewState, setViewState] = useState<'summary' | 'analysis'>('summary');
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const loadData = useCallback(async (currentFilters: any) => {
    if (!user) return;
    const reqId = ++requestIdRef.current;
    setLoadingData(true);
    setError(null);

    try {
      const [statsData, fbData] = await Promise.all([
        getCreatorDashboardStats(currentFilters),
        getReportsForCreator(user.id),
      ]);

      if (reqId !== requestIdRef.current) return;

      setStats(statsData);
      setFeedbacks(fbData);
    } catch (err: any) {
      if (reqId !== requestIdRef.current) return;
      console.error('[CreatorDashboardClientInner] データ取得失敗:', err);
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

  const handleResolveFeedback = async (reportId: string) => {
    await resolveReport(reportId);
    setFeedbacks((prev) => (prev ? prev.filter((fb) => fb.id !== reportId) : null));
  };

  const handleRetry = () => {
    loadData(filters);
  };

  const isSkeleton = authLoading || (loadingData && !stats);

  if (isSkeleton) {
    return (
      <div className="space-y-6" data-testid="creator-skeleton">
        <StatsSkeleton />
        <ChartsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="creator-error" className="p-6 rounded-xl border border-destructive bg-destructive/10 text-center">
        <p className="text-destructive font-medium mb-4">{error}</p>
        <Button onClick={handleRetry}>再試行</Button>
      </div>
    );
  }

  if (!stats || feedbacks === null) {
    return null;
  }

  if (stats.quizzes.length === 0) {
    return (
      <div className="space-y-6">
        <DashboardFilterBar
          filters={filters}
          onChange={setFilters}
          onReset={reset}
          type="creator"
        />
        <div data-testid="creator-empty" className="p-12 rounded-xl border border-dashed text-center">
          <p className="text-muted-foreground">作成したクイズがありません。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardFilterBar
        filters={filters}
        onChange={setFilters}
        onReset={reset}
        type="creator"
      />

      {loadingData && (
        <div className="text-xs text-muted-foreground animate-pulse mb-2">
          最新データを読み込み中...
        </div>
      )}

      {viewState === 'summary' ? (
        <div className="space-y-10">
          <CreatorStatsGridSection stats={stats} />
          <CreatorChartsSection stats={stats} />
          <CreatorFormatPerformanceSection stats={stats} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CreatorQuizRankingSection
              stats={stats}
              onQuizSelect={(quizId) => {
                setSelectedQuizId(quizId);
                setViewState('analysis');
              }}
            />
            <FeedbackSection
              feedbacks={feedbacks}
              quizzes={[]}
              onResolve={handleResolveFeedback}
            />
          </div>
        </div>
      ) : (
        <CreatorQuizAnalysis
          quizId={selectedQuizId!}
          period={filters.period}
          onBack={() => setViewState('summary')}
        />
      )}
    </div>
  );
}
