'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnalyticsChart } from '@/components/charts/analytics-chart';
import { SelectionPie } from '@/components/charts/selection-pie';
import { Quiz, FeedbackReport, PlayHistoryEntry } from '@/types';
import { formatReviewScorePercent } from '@/services/review-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  PlayArrowOutlined as PlayIcon,
  BookmarkBorderOutlined as BookmarkIcon,
  StarOutlined as StarIcon,
  ThumbUpOutlined as ThumbsUpIcon,
  DescriptionOutlined as FileTextIcon,
  EditOutlined as EditIcon,
  ErrorOutlineOutlined as AlertCircleIcon,
  TrendingUpOutlined as TrendingUpIcon,
  ChevronRight as ChevronRightIcon,
  InboxOutlined as InboxIcon,
  HistoryOutlined as HistoryIcon,
  AccessTimeOutlined as TimeIcon,
  CategoryOutlined as CategoryIcon,
  LocalOfferOutlined as TagIcon,
} from '@mui/icons-material';
import type { PlayerStats } from '@/lib/player-stats';

const playsTrendData = [
  { label: '5/23', value: 12 },
  { label: '5/24', value: 19 },
  { label: '5/25', value: 15 },
  { label: '5/26', value: 28 },
  { label: '5/27', value: 34 },
  { label: '5/28', value: 45 },
  { label: '5/29', value: 50 },
];

const ratingTrendData = [
  { label: '5/23', value: 80 },
  { label: '5/24', value: 85 },
  { label: '5/25', value: 83 },
  { label: '5/26', value: 90 },
  { label: '5/27', value: 92 },
  { label: '5/28', value: 95 },
  { label: '5/29', value: 96 },
];

import type { DashboardStats } from '@/lib/dashboard-stats';

const statIconVariants = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  accent: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  warning: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
  info: 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400',
} as const;

export function StatsGridSection({ stats }: { stats: DashboardStats }) {
  const items = [
    { icon: PlayIcon, label: '累計プレイ数', value: `${stats.totalPlays} 回`, variant: 'primary' as const },
    { icon: BookmarkIcon, label: 'ブックマーク数', value: `${stats.totalBookmarks} 個`, variant: 'accent' as const },
    {
      icon: StarIcon,
      label: '平均良問評価率',
      value: stats.averageRating > 0 ? `${stats.averageRating}%` : '-',
      variant: 'warning' as const,
    },
    { icon: FileTextIcon, label: '作成クイズ総数', value: `${stats.quizCount} 個`, variant: 'info' as const },
  ];

  return (
    <div
      className="mb-10 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5"
      data-testid="stats-section"
    >
      {items.map(({ icon: Icon, label, value, variant }) => (
        <Card key={label} className="transition-colors hover:border-primary/50">
          <CardContent className="flex items-center gap-5 p-6">
            <div
              className={cn(
                'flex size-12 shrink-0 items-center justify-center rounded-full border',
                statIconVariants[variant],
              )}
            >
              <Icon className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-xl font-bold">{value}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ChartsSection() {
  return (
    <div
      className="mb-10 grid grid-cols-1 gap-5 md:grid-cols-2"
      data-testid="analytics-section"
    >
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <TrendingUpIcon className="size-5 text-primary" />
          <CardTitle className="text-base">アクセス・プレイトレンド</CardTitle>
        </CardHeader>
        <CardContent>
          <AnalyticsChart data={playsTrendData} title="日別プレイ数" color="primary" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <StarIcon className="size-5 text-chart-2" />
          <CardTitle className="text-base">良問評価率の推移</CardTitle>
        </CardHeader>
        <CardContent>
          <AnalyticsChart data={ratingTrendData} title="日別好評価率" color="accent" unit="%" />
        </CardContent>
      </Card>
    </div>
  );
}

export function QuizListSection({ quizzes }: { quizzes: Quiz[] }) {
  const router = useRouter();
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(quizzes[0] ?? null);

  return (
    <>
      <Card data-testid="creator-quiz-list" className="lg:col-span-1">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <FileTextIcon className="size-5" />
          <CardTitle className="text-base">作成したクイズ一覧 ({quizzes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {quizzes.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
              <InboxIcon className="size-12 opacity-40" />
              <p>作成したクイズがまだありません。</p>
            </div>
          ) : (
            <div className="divide-y">
              {quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-3 py-4 transition-colors first:pt-0 last:pb-0',
                    selectedQuiz?.id === quiz.id && 'bg-muted/50 -mx-2 rounded-md px-2',
                  )}
                  onClick={() => setSelectedQuiz(quiz)}
                  data-testid="quiz-card"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="block truncate font-medium">{quiz.title}</span>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant={quiz.status === 'published' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {quiz.status === 'published' ? '公開中' : '下書き'}
                      </Badge>
                      <span>プレイ: {quiz.playCount || 0}回</span>
                      <span
                        className="inline-flex items-center gap-1"
                        data-testid="creator-quiz-review-score"
                      >
                        <ThumbsUpIcon className="size-3.5" aria-hidden />
                        {formatReviewScorePercent(quiz.reviewScore) ?? '-'}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/quiz/${quiz.id}/edit`);
                      }}
                    >
                      <EditIcon className="size-3.5" />
                      編集
                    </Button>
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedQuiz && (
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle className="text-lg">
              クイズ個別アナリティクス: {selectedQuiz.title}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              各問題に対するプレイヤーの解答選択肢割合を分析して、問題の難易度や回答傾向を把握しましょう。
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {selectedQuiz.questions.map((q, idx) => {
                let pieData: { label: string; count: number }[] = [];
                if (q.type === 'multiple-choice' && q.choices) {
                  pieData = q.choices.map((choice, choiceIdx) => ({
                    label: choice.choiceText,
                    count: choice.selectedCount || choiceIdx + 5,
                  }));
                } else {
                  const corrects = q.correctCount ?? 10 + idx;
                  const incorrects = q.incorrectCount ?? 5 + idx;
                  pieData = [
                    { label: '正解', count: corrects },
                    { label: '不正解', count: incorrects },
                  ];
                }
                return (
                  <div key={q.id || idx} className="rounded-lg border p-4">
                    <h4 className="mb-3 text-sm font-semibold">
                      第 {idx + 1} 問: {q.questionText}
                    </h4>
                    <SelectionPie data={pieData} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

const feedbackCategoryVariant = {
  typo: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  fact: 'bg-destructive/10 text-destructive',
  alternative: 'bg-primary/10 text-primary',
} as const;

export function FeedbackSection({
  feedbacks,
  quizzes,
}: {
  feedbacks: FeedbackReport[];
  quizzes: Quiz[];
}) {
  const router = useRouter();

  const handleFixFeedback = (report: FeedbackReport) => {
    const quizObj = quizzes.find((q) => q.id === report.quizId);
    let qIdx = 0;
    if (quizObj) {
      const foundIdx = quizObj.questions.findIndex((q) => q.id === report.questionId);
      if (foundIdx !== -1) qIdx = foundIdx;
    }
    router.push(`/quiz/${report.quizId}/edit?questionIdx=${qIdx}`);
  };

  const categoryLabel = (category: FeedbackReport['category']) => {
    if (category === 'typo') return '誤字脱字';
    if (category === 'fact') return '事実誤認';
    return '別解・その他';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <AlertCircleIcon className="size-5 text-destructive" />
        <CardTitle className="text-base">
          プレイヤーからの間違い指摘キュー ({feedbacks.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {feedbacks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <InboxIcon className="size-12 opacity-40" />
            <p>現在、未解決の指摘報告はありません。素晴らしいクオリティです！</p>
          </div>
        ) : (
          <div className="space-y-3">
            {feedbacks.map((report) => (
              <div key={report.id} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge
                    variant="outline"
                    className={cn('border-0', feedbackCategoryVariant[report.category])}
                  >
                    {categoryLabel(report.category)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">解決待ち</span>
                </div>
                <p className="mb-3 text-sm">{report.content}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground" title={report.quizTitle}>
                    対象: {report.quizTitle}
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => handleFixFeedback(report)}>
                    <EditIcon className="size-3" />
                    修正する
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// プレイモードの日本語ラベル (再定義して使用)
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

// 1. PlayerStatsGridSection
export function PlayerStatsGridSection({ stats }: { stats: PlayerStats }) {
  const items = [
    { icon: PlayIcon, label: '累計プレイ数', value: `${stats.totalPlays} 回`, variant: 'primary' as const },
    { icon: StarIcon, label: '平均正解率', value: `${stats.averageAccuracy}%`, variant: 'warning' as const },
    { icon: TimeIcon, label: '平均解答時間', value: `${stats.averageTime} 秒`, variant: 'info' as const },
    { icon: FileTextIcon, label: 'プレイ済クイズ数', value: `${stats.uniqueQuizzesCount} 個`, variant: 'accent' as const },
  ];

  return (
    <div
      className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5"
      data-testid="player-stats"
    >
      {items.map(({ icon: Icon, label, value, variant }) => (
        <Card key={label} className="transition-colors hover:border-primary/50">
          <CardContent className="flex items-center gap-5 p-6">
            <div
              className={cn(
                'flex size-12 shrink-0 items-center justify-center rounded-full border',
                statIconVariants[variant],
              )}
            >
              <Icon className="size-6" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-xl font-bold">{value}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// 2. PlayerChartsSection
export function PlayerChartsSection({ stats }: { stats: PlayerStats }) {
  const modePieData = stats.modeDistribution.map((item) => ({
    label: item.label,
    count: item.count,
  }));

  return (
    <div
      className="grid grid-cols-1 gap-5 md:grid-cols-2"
      data-testid="player-charts"
    >
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <TrendingUpIcon className="size-5 text-primary" />
          <CardTitle className="text-base">プレイトレンド (直近7日間)</CardTitle>
        </CardHeader>
        <CardContent>
          <AnalyticsChart data={stats.dailyPlayCounts} title="日別プレイ数" color="primary" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <CategoryIcon className="size-5 text-chart-2" />
          <CardTitle className="text-base">プレイモード割合</CardTitle>
        </CardHeader>
        <CardContent>
          {modePieData.length === 0 ? (
            <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
              データがありません
            </div>
          ) : (
            <SelectionPie data={modePieData} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// 3. PlayerGenreTagAnalysisSection
export function PlayerGenreTagAnalysisSection({
  stats,
  genreLabelById,
}: {
  stats: PlayerStats;
  genreLabelById: Map<string, string>;
}) {
  return (
    <div
      className="grid grid-cols-1 gap-6 lg:grid-cols-2"
      data-testid="player-genre-tag-analysis"
    >
      {/* 頻度分析 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">よくプレイするジャンル & タグ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="mb-3 text-sm font-semibold flex items-center gap-2 text-primary">
              <CategoryIcon className="size-4" /> よくプレイするジャンル
            </h4>
            {stats.frequentGenres.length === 0 ? (
              <p className="text-sm text-muted-foreground">データがありません</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stats.frequentGenres.map((g) => (
                  <Badge key={g.genreId} variant="secondary" className="px-3 py-1 text-xs">
                    {genreLabelById.get(g.genreId) || g.genreId} ({g.count}回)
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold flex items-center gap-2 text-chart-2">
              <TagIcon className="size-4" /> よくプレイするタグ
            </h4>
            {stats.frequentTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">データがありません</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stats.frequentTags.map((t) => (
                  <Badge key={t.tagName} variant="outline" className="px-3 py-1 text-xs">
                    #{t.tagName} ({t.count}回)
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 得意（正答率）分析 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">得意なジャンル & タグ (プレイ3回以上)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="mb-3 text-sm font-semibold flex items-center gap-2 text-amber-500">
              <StarIcon className="size-4" /> 得意なジャンル
            </h4>
            {stats.accurateGenres.length === 0 ? (
              <p className="text-sm text-muted-foreground">条件に合うジャンルがありません</p>
            ) : (
              <div className="space-y-2">
                {stats.accurateGenres.map((g) => (
                  <div key={g.genreId} className="flex items-center justify-between text-sm border-b pb-1 last:border-0 last:pb-0">
                    <span className="font-medium">{genreLabelById.get(g.genreId) || g.genreId}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">({g.count}回プレイ)</span>
                      <span className="font-bold text-primary">{g.accuracy}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold flex items-center gap-2 text-indigo-500">
              <TagIcon className="size-4" /> 得意なタグ
            </h4>
            {stats.accurateTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">条件に合うタグがありません</p>
            ) : (
              <div className="space-y-2">
                {stats.accurateTags.map((t) => (
                  <div key={t.tagName} className="flex items-center justify-between text-sm border-b pb-1 last:border-0 last:pb-0">
                    <span className="font-medium">#{t.tagName}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">({t.count}回プレイ)</span>
                      <span className="font-bold text-chart-2">{t.accuracy}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 4. PlayerRecentPlayHistorySection
export function PlayerRecentPlayHistorySection({
  history,
  genreLabelById,
}: {
  history: PlayHistoryEntry[];
  genreLabelById: Map<string, string>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HistoryIcon className="size-5" /> 最近のプレイ履歴
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">プレイ履歴がありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs uppercase">
                  <th className="pb-3 pt-2 font-medium">クイズ</th>
                  <th className="pb-3 pt-2 font-medium">モード</th>
                  <th className="pb-3 pt-2 font-medium">正解数</th>
                  <th className="pb-3 pt-2 font-medium">解答時間</th>
                  <th className="pb-3 pt-2 font-medium">日時</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((h) => (
                  <tr key={h.attemptId} className="hover:bg-muted/50 transition-colors">
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
                      {new Date(h.completedAt).toLocaleDateString('ja-JP', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
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
