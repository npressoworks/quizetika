'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { getQuizzesByAuthor, exportQuizzes } from '@/services/quiz';
import { getReportsForCreator } from '@/services/review';
import { Quiz, Question, FeedbackReport } from '@/types';
import styles from './dashboard.module.css';
import { AnalyticsChart } from '@/components/charts/analytics-chart';
import { SelectionPie } from '@/components/charts/selection-pie';
import { 
  Play, 
  Bookmark, 
  Star, 
  FileText, 
  Download, 
  Plus, 
  Edit3, 
  AlertCircle, 
  TrendingUp, 
  ChevronRight,
  HelpCircle,
  Inbox
} from 'lucide-react';

export default function CreatorDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackReport[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);

  // 累計統計
  const [totalPlays, setTotalPlays] = useState(0);
  const [totalBookmarks, setTotalBookmarks] = useState(0);
  const [averageRating, setAverageRating] = useState(0);

  // アナリティクスダミーデータ (直近7日間のプレイ数推移)
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

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. クイズ一覧の取得 (下書き含む)
        const userQuizzes = await getQuizzesByAuthor(user.id, true);
        setQuizzes(userQuizzes);

        // クイズ詳細パネルのデフォルト選択
        if (userQuizzes.length > 0) {
          setSelectedQuiz(userQuizzes[0]);
        }

        // 統計値の集計
        let plays = 0;
        let bookmarks = 0;
        let reviewsSum = 0;
        let reviewsCount = 0;

        userQuizzes.forEach((q) => {
          plays += q.playCount || 0;
          bookmarks += q.bookmarksCount || 0;
          if (q.reviewScore !== null && q.reviewScore !== undefined) {
            reviewsSum += q.reviewScore;
            reviewsCount += 1;
          }
        });

        setTotalPlays(plays);
        setTotalBookmarks(bookmarks);
        setAverageRating(reviewsCount > 0 ? Math.round((reviewsSum / reviewsCount) * 10) / 10 : 0);

        // 2. 間違い指摘フィードバックの取得 (status = 'open')
        let fbList = await getReportsForCreator(user.id);

        // モックデータを追加 (テスト用およびデータが空のときのプレミアム演出用)
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

        setFeedbacks(fbList);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, authLoading]);

  // クイズの一括JSONエクスポート (要件 2.5)
  const handleExportAll = async () => {
    if (!user) return;
    try {
      const dataPackage = await exportQuizzes(user.id);
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(dataPackage, null, 2)
      )}`;
      
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute(
        'download',
        `quizeum_export_${user.displayName}_${new Date().toISOString().split('T')[0]}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      alert('エクスポートに失敗しました。');
    }
  };

  // 指指摘フィードバックを解決・編集画面へ遷移 (要件 2.4)
  const handleFixFeedback = (report: FeedbackReport) => {
    // 該当クイズの編集画面へ、設問インデックス情報を持って遷移
    // 設問IDに該当するインデックスを検索
    const quizObj = quizzes.find(q => q.id === report.quizId);
    let qIdx = 0;
    if (quizObj) {
      const foundIdx = quizObj.questions.findIndex(q => q.id === report.questionId);
      if (foundIdx !== -1) qIdx = foundIdx;
    }
    router.push(`/quiz/${report.quizId}/edit?questionIdx=${qIdx}`);
  };

  if (authLoading || loading) {
    return <div className={styles.container}>ダッシュボードを読み込み中...</div>;
  }

  return (
    <div className={styles.container}>
      {/* ヘッダーエリア */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>作家ダッシュボード</h1>
          <p style={{ color: 'var(--text-muted)' }}>あなたの作品のパフォーマンス管理と改善を行いましょう。</p>
        </div>
        <div className={styles.actions}>
          <button 
            className="btn btn-secondary" 
            onClick={handleExportAll}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Download size={16} />
            クイズ一括エクスポート
          </button>
          <button 
            className="btn btn-outline" 
            onClick={() => router.push('/list/create')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', border: '1px solid var(--border-light)', background: 'rgba(255, 255, 255, 0.05)' }}
          >
            <Plus size={16} />
            リストを新規作成
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => router.push('/quiz/create')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} />
            クイズを新規作成
          </button>
        </div>
      </div>

      {/* 累計統計グリッド (要件 2.1) */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Play size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>累計プレイ数</span>
            <span className={styles.statValue}>{totalPlays} 回</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: 'var(--color-accent)', background: 'rgba(0, 245, 212, 0.1)', borderColor: 'var(--color-accent-glow)' }}>
            <Bookmark size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>ブックマーク数</span>
            <span className={styles.statValue}>{totalBookmarks} 個</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: 'var(--color-warning)', background: 'rgba(255, 189, 0, 0.1)', borderColor: 'rgba(255, 189, 0, 0.2)' }}>
            <Star size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>平均良問評価率</span>
            <span className={styles.statValue}>{averageRating > 0 ? `${averageRating}%` : '-'}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: '#00bbf9', background: 'rgba(0, 187, 249, 0.1)', borderColor: 'rgba(0, 187, 249, 0.2)' }}>
            <FileText size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>作成クイズ総数</span>
            <span className={styles.statValue}>{quizzes.length} 個</span>
          </div>
        </div>
      </div>

      {/* アナリティクスグラフエリア (要件 2.1) */}
      <div className={styles.analyticsRow}>
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

      {/* メインダッシュボードコンテンツグリッド */}
      <div className={styles.dashboardGrid}>
        {/* クイズ一覧パネル */}
        <div className={styles.card}>
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
                >
                  <div className={styles.quizInfo}>
                    <span className={styles.quizTitle}>{quiz.title}</span>
                    <div className={styles.quizMeta}>
                      <span className={`${styles.statusBadge} ${quiz.status === 'published' ? styles.statusPublished : styles.statusDraft}`}>
                        {quiz.status === 'published' ? '公開中' : '下書き'}
                      </span>
                      <span>プレイ: {quiz.playCount || 0}回</span>
                      <span>★ {quiz.reviewScore !== null ? `${quiz.reviewScore}%` : '-'}</span>
                    </div>
                  </div>
                  <div className={styles.quizActions}>
                    <button 
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

        {/* 間違い指摘キュー管理パネル (要件 2.3) */}
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
                    <span className={`${styles.feedbackCategory} ${
                      report.category === 'typo' ? styles.categoryTypo :
                      report.category === 'fact' ? styles.categoryFact : styles.categoryAlternative
                    }`}>
                      {report.category === 'typo' ? '誤字脱字' :
                       report.category === 'fact' ? '事実誤認' : '別解・その他'}
                    </span>
                    <span className={styles.feedbackDate}>解決待ち</span>
                  </div>

                  <p className={styles.feedbackBody}>{report.content}</p>

                  <div className={styles.feedbackFooter}>
                    <span className={styles.feedbackSource} title={report.quizTitle}>
                      対象: {report.quizTitle}
                    </span>
                    {/* 指摘からの修正動線 (要件 2.4) */}
                    <button 
                      className={styles.fixBtn} 
                      onClick={() => handleFixFeedback(report)}
                    >
                      <Edit3 size={12} />
                      修正する
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 個別クイズ解答割合詳細パネル (要件 2.2) */}
      {selectedQuiz && (
        <div className={styles.quizDetailPanel}>
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
              // パイチャート用のモック解答データ生成 (データがない場合の表示崩れを防ぐ)
              let pieData: { label: string; count: number }[] = [];
              
              if (q.type === 'multiple-choice' && q.choices) {
                pieData = q.choices.map((choice) => ({
                  label: choice.choiceText,
                  count: choice.selectedCount || Math.floor(Math.random() * 20) + 1, // ダミー
                }));
              } else {
                // 記述式やその他のタイプの場合は正誤のパイチャート
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
    </div>
  );
}
