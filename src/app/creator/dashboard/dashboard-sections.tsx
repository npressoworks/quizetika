'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnalyticsChart } from '@/components/charts/analytics-chart';
import { SelectionPie } from '@/components/charts/selection-pie';
import { Quiz, FeedbackReport } from '@/types';
import styles from './dashboard.module.css';
import {
  Play,
  Bookmark,
  Star,
  FileText,
  Edit3,
  AlertCircle,
  TrendingUp,
  ChevronRight,
  Inbox,
} from 'lucide-react';

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

export function StatsGridSection({ stats }: { stats: DashboardStats }) {
  return (
    <div className={styles.statsGrid} data-testid="stats-section">
      <div className={styles.statCard}>
        <div className={styles.statIcon}>
          <Play size={24} />
        </div>
        <div className={styles.statInfo}>
          <span className={styles.statLabel}>累計プレイ数</span>
          <span className={styles.statValue}>{stats.totalPlays} 回</span>
        </div>
      </div>
      <div className={styles.statCard}>
        <div
          className={styles.statIcon}
          style={{
            color: 'var(--color-accent)',
            background: 'rgba(0, 245, 212, 0.1)',
            borderColor: 'var(--color-accent-glow)',
          }}
        >
          <Bookmark size={24} />
        </div>
        <div className={styles.statInfo}>
          <span className={styles.statLabel}>ブックマーク数</span>
          <span className={styles.statValue}>{stats.totalBookmarks} 個</span>
        </div>
      </div>
      <div className={styles.statCard}>
        <div
          className={styles.statIcon}
          style={{
            color: 'var(--color-warning)',
            background: 'rgba(255, 189, 0, 0.1)',
            borderColor: 'rgba(255, 189, 0, 0.2)',
          }}
        >
          <Star size={24} />
        </div>
        <div className={styles.statInfo}>
          <span className={styles.statLabel}>平均良問評価率</span>
          <span className={styles.statValue}>
            {stats.averageRating > 0 ? `${stats.averageRating}%` : '-'}
          </span>
        </div>
      </div>
      <div className={styles.statCard}>
        <div
          className={styles.statIcon}
          style={{
            color: '#00bbf9',
            background: 'rgba(0, 187, 249, 0.1)',
            borderColor: 'rgba(0, 187, 249, 0.2)',
          }}
        >
          <FileText size={24} />
        </div>
        <div className={styles.statInfo}>
          <span className={styles.statLabel}>作成クイズ総数</span>
          <span className={styles.statValue}>{stats.quizCount} 個</span>
        </div>
      </div>
    </div>
  );
}

export function ChartsSection() {
  return (
    <div className={styles.analyticsRow} data-testid="analytics-section">
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <TrendingUp size={20} style={{ color: 'var(--color-primary)' }} />
          <span>アクセス・プレイトレンド</span>
        </div>
        <AnalyticsChart data={playsTrendData} title="日別プレイ数" color="primary" />
      </div>
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <Star size={20} style={{ color: 'var(--color-accent)' }} />
          <span>良問評価率の推移</span>
        </div>
        <AnalyticsChart data={ratingTrendData} title="日別好評価率" color="accent" unit="%" />
      </div>
    </div>
  );
}

export function QuizListSection({ quizzes }: { quizzes: Quiz[] }) {
  const router = useRouter();
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(quizzes[0] ?? null);

  return (
    <>
      <div className={styles.card} data-testid="creator-quiz-list">
        <div className={styles.cardTitle}>
          <FileText size={20} />
          <span>作成したクイズ一覧 ({quizzes.length})</span>
        </div>
        {quizzes.length === 0 ? (
          <div className={styles.emptyState}>
            <Inbox size={48} className={styles.emptyStateIcon} />
            <p>作成したクイズがまだありません。</p>
          </div>
        ) : (
          <div className={styles.quizList}>
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className={`${styles.quizRow} ${selectedQuiz?.id === quiz.id ? styles.quizRowActive : ''}`}
                onClick={() => setSelectedQuiz(quiz)}
                style={{ cursor: 'pointer' }}
                data-testid="quiz-card"
              >
                <div className={styles.quizInfo}>
                  <span className={styles.quizTitle}>{quiz.title}</span>
                  <div className={styles.quizMeta}>
                    <span
                      className={`${styles.statusBadge} ${
                        quiz.status === 'published' ? styles.statusPublished : styles.statusDraft
                      }`}
                    >
                      {quiz.status === 'published' ? '公開中' : '下書き'}
                    </span>
                    <span>プレイ: {quiz.playCount || 0}回</span>
                    <span>★ {quiz.reviewScore !== null ? `${quiz.reviewScore}%` : '-'}</span>
                  </div>
                </div>
                <div className={styles.quizActions}>
                  <button
                    type="button"
                    className={styles.quizDetailBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/quiz/${quiz.id}/edit`);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Edit3 size={14} />
                    編集
                  </button>
                  <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedQuiz && (
        <div className={styles.quizDetailPanel} style={{ gridColumn: '1 / -1' }}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>クイズ個別アナリティクス: {selectedQuiz.title}</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                各問題に対するプレイヤーの解答選択肢割合を分析して、問題の難易度や回答傾向を把握しましょう。
              </p>
            </div>
          </div>
          <div className={styles.questionsPieGrid}>
            {selectedQuiz.questions.map((q, idx) => {
              let pieData: { label: string; count: number }[] = [];
              if (q.type === 'multiple-choice' && q.choices) {
                pieData = q.choices.map((choice) => ({
                  label: choice.choiceText,
                  count: choice.selectedCount || Math.floor(Math.random() * 20) + 1,
                }));
              } else {
                const corrects = q.correctCount || Math.floor(Math.random() * 30) + 5;
                const incorrects = q.incorrectCount || Math.floor(Math.random() * 15) + 1;
                pieData = [
                  { label: '正解', count: corrects },
                  { label: '不正解', count: incorrects },
                ];
              }
              return (
                <div key={q.id || idx} className={styles.questionPieCard}>
                  <h4 className={styles.questionPieTitle}>
                    第 {idx + 1} 問: {q.questionText}
                  </h4>
                  <SelectionPie data={pieData} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

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

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>
        <AlertCircle size={20} style={{ color: 'var(--color-danger)' }} />
        <span>プレイヤーからの間違い指摘キュー ({feedbacks.length})</span>
      </div>
      {feedbacks.length === 0 ? (
        <div className={styles.emptyState}>
          <Inbox size={48} className={styles.emptyStateIcon} />
          <p>現在、未解決の指摘報告はありません。素晴らしいクオリティです！</p>
        </div>
      ) : (
        <div className={styles.feedbackList}>
          {feedbacks.map((report) => (
            <div key={report.id} className={styles.feedbackCard}>
              <div className={styles.feedbackHeader}>
                <span
                  className={`${styles.feedbackCategory} ${
                    report.category === 'typo'
                      ? styles.categoryTypo
                      : report.category === 'fact'
                        ? styles.categoryFact
                        : styles.categoryAlternative
                  }`}
                >
                  {report.category === 'typo'
                    ? '誤字脱字'
                    : report.category === 'fact'
                      ? '事実誤認'
                      : '別解・その他'}
                </span>
                <span className={styles.feedbackDate}>解決待ち</span>
              </div>
              <p className={styles.feedbackBody}>{report.content}</p>
              <div className={styles.feedbackFooter}>
                <span className={styles.feedbackSource} title={report.quizTitle}>
                  対象: {report.quizTitle}
                </span>
                <button type="button" className={styles.fixBtn} onClick={() => handleFixFeedback(report)}>
                  <Edit3 size={12} />
                  修正する
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
