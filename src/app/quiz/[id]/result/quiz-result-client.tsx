'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckOutlined,
  CloseOutlined,
  SecurityOutlined,
  EmojiEventsOutlined,
  ThumbUpOutlined,
  ThumbDownOutlined,
  SmsOutlined,
  WarningAmberOutlined,
  ArrowBackOutlined,
  CheckCircleOutlined,
  ChevronRightOutlined,
  BookmarkBorderOutlined,
  BookmarkRounded,
  PersonAddOutlined,
  HowToRegOutlined
} from '@mui/icons-material';
import { parseMarkdownToHtml } from '@/lib/security/sanitize';
import { MarkdownContent } from '@/components/markdown/markdown-content';
import { useAuth } from '@/context/auth-context';
import { getDifficultyColor } from '@/lib/difficulty-color';
import { submitReview, retractReview, submitFeedbackReport, getOpenReportsForQuiz, updateFeedbackReport, getUserReviewForQuiz } from '@/services/review';
import { isFollowing, followUser, unfollowUser } from '@/services/user';
import { db } from '@/lib/firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import { formatCorrectAnswer, formatUserAnswer, getUserAnswerRaw } from '@/services/attempt-answer-display';
import { Quiz, Attempt, FeedbackReport, Question } from '@/types';
import { toggleBookmark, isBookmarked } from '@/services/bookmark';
import { QuestionBookmarkToggle } from '@/components/bookmark/question-bookmark-toggle';
import { ReportModal } from '@/components/quiz/report-modal';
import {
  readMyQuizSession,
  advanceMyQuizSession,
  clearMyQuizSession,
  buildMyQuizPlayUrl,
  peekNextMyQuizEntry,
} from '@/lib/my-quiz-session';
import { ResultSkeleton } from '@/components/quiz/result-skeleton';
import { ResultQuestionDetailsAccordion } from '@/components/quiz/result-question-details-accordion';
import { DifficultyVoteStars } from '@/components/quiz/difficulty-vote-stars';
import { resultClasses as styles } from './result-classes';

interface QuizResultClientProps {
  quiz: Quiz;
  attemptId?: string;
  localId?: string;
  initialAttempt?: Attempt | null;
  initialAttemptError?: string | null;
  recommendChildren?: React.ReactNode;
}

export function QuizResultClient({
  quiz,
  attemptId: propAttemptId,
  localId: propLocalId,
  initialAttempt = null,
  initialAttemptError = null,
  recommendChildren,
}: QuizResultClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const attemptId = propAttemptId || searchParams.get('attemptId') || undefined;
  const localId = propLocalId || searchParams.get('localId') || undefined;

  const needsClientAttemptLoad =
    !initialAttempt &&
    (!initialAttemptError || !!localId) &&
    !!(attemptId || localId);
  const [attempt, setAttempt] = useState<Attempt | null>(initialAttempt);
  const [attemptLoading, setAttemptLoading] = useState<boolean>(needsClientAttemptLoad);
  const [attemptError, setAttemptError] = useState<string | null>(initialAttemptError);

  const [online, setOnline] = useState<boolean>(true);
  const [quickPressTimes, setQuickPressTimes] = useState<{ [questionId: string]: number } | null>(null);

  // 投票・リアクション状況
  const [voted, setVoted] = useState<'positive' | 'negative' | null>(null);
  // 投票成功時のトースト通知メッセージ
  const [voteToastMessage, setVoteToastMessage] = useState<string | null>(null);
  const [difficultyVote, setDifficultyVote] = useState<number | null>(initialAttempt?.difficultyVote ?? null);
  const [isFollowingAuthor, setIsFollowingAuthor] = useState<boolean>(false);
  const [followLoading, setFollowLoading] = useState<boolean>(false);
  const [feedbackCategory, setFeedbackCategory] = useState<'typo' | 'fact' | 'alternative'>('typo');
  const [feedbackContent, setFeedbackContent] = useState<string>('');
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [feedbackLoading, setFeedbackLoading] = useState<boolean>(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);
  const [openReports, setOpenReports] = useState<FeedbackReport[]>([]);

  const [isMyQuizFlow, setIsMyQuizFlow] = useState(false);
  const [nextMyQuizUrl, setNextMyQuizUrl] = useState<string | null>(null);
  const [isLastInMyQuiz, setIsLastInMyQuiz] = useState(false);
  const [myQuizSessionMissing, setMyQuizSessionMissing] = useState(false);
  const [bookmarkedQuestionIds, setBookmarkedQuestionIds] = useState<Set<string>>(new Set());
  const [bookmarkedQuizIds, setBookmarkedQuizIds] = useState<Set<string>>(new Set());

  // 連想クイズの表示ヒント履歴用
  const [revealedHints, setRevealedHints] = useState<{ questionId: string; revealedHints: string[]; revealedCount: number }[]>([]);

  // 通報モーダル表示用
  const [showReportModal, setShowReportModal] = useState<boolean>(false);

  // 特定の問題に対する間違い指摘用
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);

  // アテンプトの非同期ロード（localId やサーバー未取得時のみ）
  useEffect(() => {
    if (initialAttempt) {
      return;
    }
    if (initialAttemptError && !localId) {
      return;
    }

    async function loadAttempt() {
      setAttemptLoading(true);
      setAttemptError(null);
      try {
        if (attemptId) {
          const { doc, getDoc } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase/config');
          const attRef = doc(db, 'attempts', attemptId);
          const attSnap = await getDoc(attRef);
          if (attSnap.exists()) {
            const data = attSnap.data();
            const completedAt = data.completedAt?.toDate ? data.completedAt.toDate() : new Date(data.completedAt);
            const att = { ...data, id: attSnap.id, completedAt } as Attempt;
            setAttempt(att);
            if (att.difficultyVote !== undefined) {
              setDifficultyVote(att.difficultyVote ?? null);
            }
          } else if (localId) {
            const { getOptimisticAttempt } = await import('@/lib/optimistic-attempt');
            const optimistic = getOptimisticAttempt(localId);
            if (optimistic) {
              const att = {
                ...optimistic,
                id: optimistic.localId,
                completedAt: new Date(optimistic.completedAt),
              } as Attempt;
              setAttempt(att);
              if (att.difficultyVote !== undefined) {
                setDifficultyVote(att.difficultyVote ?? null);
              }
            } else {
              const { getPendingSyncAttempts } = await import('@/services/attempt-session');
              const pendingAttempts = getPendingSyncAttempts();
              const found = pendingAttempts.find((a) => a.localId === localId);
              if (found) {
                const att = {
                  ...found,
                  id: found.localId,
                  completedAt: new Date(found.completedAt)
                } as Attempt;
                setAttempt(att);
                if (att.difficultyVote !== undefined) {
                  setDifficultyVote(att.difficultyVote ?? null);
                }
              } else {
                setAttempt({
                  id: localId,
                  userId: '',
                  quizId: quiz.id,
                  mode: 'normal',
                  score: 0,
                  totalQuestions: quiz.questionCount || 0,
                  elapsedSeconds: 0,
                  failedQuestionIds: [],
                  questionAnswers: [],
                  aiTurnCount: 0,
                  aiTurnLimit: 0,
                  completedAt: new Date(),
                });
              }
            }
          } else {
            setAttemptError('結果データが見つかりません');
          }
        } else if (localId) {
          const { getOptimisticAttempt } = await import('@/lib/optimistic-attempt');
          const optimistic = getOptimisticAttempt(localId);
          if (optimistic) {
            const att = {
              ...optimistic,
              id: optimistic.localId,
              completedAt: new Date(optimistic.completedAt),
            } as Attempt;
            setAttempt(att);
            if (att.difficultyVote !== undefined) {
              setDifficultyVote(att.difficultyVote ?? null);
            }
            setAttemptLoading(false);
            return;
          }

          const { getPendingSyncAttempts } = await import('@/services/attempt-session');
          const pendingAttempts = getPendingSyncAttempts();
          const found = pendingAttempts.find((a) => a.localId === localId);
          if (found) {
            const att = {
              ...found,
              id: found.localId,
              completedAt: new Date(found.completedAt)
            } as Attempt;
            setAttempt(att);
            if (att.difficultyVote !== undefined) {
              setDifficultyVote(att.difficultyVote ?? null);
            }
          } else {
            setAttempt({
              id: localId,
              userId: '',
              quizId: quiz.id,
              mode: 'normal',
              score: 0,
              totalQuestions: quiz.questionCount || 0,
              elapsedSeconds: 0,
              failedQuestionIds: [],
              questionAnswers: [],
              aiTurnCount: 0,
              aiTurnLimit: 0,
              completedAt: new Date(),
            });
          }
        } else {
          setAttemptError('結果IDが指定されていません');
        }
      } catch (err) {
        console.error('[QuizResultClient] Attempt ロード失敗:', err);
        setAttemptError('データの読み込み中にエラーが発生しました');
      } finally {
        setAttemptLoading(false);
      }
    }

    loadAttempt();
  }, [attemptId, localId, quiz.id, quiz.questionCount, initialAttempt, initialAttemptError]);

  // 1. オンライン状態の監視
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOnline(navigator.onLine && !localId);
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

  // 2. ローカルデータの読み込み（早押しタイム、ヒント履歴）
  useEffect(() => {
    const key = attemptId || localId;
    if (key) {
      const savedTimes = localStorage.getItem(`quizetika_qp_times_${key}`);
      if (savedTimes) {
        setQuickPressTimes(JSON.parse(savedTimes));
        localStorage.removeItem(`quizetika_qp_times_${key}`);
      }

      const savedHints = localStorage.getItem(`quizetika_attempt_hints_${key}`);
      if (savedHints) {
        try {
          setRevealedHints(JSON.parse(savedHints));
        } catch (err) {
          console.error('[QuizResultClient] ヒント履歴のパース失敗:', err);
        }
      }

      // キャッシュクレンジング
      cleanOldHintsCache(key);
    }
  }, [attemptId, localId]);

  const cleanOldHintsCache = (currentAttemptId: string) => {
    const indexKey = 'quizetika_hints_cache_index';
    let index: { attemptId: string; timestamp: number }[] = [];
    try {
      const rawIndex = localStorage.getItem(indexKey);
      if (rawIndex) {
        index = JSON.parse(rawIndex);
      }
    } catch (e) {
      console.error('[QuizResultClient] キャッシュインデックスのロード失敗:', e);
    }

    const existingIdx = index.findIndex((item) => item.attemptId === currentAttemptId);
    if (existingIdx !== -1) {
      index[existingIdx].timestamp = Date.now();
    } else {
      index.push({ attemptId: currentAttemptId, timestamp: Date.now() });
    }

    index.sort((a, b) => b.timestamp - a.timestamp);

    if (index.length > 20) {
      const keep = index.slice(0, 20);
      const remove = index.slice(20);
      remove.forEach((item) => {
        localStorage.removeItem(`quizetika_attempt_hints_${item.attemptId}`);
      });
      index = keep;
    }

    localStorage.setItem(indexKey, JSON.stringify(index));
  };

  const userId = user?.id;
  const quizIdStr = quiz.id;
  const questionIdsStr = quiz.questions?.map((q) => q.id).join(',');
  const authorId = quiz.authorId;

  // ブブックマーク状態の読み込み
  useEffect(() => {
    if (!userId || !quizIdStr) {
      setBookmarkedQuestionIds(new Set());
      setBookmarkedQuizIds(new Set());
      return;
    }

    async function loadBookmarks() {
      try {
        const quizBookmarked = await isBookmarked(userId!, quizIdStr!);
        setBookmarkedQuizIds(new Set(quizBookmarked ? [quizIdStr!] : []));

        const questionIds = quiz.questions?.map((q) => q.id) || [];
        const bookmarkedIds: string[] = [];

        await Promise.all(
          questionIds.map(async (qId) => {
            try {
              const bookmarked = await isBookmarked(userId!, qId);
              if (bookmarked) {
                bookmarkedIds.push(qId);
              }
            } catch (err) {
              console.error(`Failed to load bookmark status for question ${qId}:`, err);
            }
          })
        );

        setBookmarkedQuestionIds(new Set(bookmarkedIds));
      } catch (err) {
        console.error('[QuizResultClient] ブックマークロード失敗:', err);
        setBookmarkedQuestionIds(new Set());
        setBookmarkedQuizIds(new Set());
      }
    }
    loadBookmarks();
  }, [userId, quizIdStr, questionIdsStr, quiz.questions]);

  // 作者のフォロー状態取得
  useEffect(() => {
    if (!userId || !authorId || userId === authorId) {
      setIsFollowingAuthor(false);
      return;
    }
    async function checkFollowStatus() {
      try {
        const following = await isFollowing(userId!, authorId!);
        setIsFollowingAuthor(following);
      } catch (err) {
        console.error('[QuizResultClient] フォロー状態の取得失敗:', err);
      }
    }
    checkFollowStatus();
  }, [userId, authorId]);

  // 指摘レポートの初期状態取得
  useEffect(() => {
    if (!userId || !quizIdStr) {
      setOpenReports([]);
      return;
    }
    async function loadOpenReports() {
      try {
        const reports = await getOpenReportsForQuiz(quizIdStr!, userId!);
        setOpenReports(reports);
      } catch (err) {
        console.error('[QuizResultClient] 指摘レポート取得失敗:', err);
        setOpenReports([]);
      }
    }
    loadOpenReports();
  }, [userId, quizIdStr]);

  // 良問投票（フィードバック）の初期状態取得
  useEffect(() => {
    if (!userId || !quizIdStr) {
      setVoted(null);
      return;
    }
    async function loadUserReview() {
      try {
        const voteType = await getUserReviewForQuiz(quizIdStr!, userId!);
        setVoted(voteType);
      } catch (err) {
        console.error('[QuizResultClient] ユーザーの投票状態取得失敗:', err);
        setVoted(null);
      }
    }
    loadUserReview();
  }, [userId, quizIdStr]);


  const myQuizSessionId = searchParams.get('sessionId');

  // カスタムクイズ連続プレイ判定
  const attemptMode = attempt?.mode;
  useEffect(() => {
    if (attemptMode !== 'my-quiz') return;
    const session = readMyQuizSession();
    if (session && myQuizSessionId && session.sessionId === myQuizSessionId) {
      setIsMyQuizFlow(true);
      const nextEntry = peekNextMyQuizEntry();
      if (nextEntry) {
        setNextMyQuizUrl(buildMyQuizPlayUrl(session, session.currentIndex + 1));
        setIsLastInMyQuiz(false);
        setMyQuizSessionMissing(false);
      } else {
        setNextMyQuizUrl(null);
        setIsLastInMyQuiz(true);
      }
      return;
    }
    setIsMyQuizFlow(true);
    setMyQuizSessionMissing(true);
  }, [attemptMode, myQuizSessionId]);

  useEffect(() => {
    if (isLastInMyQuiz && attemptMode === 'my-quiz') {
      clearMyQuizSession();
    }
  }, [isLastInMyQuiz, attemptMode]);

  // ローディングとエラー状態のハンドリング (全 Hooks の定義後に配置)
  if (attemptLoading) {
    return <ResultSkeleton data-testid="quiz-result-skeleton" />;
  }

  if (attemptError || !attempt) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '60px 0' }}>
        <h2 style={{ color: 'var(--text-main)' }}>{attemptError || '結果データが見つかりません'}</h2>
      </div>
    );
  }

  const handleNextMyQuizClick = () => {
    if (!online) {
      alert('現在オフラインのため、次の問題に進むことはできません。');
      return;
    }
    const nextEntry = advanceMyQuizSession();
    if (nextEntry) {
      const session = readMyQuizSession();
      if (session) {
        router.push(buildMyQuizPlayUrl(session, session.currentIndex));
      }
    }
  };

  const openFeedbackModal = (q: Question | null) => {
    if (!user) {
      const currentPath = window.location.pathname + window.location.search;
      router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }
    setSelectedQuestion(q);
    const targetId = q ? q.id : 'unknown';
    const existingReport = openReports.find((r) => r.questionId === targetId);
    if (existingReport) {
      setFeedbackCategory(existingReport.category);
      setFeedbackContent(existingReport.content);
    } else {
      setFeedbackCategory('typo');
      setFeedbackContent('');
    }
    setShowFeedbackModal(true);
  };

  const handleReviewVote = async (vote: 'positive' | 'negative') => {
    if (!user) {
      const currentPath = window.location.pathname + window.location.search;
      router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }
    if (!online) return;

    try {
      if (voted === vote) {
        // 同じボタンを再度押した場合 → 取り消し
        await retractReview(quiz.id, user.id);
        setVoted(null);
        setVoteToastMessage('↩️ 評価を取り消しました。');
      } else {
        // 未投票または反対の投票 → 新規投票 or 変更
        await submitReview(quiz.id, user.id, vote);
        setVoted(vote);
        const message =
          vote === 'positive'
            ? '👍 良問として評価しました！ありがとうございます。'
            : '👎 評価を送信しました。ご意見ありがとうございます。';
        setVoteToastMessage(message);
      }
      // 3秒後にトースト通知を消す
      setTimeout(() => setVoteToastMessage(null), 3000);
    } catch (e: any) {
      console.error('[QuizResultClient] 投票操作失敗:', e);
      alert(`操作に失敗しました: ${e.message || '不明なエラー'}`);
    }
  };

  const handleDifficultyVote = async (level: number) => {
    if (!user) {
      const currentPath = window.location.pathname + window.location.search;
      router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }
    if (!online) return;
    const oldDifficultyVote = difficultyVote;
    setDifficultyVote(level);
    try {
      if (attemptId) {
        const attRef = doc(db, 'attempts', attemptId);
        await updateDoc(attRef, { difficultyVote: level });
      }
    } catch (e: any) {
      console.error('[QuizResultClient] 難易度投票失敗:', e);
      alert(`難易度投票に失敗しました: ${e.message || '不明なエラー'}`);
      setDifficultyVote(oldDifficultyVote);
    }
  };

  const handleFollowToggle = async () => {
    if (!userId || !authorId || !online || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowingAuthor) {
        await unfollowUser(userId!, authorId!);
        setIsFollowingAuthor(false);
      } else {
        await followUser(userId!, authorId!);
        setIsFollowingAuthor(true);
      }
    } catch (err) {
      console.error('[QuizResultClient] フォロー操作失敗:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !feedbackContent.trim() || feedbackLoading || !online) return;

    setFeedbackLoading(true);
    try {
      const targetQuestionId = selectedQuestion ? selectedQuestion.id : 'unknown';
      const existingReport = openReports.find((r) => r.questionId === targetQuestionId);

      if (existingReport && existingReport.id) {
        await updateFeedbackReport(existingReport.id, feedbackCategory, feedbackContent);
      } else {
        const report: Omit<FeedbackReport, 'id' | 'status' | 'createdAt'> = {
          quizId: quiz.id,
          quizTitle: quiz.title,
          questionId: targetQuestionId,
          questionText: selectedQuestion ? selectedQuestion.questionText : '全体',
          reporterId: user.id,
          creatorId: quiz.authorId,
          category: feedbackCategory,
          content: feedbackContent,
        };
        await submitFeedbackReport(report);
      }

      const updatedReports = await getOpenReportsForQuiz(quiz.id, user.id);
      setOpenReports(updatedReports);

      setFeedbackSubmitted(true);
      setTimeout(() => {
        setShowFeedbackModal(false);
        setFeedbackSubmitted(false);
        setFeedbackContent('');
      }, 2000);
    } catch (e) {
      console.error('[QuizResultClient] 指摘送信・更新失敗:', e);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleCurrentQuizBookmarkToggle = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    try {
      const isCurrentlyBookmarked = bookmarkedQuizIds.has(quiz.id);
      await toggleBookmark(user.id, quiz.id, 'quiz');
      setBookmarkedQuizIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlyBookmarked) {
          next.delete(quiz.id);
        } else {
          next.add(quiz.id);
        }
        return next;
      });
    } catch (e) {
      console.error('[QuizResultClient] クイズブックマークトグル失敗:', e);
    }
  };

  const handleReportClick = () => {
    if (!user) {
      router.push('/login');
      return;
    }
    setShowReportModal(true);
  };

  const isQuickPressQuiz = quiz.format === 'quick-press' || (quiz.questions?.some((q) => q.type === 'quick-press') ?? false);
  let averagePressTime = 0;
  let fastestPressTime = 0;
  let showPressStats = false;

  if (isQuickPressQuiz && quickPressTimes && Object.keys(quickPressTimes).length > 0) {
    const times = Object.values(quickPressTimes);
    if (times.length > 0) {
      const sum = times.reduce((acc, t) => acc + t, 0);
      averagePressTime = Number((sum / times.length).toFixed(2));
      fastestPressTime = Number(Math.min(...times).toFixed(2));
      showPressStats = true;
    }
  }

  const diffVal = typeof quiz.difficulty === 'number' ? quiz.difficulty : parseInt(quiz.difficulty as any || '0', 10);
  const diffNum = isNaN(diffVal) ? 0 : diffVal;

  return (
    <>
      {/* 優しいオフライン警告ヘッダー */}
      {!online && (
        <div className={styles.offlineAlert}>
          <SecurityOutlined sx={{ fontSize: 24 }} style={{ color: '#ff007f' }} />
          <div className={styles.offlineText}>
            現在オフラインのため、良問評価や間違い指摘、作家リアクションは送信できません。
          </div>
        </div>
      )}

      {/* スコア結果サマリー */}
      <div className={styles.summaryCard}>
        <div className={styles.summaryDifficultyBadge} data-testid="quiz-result-difficulty">
          <span>難易度:</span>
          <span className={styles.difficultyStars}>
            <span style={{ color: getDifficultyColor(diffNum) }}>{'★'.repeat(diffNum)}</span>
            <span style={{ color: 'var(--text-muted)' }}>{'☆'.repeat(Math.max(0, 5 - diffNum))}</span>
          </span>
        </div>

        <div className={styles.summaryBookmarkWrap}>
          <button
            className={`${styles.summaryBookmarkBtn} ${bookmarkedQuizIds.has(quiz.id) ? styles.summaryBookmarkBtnActive : ''}`}
            onClick={handleCurrentQuizBookmarkToggle}
            data-testid="quiz-result-bookmark-btn"
            aria-label="クイズをブックマーク"
            type="button"
          >
            {bookmarkedQuizIds.has(quiz.id) ? (
              <BookmarkRounded sx={{ fontSize: 24, color: '#00ff66' }} />
            ) : (
              <BookmarkBorderOutlined sx={{ fontSize: 24 }} />
            )}
          </button>
        </div>

        <div className={styles.scoreCircle} data-testid="quiz-result-score-circle">
          <span className={styles.scoreVal}>{attempt.score}</span>
          <span className={styles.scoreLabel}>/ {attempt.totalQuestions} 問 正解</span>
        </div>

        <h1 className={styles.resultTitle}>
          {attempt.score === attempt.totalQuestions
            ? '🎉 パーフェクト達成！素晴らしい！'
            : '👍 お疲れ様でした！ナイスプレイ！'}
        </h1>

        <p style={{ margin: '-12px 0 0 0', fontSize: '0.95rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          作者: <Link href={`/profile/${quiz.authorId}`} style={{ color: 'var(--color-primary)', textDecoration: 'underline', fontWeight: 600 }}>{quiz.authorName || '作成者'}</Link>
          {user && user.id !== quiz.authorId && (
            <button
              className={`btn ${isFollowingAuthor ? 'btn-secondary' : 'btn-accent'}`}
              style={{
                padding: '2px 8px',
                fontSize: '0.75rem',
                height: 'auto',
                minHeight: 'unset',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onClick={handleFollowToggle}
              disabled={!online || followLoading}
              data-testid="author-follow-btn"
              data-analytics="quiz-result-follow-author"
            >
              {isFollowingAuthor ? (
                <>
                  <HowToRegOutlined sx={{ fontSize: 12 }} /> フォロー中
                </>
              ) : (
                <>
                  <PersonAddOutlined sx={{ fontSize: 12 }} /> フォロー
                </>
              )}
            </button>
          )}
        </p>

        <div className={styles.metaStats}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            ⏱️ 経過秒数: <strong>{attempt.elapsedSeconds}</strong> 秒
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            🎯 クリア率: <strong>{Math.round((attempt.score / attempt.totalQuestions) * 100)}</strong>%
          </span>
          {quiz.format === 'lateral-thinking' && attempt.aiTurnCount !== undefined && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              💬 質問回数: <strong>{attempt.aiTurnCount}</strong> 回
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '300px', marginTop: '8px' }}>
          <Link
            href={`/quiz/${quiz.id}`}
            className="btn btn-primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            data-testid="quiz-replay-btn"
            data-analytics="quiz-result-replay"
          >
            もう一度プレイする
          </Link>
        </div>
      </div>

      {/* 早押し統計カード */}
      {showPressStats && (
        <div style={{
          background: 'var(--glass-bg)',
          border: 'var(--glass-border)',
          backdropFilter: 'var(--glass-blur)',
          padding: '24px 32px',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          gap: '20px',
          flexWrap: 'wrap',
          boxShadow: '0 0 20px rgba(0, 245, 212, 0.05)',
          borderLeft: '4px solid var(--color-accent)',
          marginTop: '8px',
          marginBottom: '8px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '4px' }}>⚡ 平均早押しタイム</span>
            <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-accent)' }}>{averagePressTime} <span style={{ fontSize: '1rem' }}>秒</span></span>
          </div>
          <div style={{ width: '1px', height: '40px', background: 'var(--border-light)' }}></div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '4px' }}>🏆 最速早押しタイム</span>
            <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{fastestPressTime} <span style={{ fontSize: '1rem' }}>秒</span></span>
          </div>
          <div style={{ width: '1px', height: '40px', background: 'var(--border-light)' }}></div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '4px' }}>🎯 早押し正答数</span>
            <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{Object.keys(quickPressTimes || {}).length} <span style={{ fontSize: '1rem' }}>問</span></span>
          </div>
        </div>
      )}

      {/* 評価フィードバックパネル */}
      <div className={styles.feedbackPanel}>
        {quiz.isReviewMasked && (
          <div className={styles.maskedAlert}>
            <WarningAmberOutlined sx={{ fontSize: 18, color: '#ffb703' }} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.9rem', color: '#ffb703', fontWeight: 600 }}>
              ⚠️ 修正に伴う再評価期間中
            </span>
          </div>
        )}
        <h2 className={styles.panelTitle}>クイズの品質向上にご協力ください</h2>

        <div className={styles.voteRow}>
          <span className={styles.voteLabel}>このクイズはどうでしたか？</span>
          <div className={styles.btnGroup}>
            <button
              className={`${styles.voteBtn} ${voted === 'positive' ? styles.voteActive : ''}`}
              onClick={() => handleReviewVote('positive')}
              disabled={!online || user?.id === quiz.authorId}
              title={voted === 'positive' ? 'クリックで取り消す' : '良問として評価する'}
              data-analytics="quiz-review-vote-positive"
            >
              <ThumbUpOutlined sx={{ fontSize: 16 }} /> 良問
            </button>
            <button
              className={`${styles.voteBtn} ${voted === 'negative' ? styles.voteActive : ''}`}
              onClick={() => handleReviewVote('negative')}
              disabled={!online || user?.id === quiz.authorId}
              title={voted === 'negative' ? 'クリックで取り消す' : '微妙として評価する'}
              data-analytics="quiz-review-vote-negative"
            >
              <ThumbDownOutlined sx={{ fontSize: 16 }} /> 微妙
            </button>
          </div>
        </div>

        {/* 投票成功トースト通知 */}
        {voteToastMessage && (
          <div className={voteToastMessage.startsWith('↩️') ? styles.voteToastNeutral : styles.voteToast}>
            {voteToastMessage}
          </div>
        )}

        {/* 難易度投票 (1 - 5) */}
        <div className={styles.difficultyVoteSection}>
          <span className={styles.voteLabel}>体感の難易度を評価してください (1: 簡単 〜 5: 激難)</span>

          <DifficultyVoteStars
            value={difficultyVote}
            onVote={handleDifficultyVote}
            disabled={!online}
          />
        </div>

        {/* 指摘・通報ボタン */}
        <div className={styles.actionBtnRow}>
          <button
            className={`btn ${openReports.some((r) => r.questionId === 'unknown') ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              flex: 1,
              ...(openReports.some((r) => r.questionId === 'unknown') ? { background: '#ffb703', borderColor: '#ffb703', color: '#1a1a2e' } : {})
            }}
            onClick={() => openFeedbackModal(null)}
            disabled={!online}
          >
            <SmsOutlined sx={{ fontSize: 16 }} /> {openReports.some((r) => r.questionId === 'unknown') ? 'クイズ全体の指摘 (指摘済)' : 'クイズ全体の指摘'}
          </button>
          <button
            className="btn btn-secondary"
            style={{ flex: 1, borderColor: 'rgba(255, 0, 127, 0.3)', color: '#ff007f' }}
            onClick={handleReportClick}
            disabled={!online}
            data-testid="quiz-report-btn"
            data-analytics="quiz-report-open"
          >
            <WarningAmberOutlined sx={{ fontSize: 16 }} /> クイズを通報
          </button>
        </div>

        {/* カスタムクイズ連続プレイ */}
        {isMyQuizFlow && (
          <div className={styles.listNavigation}>
            {myQuizSessionMissing ? (
              <div style={{ textAlign: 'center', padding: '16px', marginTop: '16px', color: 'var(--text-muted)', background: 'var(--glass-bg)', borderRadius: 'var(--radius-md)' }}>
                <p>カスタムクイズの続きを再生できません。</p>
                <Link href="/my-quiz" className="btn btn-secondary" style={{ marginTop: '12px', display: 'inline-flex' }}>
                  カスタムクイズへ戻る
                </Link>
              </div>
            ) : nextMyQuizUrl ? (
              <button
                className="btn btn-primary"
                onClick={handleNextMyQuizClick}
                data-testid="my-quiz-next"
                style={{ width: '100%', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <span>次の問題へ</span>
                <ChevronRightOutlined sx={{ fontSize: 18 }} />
              </button>
            ) : isLastInMyQuiz ? (
              <div className={styles.listClearMessage} style={{ background: 'rgba(0, 245, 212, 0.05)', border: '1px solid rgba(0, 245, 212, 0.2)', padding: '20px', borderRadius: 'var(--radius-md)', textAlign: 'center', marginTop: '16px' }}>
                <p style={{ color: 'var(--color-accent)', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '12px' }}>
                  カスタムクイズを完了しました！
                </p>
                <Link href="/my-quiz" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  カスタムクイズへ戻る
                </Link>
              </div>
            ) : null}
          </div>
        )}

      </div>

      {/* 問題正誤リストおよび解説表示 */}
      <section className={styles.questionsList}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-main)' }}>
          問題ごとの解説
        </h2>

        {(quiz.questions ?? []).map((q, idx) => {
          const isCorrect = !attempt.failedQuestionIds.includes(q.id);
          const hasStoredAnswers = (attempt.questionAnswers?.length ?? 0) > 0;
          return (
            <article key={q.id} className={styles.questionItem}>
              <div className={styles.itemHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                    第 {idx + 1} 問
                  </h3>
                  {isCorrect ? (
                    <span className={styles.correctLabel}>
                      <CheckOutlined sx={{ fontSize: 16 }} /> 正解
                    </span>
                  ) : (
                    <span className={styles.incorrectLabel}>
                      <CloseOutlined sx={{ fontSize: 16 }} /> 不正解
                    </span>
                  )}
                  {isCorrect && quickPressTimes && quickPressTimes[q.id] !== undefined && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: 'rgba(0, 245, 212, 0.12)',
                      color: 'var(--color-accent)',
                      border: '1px solid rgba(0, 245, 212, 0.25)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.78rem',
                      fontWeight: 'bold',
                      gap: '4px'
                    }}>
                      ⚡ 早押し: {quickPressTimes[q.id]}秒
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <QuestionBookmarkToggle
                    questionId={q.id}
                    initialBookmarked={bookmarkedQuestionIds.has(q.id)}
                    onToggle={(bookmarked) => {
                      setBookmarkedQuestionIds((prev) => {
                        const next = new Set(prev);
                        if (bookmarked) next.add(q.id);
                        else next.delete(q.id);
                        return next;
                      });
                    }}
                  />
                  <button
                    className="btn btn-outline"
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.8rem',
                      borderColor: '#ffb703',
                      color: openReports.some((r) => r.questionId === q.id) ? '#1a1a2e' : '#ffb703',
                      background: openReports.some((r) => r.questionId === q.id) ? '#ffb703' : 'transparent'
                    }}
                    onClick={() => openFeedbackModal(q)}
                    disabled={!online}
                  >
                    <SmsOutlined sx={{ fontSize: 12, marginRight: '4px', display: 'inline', verticalAlign: 'text-bottom' }} />
                    {openReports.some((r) => r.questionId === q.id) ? '問題指摘済' : 'この問題を指摘'}
                  </button>
                </div>
              </div>

              <MarkdownContent
                markdown={q.questionText}
                className={styles.questionTextResult}
              />

              <ResultQuestionDetailsAccordion questionId={q.id}>
                <div className={styles.answerSummary}>
                  <div className={styles.answerRow}>
                    <span className={styles.answerLabel}>あなたの回答</span>
                    <span className={`${styles.answerValue} ${isCorrect ? styles.answerValueCorrect : styles.answerValueIncorrect}`}>
                      {formatUserAnswer(
                        q,
                        getUserAnswerRaw(attempt.questionAnswers, q.id),
                        attempt.mode,
                        hasStoredAnswers
                      )}
                    </span>
                  </div>
                  <div className={styles.answerRow}>
                    <span className={styles.answerLabel}>正解</span>
                    <span className={`${styles.answerValue} ${styles.answerValueCorrect}`}>
                      {formatCorrectAnswer(q)}
                    </span>
                  </div>
                </div>

                {q.explanation && (
                  <div className={styles.explanationBox}>
                    <div className={styles.explanationTitle}>💡 解説</div>
                    <div
                      className="prose max-w-none dark:prose-invert"
                      style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: '1.6' }}
                      dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(q.explanation) }}
                    />
                  </div>
                )}

                {q.type === 'association' && (() => {
                  const questionHintData = revealedHints.find((h) => h.questionId === q.id);
                  const hintsToShow = questionHintData?.revealedHints || [];
                  return (
                    <div className={styles.hintHistoryBox}>
                      <div className={styles.hintHistoryTitle}>🔍 開示したヒント ({hintsToShow.length}件)</div>
                      {hintsToShow.length > 0 ? (
                        <ul className={styles.hintHistoryList}>
                          {hintsToShow.map((hint, hIdx) => (
                            <li key={hIdx} className={styles.hintHistoryItem}>
                              ヒント {hIdx + 1}: {hint}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className={styles.hintHistoryEmpty}>ヒントは表示されませんでした。</p>
                      )}
                    </div>
                  );
                })()}
              </ResultQuestionDetailsAccordion>
            </article>
          );
        })}
      </section>

      {/* おすすめクイズ表示エリア */}
      <section className={styles.recommendSection} data-testid="author-quizzes-section">
        <h2 style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '16px' }}>
          この作者の他のクイズ
        </h2>
        <div key="quiz-recommend-children-wrapper">
          {recommendChildren}
        </div>
      </section>

      {/* 間違い指摘モーダル */}
      {showFeedbackModal && (
        <div className={styles.modalOverlay} onClick={() => setShowFeedbackModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              <WarningAmberOutlined sx={{ fontSize: 18, color: '#ffb703' }} />
              問題の間違い・別解の指摘
            </h3>

            {feedbackSubmitted ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-accent)' }}>
                <CheckCircleOutlined sx={{ fontSize: 32 }} style={{ margin: '0 auto 12px' }} />
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
                    {selectedQuestion !== null && (
                      <option value="alternative">別解の追加要望</option>
                    )}
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

      {/* 通報モーダル */}
      {user && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          quizId={quiz.id}
          reporterId={user.id}
        />
      )}
    </>
  );
}

export function QuizResultClientBoundary(props: QuizResultClientProps) {
  return (
    <Suspense fallback={<ResultSkeleton data-testid="quiz-result-skeleton" />}>
      <QuizResultClient {...props} />
    </Suspense>
  );
}
