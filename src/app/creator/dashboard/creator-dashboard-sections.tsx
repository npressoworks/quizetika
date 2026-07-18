'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreatorDashboardStats } from '@/types/dashboard';
import { TrendChart } from '@/components/charts/trend-chart';
import { cn } from '@/lib/utils';
import {
  PlayArrowOutlined as PlayIcon,
  StarOutlined as StarIcon,
  BookmarkBorderOutlined as BookmarkIcon,
  RateReviewOutlined as ReviewIcon,
  ShowChartOutlined as ChartIcon,
  CategoryOutlined as CategoryIcon,
  ArrowUpwardOutlined as ArrowUpIcon,
  ArrowDownwardOutlined as ArrowDownIcon,
} from '@mui/icons-material';

interface CreatorDashboardSectionsProps {
  stats: CreatorDashboardStats;
  onQuizSelect: (quizId: string) => void;
}

export function CreatorStatsGridSection({ stats }: { stats: CreatorDashboardStats }) {
  const isDataAccumulating = stats.kpi.lifecycleSampleSize === 0 || stats.kpi.completionRate === null;

  const items = [
    { icon: PlayIcon, label: '累計プレイ数', value: `${stats.kpi.plays} 回`, variant: 'primary' as const },
    { icon: StarIcon, label: 'ユニークプレイヤー', value: `${stats.kpi.uniquePlayers} 人`, variant: 'info' as const },
    { icon: BookmarkIcon, label: 'ブックマーク数', value: `${stats.kpi.bookmarksGained} 個`, variant: 'accent' as const },
    {
      icon: ReviewIcon,
      label: '平均評価',
      value: stats.kpi.averageRating !== null ? `${stats.kpi.averageRating.toFixed(1)} 点` : '---',
      subtext: `(獲得レビュー: ${stats.kpi.reviewsGained} 件)`,
      variant: 'warning' as const
    },
    {
      icon: ChartIcon,
      label: '完走率',
      value: isDataAccumulating ? 'データ蓄積中' : `${stats.kpi.completionRate}%`,
      badge: isDataAccumulating ? '蓄積中' : undefined,
      variant: 'success' as const
    },
  ];

  const statIconVariants = {
    primary: 'border-primary/20 bg-primary/10 text-primary',
    warning: 'border-amber-500/20 bg-amber-500/10 text-amber-500',
    info: 'border-sky-500/20 bg-sky-500/10 text-sky-500',
    accent: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-500',
    success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500',
  };

  return (
    <div
      className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5"
      data-testid="stats-section"
    >
      {items.map((item) => (
        <Card key={item.label} className="transition-colors hover:border-primary/50">
          <CardContent className="flex items-center gap-5 p-6">
            <div
              className={cn(
                'flex size-12 shrink-0 items-center justify-center rounded-full border',
                statIconVariants[item.variant]
              )}
            >
              <item.icon className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{item.value}</span>
                {item.badge && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {item.badge}
                  </Badge>
                )}
              </div>
              {item.subtext && <span className="text-[10px] text-muted-foreground">{item.subtext}</span>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function CreatorChartsSection({ stats }: { stats: CreatorDashboardStats }) {
  const trendSeries = [
    { dataKey: 'plays', label: 'プレイ数', color: 'var(--chart-1)', unit: '回' },
    { dataKey: 'bookmarks', label: 'ブックマーク数', color: 'var(--chart-2)', unit: '個' },
    { dataKey: 'reviews', label: 'レビュー数', color: 'var(--chart-3)', unit: '件' },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <ChartIcon className="size-5 text-primary" />
        <CardTitle className="text-base">アクティビティトレンド</CardTitle>
      </CardHeader>
      <CardContent>
        <TrendChart data={stats.trend} series={trendSeries} />
      </CardContent>
    </Card>
  );
}

type SortKey = 'title' | 'plays' | 'averageAccuracy' | 'bookmarks' | 'reviews';

export function CreatorQuizRankingSection({
  stats,
  onQuizSelect,
}: CreatorDashboardSectionsProps) {
  const [sortKey, setSortKey] = useState<SortKey>('plays');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const sortedQuizzes = useMemo(() => {
    const list = [...stats.quizRanking];
    list.sort((a, b) => {
      let valA: any = a[sortKey];
      let valB: any = b[sortKey];

      if (sortKey === 'averageAccuracy') {
        valA = a.averageAccuracy ?? -1;
        valB = b.averageAccuracy ?? -1;
      }

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
    return list;
  }, [stats.quizRanking, sortKey, sortOrder]);

  return (
    <Card data-testid="creator-quiz-ranking">
      <CardHeader>
        <CardTitle className="text-base">クイズ別パフォーマンスランキング</CardTitle>
      </CardHeader>
      <CardContent>
        {sortedQuizzes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">クイズデータがありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs uppercase">
                  <th onClick={() => handleSort('title')} className="pb-3 pt-2 font-medium cursor-pointer hover:bg-muted/50 select-none">
                    <div className="flex items-center gap-1">
                      クイズ名
                      {sortKey === 'title' && (sortOrder === 'asc' ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('plays')} className="pb-3 pt-2 font-medium cursor-pointer hover:bg-muted/50 select-none">
                    <div className="flex items-center gap-1">
                      プレイ数
                      {sortKey === 'plays' && (sortOrder === 'asc' ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('averageAccuracy')} className="pb-3 pt-2 font-medium cursor-pointer hover:bg-muted/50 select-none">
                    <div className="flex items-center gap-1">
                      平均正答率
                      {sortKey === 'averageAccuracy' && (sortOrder === 'asc' ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('bookmarks')} className="pb-3 pt-2 font-medium cursor-pointer hover:bg-muted/50 select-none">
                    <div className="flex items-center gap-1">
                      ブックマーク
                      {sortKey === 'bookmarks' && (sortOrder === 'asc' ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('reviews')} className="pb-3 pt-2 font-medium cursor-pointer hover:bg-muted/50 select-none">
                    <div className="flex items-center gap-1">
                      レビュー数
                      {sortKey === 'reviews' && (sortOrder === 'asc' ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedQuizzes.map((q) => (
                  <tr
                    key={q.quizId}
                    onClick={() => onQuizSelect(q.quizId)}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <td className="py-4 pr-3 font-medium truncate max-w-[200px]" title={q.title}>
                      {q.title}
                    </td>
                    <td className="py-4 pr-3">{q.plays} 回</td>
                    <td className="py-4 pr-3">{q.averageAccuracy !== null ? `${q.averageAccuracy}%` : '---'}</td>
                    <td className="py-4 pr-3">{q.bookmarks} 個</td>
                    <td className="py-4 pr-3">{q.reviews} 件</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CreatorFormatPerformanceSection({ stats }: { stats: CreatorDashboardStats }) {
  const formatLabels: Record<string, string> = {
    'multiple-choice': '選択式',
    'write-in': '短答式',
    'true-false': '〇✕問題',
    lateral: '水平思考',
  };

  return (
    <Card data-testid="creator-format-performance">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CategoryIcon className="size-5 text-primary" /> 出題形式別パフォーマンス
        </CardTitle>
      </CardHeader>
      <CardContent>
        {stats.formatBreakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">データがありません。</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {stats.formatBreakdown.map((f) => {
              const label = formatLabels[f.key] || f.key;
              return (
                <div key={f.key} className="p-4 rounded-lg border bg-muted/20 flex flex-col justify-between gap-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-xs">{label}</span>
                    <span className="text-[10px] text-muted-foreground">{f.plays}回</span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold text-primary">{f.accuracy}%</span>
                    <span className="text-[10px] text-muted-foreground">正答率</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
