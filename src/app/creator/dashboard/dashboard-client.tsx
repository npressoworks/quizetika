'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { getQuizzesByAuthor } from '@/services/quiz';
import { getReportsForCreator, resolveReport } from '@/services/review';
import { Quiz, FeedbackReport } from '@/types';
import { computeDashboardStats, type DashboardStats } from '@/lib/dashboard-stats';
import {
  StatsGridSection,
  ChartsSection,
  QuizListSection,
  FeedbackSection,
} from './dashboard-sections';
import { StatsSkeleton } from '@/components/charts/stats-skeleton';
import { ChartsSkeleton } from '@/components/charts/charts-skeleton';
import { QuizListSkeleton } from '@/components/quiz/quiz-list-skeleton';
import { FeedbackSkeleton } from '@/components/quiz/feedback-skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlayerDashboardClient } from './player-dashboard-client';

export function CreatorDashboardClient() {
  return (
    <Tabs defaultValue="player" className="w-full">
      <TabsList className="mb-8 w-full max-w-[400px]">
        <TabsTrigger value="player" data-testid="dashboard-tab-player" className="flex-1 py-2">
          プレイヤー
        </TabsTrigger>
        <TabsTrigger value="creator" data-testid="dashboard-tab-creator" className="flex-1 py-2">
          作家
        </TabsTrigger>
      </TabsList>
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

  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackReport[] | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login?redirect=/creator/dashboard');
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const userQuizzes = await getQuizzesByAuthor(user.id, true);
        if (cancelled) return;

        setQuizzes(userQuizzes);
        setStats(computeDashboardStats(userQuizzes));

        let fbList = await getReportsForCreator(user.id);
        if (fbList.length === 0 && userQuizzes.length > 0) {
          fbList.push({
            id: 'mock_fb_1',
            quizId: userQuizzes[0].id,
            quizTitle: userQuizzes[0].title,
            questionId: userQuizzes[0].questions[0]?.id || 'q1',
            questionText: userQuizzes[0].questions[0]?.questionText || '第一問の問題文',
            reporterId: 'user_player',
            creatorId: user.id,
            category: 'typo',
            content: '問題文の「コンポーネント」が「コンポーネト」と誤字になっています。',
            status: 'open',
            createdAt: new Date(),
          });
        }
        if (!cancelled) {
          setFeedbacks(fbList);
        }
      } catch (err) {
        console.error('[CreatorDashboardClientInner] データ取得失敗:', err);
        if (!cancelled) {
          setQuizzes([]);
          setStats(computeDashboardStats([]));
          setFeedbacks([]);
        }
      } finally {
        if (!cancelled) {
          setChartsReady(true);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router]);

  const handleResolveFeedback = async (reportId: string) => {
    await resolveReport(reportId);
    setFeedbacks((prev) => (prev ? prev.filter((fb) => fb.id !== reportId) : null));
  };

  const dataLoading = authLoading || quizzes === null || stats === null;

  return (
    <>
      {dataLoading ? (
        <StatsSkeleton data-testid="stats-skeleton" />
      ) : (
        <StatsGridSection stats={stats!} />
      )}

      {!chartsReady ? (
        <ChartsSkeleton data-testid="charts-skeleton" />
      ) : (
        <ChartsSection />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {quizzes === null ? (
          <QuizListSkeleton data-testid="quiz-list-skeleton" />
        ) : (
          <QuizListSection quizzes={quizzes} />
        )}

        {feedbacks === null ? (
          <FeedbackSkeleton data-testid="feedback-list-skeleton" />
        ) : (
          <FeedbackSection feedbacks={feedbacks} quizzes={quizzes ?? []} onResolve={handleResolveFeedback} />
        )}
      </div>
    </>
  );
}
