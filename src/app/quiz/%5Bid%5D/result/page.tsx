'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, X, ShieldAlert, Award, Heart, ThumbsUp, ThumbsDown, MessageSquare, AlertTriangle, ArrowLeft, Trophy, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { getQuiz } from '@/services/quiz';
import { submitReview, submitFeedbackReport } from '@/services/review';
import { sendReaction } from '@/services/reaction';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getPendingSyncAttempts } from '@/services/attempt-session';
import { Quiz, Attempt, FeedbackReport } from '@/types';
import styles from './result.module.css';
import { Header } from '@/components/layout/header';

interface PageProps {
  params: Promise<{ id: string }>;
}

function QuizResultPageContent({ params }: PageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  const resolvedParams = use(params);
  const quizId = resolvedParams.id;
  const attemptId = searchParams.get('attemptId');
  const localId = searchParams.get('localId');

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [online, setOnline] = useState<boolean>(true);

  // 投票・リアクション状況
  const [voted, setVoted] = useState<'positive' | 'negative' | null>(null);
  const [difficultyVote, setDifficultyVote] = useState<number | null>(null);
  const [reactionSent, setReactionSent] = useState<boolean>(false);
  const [feedbackCategory, setFeedbackCategory] = useState<'typo' | 'fact' | 'alternative'>('typo');
  const [feedbackContent, setFeedbackContent] = useState<string>('');
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [feedbackLoading, setFeedbackLoading] = useState<boolean>(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);

  // 1. オンライン状態の監視
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOnline(navigator.onLine && !localId); // localId がある場合は強制的にオフラインフォールバック扱い
      const goOnline = () => setOnline(navigator.onLine && !localId);
      const goOffline = () => setOnline(false);
      window.addEventListener('online', goOnline);
      window.addEventListener('offline', goOffline);
      return () => {
        window.removeEventListener('online', goOnline);
        window.removeEventListener('offline', goOffline);
      };
    }
  }, [localId]);

  // 2. クイズおよび Attempt データの読み込み
  useEffect(() => {
    async function loadData() {
      try {
        const qData = await getQuiz(quizId);
        setQuiz(qData);

        if (attemptId) {
          // オンライン Attempt 取得
          const attRef = doc(db, 'attempts', attemptId);
          const attSnap = await getDoc(attRef);
          if (attSnap.exists()) {
            const att = attSnap.data() as Attempt;
            setAttempt(att);
            setDifficultyVote(att.difficultyVote ?? null);
          }
        } else if (localId) {
          // オフライン Attempt 取得 (localStorage から検索)
          const pending = getPendingSyncAttempts();
          const localAtt = pending.find((a) => a.localId === localId);
          if (localAtt) {
            setAttempt({
              id: localAtt.localId,
              userId: localAtt.userId,
              quizId: localAtt.quizId,
              mode: localAtt.mode,
              score: localAtt.score,
              totalQuestions: localAtt.totalQuestions,
              elapsedSeconds: localAtt.elapsedSeconds,
              failedQuestionIds: localAtt.failedQuestionIds,
              difficultyVote: localAtt.difficultyVote,
              aiTurnCount: localAtt.aiTurnCount,
              aiTurnLimit: localAtt.aiTurnLimit,
              completedAt: new Date(localAtt.completedAt),
            });
            setDifficultyVote(localAtt.difficultyVote ?? null);
          }
        }
      } catch (e) {
        console.error('[QuizResult] ロード失敗:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [quizId, attemptId, localId]);

  // 👍/👎投票
  const handleReviewVote = async (vote: 'positive' | 'negative') => {
    if (!user || !quiz || voted || !online) return;
    try {
      await submitReview(quiz.id, user.id, vote);
      setVoted(vote);
    } catch (e) {
      console.error('[QuizResult] 投票失敗:', e);
    }
  };

  // 難易度投票 (1〜10)
  const handleDifficultyVote = async (level: number) => {
    if (!user || !attempt || !online) return;
    setDifficultyVote(level);
    try {
      if (attemptId) {
        const attRef = doc(db, 'attempts', attemptId);
        await updateDoc(attRef, { difficultyVote: level });
      }
    } catch (e) {
      console.error('[QuizResult] 難易度投票失敗:', e);
    }
  };

  // 作家感謝リアクション
  const handleSendReaction = async () => {
    if (!user || !quiz || reactionSent || !online) return;
    try {
      await sendReaction(user.id, quiz.authorId, quiz.id, quiz.title);
      setReactionSent(true);
    } catch (e) {
      console.error('[QuizResult] リアクション送信失敗:', e);
    }
  };

  // 間違い指摘送信
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !quiz || !feedbackContent.trim() || feedbackLoading || !online) return;

    setFeedbackLoading(true);
    try {
      const report: Omit<FeedbackReport, 'id' | 'status' | 'createdAt'> = {
        quizId: quiz.id,
        quizTitle: quiz.title,
        questionId: quiz.questions[0]?.id || 'unknown',
        questionText: quiz.questions[0]?.questionText || '全体',
        reporterId: user.id,
        creatorId: quiz.authorId,
        category: feedbackCategory,
        content: feedbackContent,
      };

      await submitFeedbackReport(report);
      setFeedbackSubmitted(true);
      setTimeout(() => {
        setShowFeedbackModal(false);
        setFeedbackSubmitted(false);
        setFeedbackContent('');
      }, 2000);
    } catch (e) {
      console.error('[QuizResult] 指摘送信失敗:', e);
    } finally {
      setFeedbackLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '100px 0' }}>
        <p style={{ color: 'var(--text-muted)' }}>結果データをロード中...</p>
      </div>
    );
  }

  if (!quiz || !attempt) {
    return (
      <div className={styles.container}>
        <Link href="/" className={styles.backBtn}>
          <ArrowLeft size={16} />
          ホームへ戻る
        </Link>
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <h2 style={{ color: 'var(--text-main)' }}>結果データが見つかりません</h2>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.backBtn}>
        <ArrowLeft size={16} />
        探索に戻る
      </Link>

      {/* 優しいオフライン警告ヘッダー (Task 5.5) */}
      {!online && (
        <div className={styles.offlineAlert}>
          <ShieldAlert size={24} style={{ color: '#ff007f' }} />
          <div className={styles.offlineText}>
            現在オフラインのため、良問評価や間違い指摘、作家リアクションは送信できません。
            インターネット接続が復旧した際にバックグラウンドで自動同期されます。
          </div>
        </div>
      )}

      {/* スコア結果サマリー */}
      <div className={styles.summaryCard}>
        <div className={styles.scoreCircle}>
          <span className={styles.scoreVal}>{attempt.score}</span>
          <span className={styles.scoreLabel}>/ {attempt.totalQuestions} 問 正解</span>
        </div>

        <h1 className={styles.resultTitle}>
          {attempt.score === attempt.totalQuestions
            ? '🎉 パーフェクト達成！素晴らしい！'
            : '👍 お疲れ様でした！ナイスプレイ！'}
        </h1>

        <div className={styles.metaStats}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            ⏱️ 経過秒数: <strong>{attempt.elapsedSeconds}</strong> 秒
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            🎯 クリア率: <strong>{Math.round((attempt.score / attempt.totalQuestions) * 100)}</strong>%
          </span>
        </div>
      </div>

      {/* 評価フィードバックパネル (オンライン時のみフル利用可能) */}
      <div className={styles.feedbackPanel}>
        <h2 className={styles.panelTitle}>クイズの品質向上にご協力ください</h2>

        {/* 1. 良問/悪問評価 */}
        <div className={styles.voteRow}>
          <span className={styles.voteLabel}>このクイズはどうでしたか？</span>
          <div className={styles.btnGroup}>
            <button
              className={`${styles.voteBtn} ${voted === 'positive' ? styles.voteActive : ''}`}
              onClick={() => handleReviewVote('positive')}
              disabled={!online || voted !== null || user?.id === quiz.authorId}
            >
              <ThumbsUp size={16} /> 良問 (👍)
            </button>
            <button
              className={`${styles.voteBtn} ${voted === 'negative' ? styles.voteActive : ''}`}
              onClick={() => handleReviewVote('negative')}
              disabled={!online || voted !== null || user?.id === quiz.authorId}
            >
              <ThumbsDown size={16} /> 微妙 (👎)
            </button>
          </div>
        </div>

        {/* 2. 難易度投票 (1 - 10) */}
        <div className={styles.difficultyVoteSection}>
          <span className={styles.voteLabel}>あなたが感じた体感難易度を投票してください (1: 簡単 〜 10: 激難)</span>
          <div className={styles.difficultyBar}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((level) => (
              <button
                key={level}
                className={`${styles.diffCell} ${difficultyVote === level ? styles.diffCellSelected : ''}`}
                onClick={() => handleDifficultyVote(level)}
                disabled={!online}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* 3. 指摘・お礼リアクションバー */}
        <div className={styles.actionBtnRow}>
          <button
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={() => setShowFeedbackModal(true)}
            disabled={!online}
          >
            <MessageSquare size={16} /> 問題の間違い指摘
          </button>
          <button
            className="btn btn-accent"
            style={{ flex: 1 }}
            onClick={handleSendReaction}
            disabled={!online || reactionSent || user?.id === quiz.authorId}
          >
            <Heart size={16} fill={reactionSent ? '#fff' : 'none'} />
            {reactionSent ? '感謝を送信しました！' : '作家にお礼リアクションを送る'}
          </button>
        </div>
      </div>

      {/* 問題正誤リストおよび解説表示 (Task 5.1) */}
      <section className={styles.questionsList}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-main)' }}>
          設問ごとの解説
        </h2>

        {quiz.questions.map((q, idx) => {
          const isCorrect = !attempt.failedQuestionIds.includes(q.id);
          return (
            <article key={q.id} className={styles.questionItem}>
              <div className={styles.itemHeader}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                  第 {idx + 1} 問
                </h3>
                {isCorrect ? (
                  <span className={styles.correctLabel}>
                    <Check size={16} /> 正解
                  </span>
                ) : (
                  <span className={styles.incorrectLabel}>
                    <X size={16} /> 不正解
                  </span>
                )}
              </div>

              <p style={{ fontSize: '1.05rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
                {q.questionText}
              </p>

              {q.explanation && (
                <div className={styles.explanationBox}>
                  <div className={styles.explanationTitle}>💡 解説</div>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    {q.explanation}
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </section>

      {/* 間違い指摘モーダルダイアログ (Task 5.3) */}
      {showFeedbackModal && (
        <div className={styles.modalOverlay} onClick={() => setShowFeedbackModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              <AlertTriangle size={18} style={{ color: '#ffb703' }} />
              問題の間違い・別解の指摘
            </h3>
            
            {feedbackSubmitted ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#00f5d4' }}>
                <CheckCircle size={32} style={{ margin: '0 auto 12px' }} />
                指摘レポートを送信しました。ご協力ありがとうございました！
              </div>
            ) : (
              <form onSubmit={handleFeedbackSubmit} className={styles.form}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>指摘カテゴリ</label>
                  <select
                    className={styles.select}
                    value={feedbackCategory}
                    onChange={(e) => setFeedbackCategory(e.target.value as any)}
                  >
                    <option value="typo">誤字脱字・表現の修正</option>
                    <option value="fact">事実誤認・解答の間違い</option>
                    <option value="alternative">別解の追加要望</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>指摘の具体的な内容</label>
                  <textarea
                    className={styles.textarea}
                    placeholder="修正箇所や正しい解答などの詳細情報を具体的に記述してください..."
                    value={feedbackContent}
                    onChange={(e) => setFeedbackContent(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setShowFeedbackModal(false)}
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={feedbackLoading || !feedbackContent.trim()}
                  >
                    {feedbackLoading ? '送信中...' : '送信する'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuizResultPage(props: PageProps) {
  return (
    <>
      <Header />
      <React.Suspense fallback={<div className={styles.container} style={{ textAlign: 'center', padding: '100px 0' }}><p style={{ color: 'var(--text-muted)' }}>結果データをロード中...</p></div>}>
        <QuizResultPageContent {...props} />
      </React.Suspense>
    </>
  );
}
