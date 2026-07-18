'use client';

import React, { useEffect, useState, useRef } from 'react';
import { getCreatorQuizAnalysis } from '@/services/dashboard';
import { getQuiz } from '@/services/quiz';
import { QuizAnalysis } from '@/types/dashboard';
import { Quiz } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ArrowBackOutlined as ArrowBackIcon,
  HelpOutlineOutlined as HelpIcon,
  TrendingDownOutlined as DropIcon,
  BarChartOutlined as BarChartIcon,
} from '@mui/icons-material';

interface CreatorQuizAnalysisProps {
  quizId: string;
  period: '7d' | '30d' | '90d' | 'all';
  onBack: () => void;
}

export function CreatorQuizAnalysis({ quizId, period, onBack }: CreatorQuizAnalysisProps) {
  const [analysis, setAnalysis] = useState<QuizAnalysis | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const reqId = ++requestIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const [analysisData, quizData] = await Promise.all([
          getCreatorQuizAnalysis(quizId, period),
          getQuiz(quizId),
        ]);

        if (reqId !== requestIdRef.current || !active) return;

        if (!quizData) {
          throw new Error('クイズデータが見つかりません、またはアクセス権限がありません。');
        }

        setAnalysis(analysisData);
        setQuiz(quizData);
      } catch (err: any) {
        if (reqId !== requestIdRef.current || !active) return;
        console.error('[CreatorQuizAnalysis] error:', err);
        setError(err.message || '分析データの取得に失敗しました');
      } finally {
        if (reqId === requestIdRef.current && active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [quizId, period]);

  if (loading) {
    return (
      <div className="space-y-6" data-testid="creator-quiz-analysis-skeleton">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} disabled>
            <ArrowBackIcon className="size-4 mr-2" />
            戻る
          </Button>
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
        </div>
        <Card className="h-[200px] bg-muted animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6" data-testid="creator-quiz-analysis-error">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowBackIcon className="size-4 mr-2" />
            戻る
          </Button>
          <h2 className="text-xl font-bold">クイズ詳細分析</h2>
        </div>
        <div className="p-6 rounded-xl border border-destructive bg-destructive/10 text-center text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!analysis || !quiz) {
    return null;
  }

  const isDataAccumulating = analysis.lifecycleSampleSize === 0 || analysis.completionRate === null;

  // スコア分布の最大件数を算出 (CSSバーの100%基準用)
  const maxScoreCount = Math.max(...analysis.scoreDistribution.map((s) => s.count), 1);

  // 離脱分布の最大離脱数を算出 (100%基準用)
  const maxDropoffCount = Math.max(...analysis.dropoffDistribution.map((d) => d.count), 1);

  const formatLabels: Record<string, string> = {
    'true-false': '〇✕問題',
    'multiple-choice': '選択式',
    'text-input': '短答式',
    'lateral-thinking': '水平思考',
  };

  return (
    <div className="space-y-6" data-testid="creator-quiz-analysis">
      {/* ヘッダーエリア */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowBackIcon className="size-4 mr-2" />
            ダッシュボードへ戻る
          </Button>
          <h2 className="text-xl font-bold truncate max-w-[300px]" title={quiz.title}>
            {quiz.title}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline">
            完走率: {isDataAccumulating ? 'データ蓄積中' : `${analysis.completionRate}%`}
          </Badge>
          <span className="text-xs text-muted-foreground">
            サンプル数: {analysis.lifecycleSampleSize} 件
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. スコア分布 */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <BarChartIcon className="size-5 text-primary" />
            <CardTitle className="text-base">スコア得点分布</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {analysis.scoreDistribution.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">データがありません</div>
            ) : (
              <div className="space-y-3">
                {analysis.scoreDistribution.map((item) => {
                  const percent = Math.round((item.count / maxScoreCount) * 100);
                  return (
                    <div key={item.bucket} className="flex items-center gap-4 text-sm">
                      <span className="w-16 text-right font-medium text-xs text-muted-foreground shrink-0">{item.bucket}</span>
                      <div className="flex-1 bg-muted/30 h-6 rounded overflow-hidden">
                        <div
                          className="bg-primary h-full rounded transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="w-10 text-xs font-bold shrink-0">{item.count} 件</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. 設問別離脱分布 */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <DropIcon className="size-5 text-destructive" />
            <CardTitle className="text-base">設問別離脱者数</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {isDataAccumulating ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <p className="font-semibold text-warning">データ蓄積中</p>
                <p className="text-xs mt-1">完走データが不足しているため、離脱分布を表示できません。</p>
              </div>
            ) : analysis.dropoffDistribution.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">データがありません</div>
            ) : (
              <div className="space-y-3">
                {analysis.dropoffDistribution.map((item) => {
                  const percent = Math.round((item.count / maxDropoffCount) * 100);
                  const qText = quiz.questions[item.questionIndex]?.questionText || `設問 ${item.questionIndex + 1}`;
                  return (
                    <div key={item.questionIndex} className="flex items-center gap-4 text-sm">
                      <span className="w-16 text-right font-medium text-xs text-muted-foreground shrink-0 truncate" title={qText}>
                        Q{item.questionIndex + 1}
                      </span>
                      <div className="flex-1 bg-muted/30 h-6 rounded overflow-hidden">
                        <div
                          className="bg-destructive/80 h-full rounded transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="w-10 text-xs font-bold text-destructive shrink-0">{item.count} 人離脱</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. 設問別累計詳細 (期間フィルタ対象外の累計カウンタ) */}
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-2">
            <HelpIcon className="size-5 text-primary" />
            <CardTitle className="text-base">設問別累計詳細パフォーマンス</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            累計値（期間フィルタ対象外）
          </Badge>
        </CardHeader>
        <CardContent className="divide-y pt-2">
          {quiz.questions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">登録された設問がありません。</p>
          ) : (
            quiz.questions.map((q, idx) => {
              const plays = (q.correctCount || 0) + (q.incorrectCount || 0);
              const accuracy = plays > 0 ? Math.round((q.correctCount / plays) * 100) : 0;
              const formatName = formatLabels[q.type] || q.type;

              return (
                <div key={q.id || idx} className="py-6 first:pt-4 last:pb-4 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground">Q{idx + 1}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{formatName}</Badge>
                      </div>
                      <p className="font-semibold text-sm">{q.questionText}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-extrabold text-primary">{accuracy}%</div>
                      <div className="text-[10px] text-muted-foreground">正答率 ({plays} 回中)</div>
                    </div>
                  </div>

                  {/* 選択肢分布 (multiple-choice のみ) */}
                  {q.type === 'multiple-choice' && q.choices && q.choices.length > 0 && (
                    <div className="pl-4 border-l-2 border-primary/20 space-y-2">
                      <span className="text-[10px] font-semibold text-muted-foreground block mb-2">
                        選択肢別解答分布
                      </span>
                      {q.choices.map((c) => {
                        const totalSelects = q.choices!.reduce((acc, curr) => acc + (curr.selectedCount || 0), 0);
                        const cPercent = totalSelects > 0 ? Math.round(((c.selectedCount || 0) / totalSelects) * 100) : 0;
                        return (
                          <div key={c.id} className="flex items-center gap-3 text-xs">
                            <span className={cn('w-20 truncate', c.isCorrect && 'text-emerald-600 dark:text-emerald-400 font-semibold')} title={c.choiceText}>
                              {c.choiceText} {c.isCorrect && '✓'}
                            </span>
                            <div className="flex-1 bg-muted/20 h-4 rounded overflow-hidden">
                              <div
                                className={cn('h-full rounded transition-all duration-300', c.isCorrect ? 'bg-emerald-500' : 'bg-muted-foreground/30')}
                                style={{ width: `${cPercent}%` }}
                              />
                            </div>
                            <span className="w-16 text-right text-[10px] font-medium text-muted-foreground">
                              {c.selectedCount || 0} 回 ({cPercent}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
