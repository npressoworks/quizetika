'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, X, ShieldAlert, Award, ThumbsUp, ThumbsDown, MessageSquare, AlertTriangle, ArrowLeft, Trophy, CheckCircle, ChevronRight, Bookmark, UserPlus, UserCheck } from 'lucide-react';
import { parseMarkdownToHtml } from '@/lib/security/sanitize';
import { MarkdownContent } from '@/components/markdown/markdown-content';
import { useAuth } from '@/context/auth-context';
import { getDifficultyColor } from '@/lib/difficulty-color';
import { getQuiz, getQuizzesByAuthor } from '@/services/quiz';
import { getQuizList } from '@/services/quiz-list';
import { submitReview, submitFeedbackReport, getOpenReportsForQuiz, updateFeedbackReport } from '@/services/review';
import { isFollowing, followUser, unfollowUser } from '@/services/user';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getPendingSyncAttempts } from '@/services/attempt-session';
import { formatCorrectAnswer, formatUserAnswer, getUserAnswerRaw } from '@/services/attempt-answer-display';
import { Quiz, Attempt, FeedbackReport, Question } from '@/types';
import { getBookmarkFeed, toggleBookmark, isBookmarked } from '@/services/bookmark';
import { QuestionBookmarkToggle } from '@/components/bookmark/question-bookmark-toggle';
import { QuizCard } from '@/components/quiz/quiz-card';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { ReportModal } from '@/components/quiz/report-modal';
import {
  readQuestionListSession,
  advanceQuestionListSession,
  clearQuestionListSession,
  buildQuestionListPlayUrl,
  peekNextQuestionListEntry,
} from '@/lib/question-list-session';
import styles from './result.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface ContentProps {
  quizId: string;
}

export function QuizResultPageContent({ quizId }: ContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const attemptId = searchParams.get('attemptId');
  const localId = searchParams.get('localId');

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [online, setOnline] = useState<boolean>(true);
  const [quickPressTimes, setQuickPressTimes] = useState<{ [questionId: string]: number } | null>(null);

  // 投票・リアクション状況
  const [voted, setVoted] = useState<'positive' | 'negative' | null>(null);
  const [difficultyVote, setDifficultyVote] = useState<number | null>(null);
  const [isFollowingAuthor, setIsFollowingAuthor] = useState<boolean>(false);
  const [followLoading, setFollowLoading] = useState<boolean>(false);
  const [feedbackCategory, setFeedbackCategory] = useState<'typo' | 'fact' | 'alternative'>('typo');
  const [feedbackContent, setFeedbackContent] = useState<string>('');
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [feedbackLoading, setFeedbackLoading] = useState<boolean>(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);
  const [openReports, setOpenReports] = useState<FeedbackReport[]>([]);

  // リストの連続プレイ用
  const listId = searchParams.get('listId');
  const [nextQuizId, setNextQuizId] = useState<string | null>(null);
  const [isLastInList, setIsLastInList] = useState<boolean>(false);
  const [listLoading, setListLoading] = useState<boolean>(false);
  const [isQuestionListFlow, setIsQuestionListFlow] = useState(false);
  const [nextQuestionListUrl, setNextQuestionListUrl] = useState<string | null>(null);
  const [isLastInQuestionList, setIsLastInQuestionList] = useState(false);
  const [questionListSessionMissing, setQuestionListSessionMissing] = useState(false);
  const [bookmarkedQuestionIds, setBookmarkedQuestionIds] = useState<Set<string>>(new Set());
  const [bookmarkedQuizIds, setBookmarkedQuizIds] = useState<Set<string>>(new Set());

  // 連想クイズの表示ヒント履歴用
  const [revealedHints, setRevealedHints] = useState<{ questionId: string; revealedHints: string[]; revealedCount: number }[]>([]);

  // 同一作者のおすすめクイズ用
  const [recommendQuizzes, setRecommendQuizzes] = useState<Quiz[]>([]);
  const [recommendLoading, setRecommendLoading] = useState<boolean>(true);
  const [recommendError, setRecommendError] = useState<string | null>(null);

  // 通報モーダル表示用
  const [showReportModal, setShowReportModal] = useState<boolean>(false);

  // 特定の問題に対する間違い指摘用
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);

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
              questionAnswers: localAtt.questionAnswers,
              difficultyVote: localAtt.difficultyVote,
              aiTurnCount: localAtt.aiTurnCount,
              aiTurnLimit: localAtt.aiTurnLimit,
              completedAt: new Date(localAtt.completedAt),
            });
            setDifficultyVote(localAtt.difficultyVote ?? null);
          }
        }

        // 早押しタイムを localStorage からロードしてクリア
        const key = attemptId || localId;
        if (key) {
          const savedTimes = localStorage.getItem(`quizeum_qp_times_${key}`);
          if (savedTimes) {
            setQuickPressTimes(JSON.parse(savedTimes));
            localStorage.removeItem(`quizeum_qp_times_${key}`);
          }

          // 連想クイズのヒント履歴をロード
          const savedHints = localStorage.getItem(`quizeum_attempt_hints_${key}`);
          if (savedHints) {
            try {
              setRevealedHints(JSON.parse(savedHints));
            } catch (err) {
              console.error('[QuizResult] ヒント履歴のパース失敗:', err);
            }
          }

          // ヒント履歴キャッシュのクレンジング処理を実行
          cleanOldHintsCache(key);
        }
      } catch (e) {
        console.error('[QuizResult] ロード失敗:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [quizId, attemptId, localId]);

  // ヒント履歴キャッシュのクレンジング処理
  const cleanOldHintsCache = (currentAttemptId: string) => {
    const indexKey = 'quizeum_hints_cache_index';
    let index: { attemptId: string; timestamp: number }[] = [];
    try {
      const rawIndex = localStorage.getItem(indexKey);
      if (rawIndex) {
        index = JSON.parse(rawIndex);
      }
    } catch (e) {
      console.error('[QuizResult] キャッシュインデックスのロード失敗:', e);
    }

    const existingIdx = index.findIndex((item) => item.attemptId === currentAttemptId);
    if (existingIdx !== -1) {
      index[existingIdx].timestamp = Date.now();
    } else {
      index.push({ attemptId: currentAttemptId, timestamp: Date.now() });
    }

    // タイムスタンプ降順ソート
    index.sort((a, b) => b.timestamp - a.timestamp);

    // 20件を超える古いキャッシュを削除
    if (index.length > 20) {
      const keep = index.slice(0, 20);
      const remove = index.slice(20);
      remove.forEach((item) => {
        localStorage.removeItem(`quizeum_attempt_hints_${item.attemptId}`);
      });
      index = keep;
    }

    localStorage.setItem(indexKey, JSON.stringify(index));
  };

  const userId = user?.id;
  const quizIdStr = quiz?.id;
  const questionIdsStr = quiz?.questions?.map((q) => q.id).join(',');
  const authorId = quiz?.authorId;

  useEffect(() => {
    if (!userId || !quizIdStr) {
      setBookmarkedQuestionIds(new Set());
      setBookmarkedQuizIds(new Set());
      return;
    }

    async function loadBookmarks() {
      try {
        // 現在のクイズ全体のブックマーク状態を取得
        const quizBookmarked = await isBookmarked(userId!, quizIdStr!);
        setBookmarkedQuizIds(new Set(quizBookmarked ? [quizIdStr!] : []));

        // 各問題のブックマーク状態を取得
        const questionIds = quiz?.questions?.map((q) => q.id) || [];
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
        console.error('[QuizResult] ブックマークロード失敗:', err);
        setBookmarkedQuestionIds(new Set());
        setBookmarkedQuizIds(new Set());
      }
    }
    loadBookmarks();
  }, [userId, quizIdStr, questionIdsStr]);

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
        console.error('[QuizResult] フォロー状態の取得失敗:', err);
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
        console.error('[QuizResult] 指摘レポート取得失敗:', err);
        setOpenReports([]);
      }
    }
    loadOpenReports();
  }, [userId, quizIdStr]);

  // 同じ作者のおすすめクイズを取得
  useEffect(() => {
    if (!authorId) return;
    async function loadRecommend() {
      try {
        setRecommendLoading(true);
        const quizzes = await getQuizzesByAuthor(authorId!);
        // 自分（今プレイしたクイズ）を除外して最大3件
        const filtered = quizzes.filter((q) => q.id !== quizIdStr).slice(0, 3);
        setRecommendQuizzes(filtered);
        setRecommendError(null);
      } catch (e) {
        console.error('[QuizResult] おすすめクイズのロード失敗:', e);
        setRecommendError('おすすめクイズの読み込みに失敗しました。');
      } finally {
        setRecommendLoading(false);
      }
    }
    loadRecommend();
  }, [authorId, quizIdStr]);

  // 2.5 リスト内の次問題／次クイズ判定（問題リストを優先）
  const hasQuiz = !!quiz;
  const attemptMode = attempt?.mode;
  useEffect(() => {
    if (!listId || !hasQuiz) return;

    const session = readQuestionListSession();
    if (session && session.listId === listId) {
      setIsQuestionListFlow(true);
      setListLoading(false);
      const nextEntry = peekNextQuestionListEntry();
      if (nextEntry) {
        const nextIndex = session.currentIndex + 1;
        setNextQuestionListUrl(buildQuestionListPlayUrl(session, nextIndex));
        setIsLastInQuestionList(false);
        setQuestionListSessionMissing(false);
      } else {
        setNextQuestionListUrl(null);
        setIsLastInQuestionList(true);
      }
      return;
    }

    if (attemptMode === 'question-list') {
      setIsQuestionListFlow(true);
      setQuestionListSessionMissing(true);
      setListLoading(false);
      return;
    }

    async function checkNextQuiz() {
      setListLoading(true);
      try {
        const listData = await getQuizList(listId!);
        if (listData && listData.quizIds) {
          const currentIdx = listData.quizIds.indexOf(quizId);
          if (currentIdx !== -1) {
            if (currentIdx < listData.quizIds.length - 1) {
              setNextQuizId(listData.quizIds[currentIdx + 1]);
              setIsLastInList(false);
            } else {
              setNextQuizId(null);
              setIsLastInList(true);
            }
          }
        }
      } catch (err) {
        console.error('[QuizResult] クイズリスト情報判定失敗:', err);
      } finally {
        setListLoading(false);
      }
    }
    checkNextQuiz();
  }, [listId, hasQuiz, quizId, attemptMode]);

  useEffect(() => {
    if (isLastInQuestionList) {
      clearQuestionListSession();
    }
  }, [isLastInQuestionList]);

  // 次のクイズに進むアクションハンドラ (オフライン接続ブロック付)
  const handleNextQuizClick = () => {
    if (!online) {
      alert('現在オフラインのため、リストの次のクイズに進むことはできません。ネットワーク接続が復旧してから移動してください。');
      return;
    }
    if (nextQuizId) {
      router.push(`/quiz/${nextQuizId}/play?listId=${listId}&mode=list`);
    }
  };

  const handleNextQuestionClick = () => {
    if (!online) {
      alert('現在オフラインのため、次の問題に進むことはできません。');
      return;
    }
    const nextEntry = advanceQuestionListSession();
    if (nextEntry) {
      const session = readQuestionListSession();
      if (session) {
        router.push(buildQuestionListPlayUrl(session, session.currentIndex));
      }
    }
  };

  // 個別の問題間違い指摘モーダル起動
  const openFeedbackModal = (q: Question | null) => {
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

  // 作者のフォロー/フォロー解除トグル
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
      console.error('[QuizResult] フォロー操作失敗:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  // 間違い指摘送信
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !quiz || !feedbackContent.trim() || feedbackLoading || !online) return;

    setFeedbackLoading(true);
    try {
      const targetQuestionId = selectedQuestion ? selectedQuestion.id : 'unknown';
      const existingReport = openReports.find((r) => r.questionId === targetQuestionId);

      if (existingReport && existingReport.id) {
        // 既存の指摘を更新
        await updateFeedbackReport(existingReport.id, feedbackCategory, feedbackContent);
      } else {
        // 新規作成
        const report: Omit<FeedbackReport, 'id' | 'status' | 'createdAt'> = {
          quizId: quiz!.id,
          quizTitle: quiz!.title,
          questionId: targetQuestionId,
          questionText: selectedQuestion ? selectedQuestion.questionText : '全体',
          reporterId: user.id,
          creatorId: quiz!.authorId,
          category: feedbackCategory,
          content: feedbackContent,
        };
        await submitFeedbackReport(report);
      }

      // 指摘レポート一覧を再取得
      const updatedReports = await getOpenReportsForQuiz(quiz!.id, user.id);
      setOpenReports(updatedReports);

      setFeedbackSubmitted(true);
      setTimeout(() => {
        setShowFeedbackModal(false);
        setFeedbackSubmitted(false);
        setFeedbackContent('');
      }, 2000);
    } catch (e) {
      console.error('[QuizResult] 指摘送信・更新失敗:', e);
    } finally {
      setFeedbackLoading(false);
    }
  };

  // 現クイズのブックマークトグル
  const handleCurrentQuizBookmarkToggle = async () => {
    if (!user || !quiz) {
      router.push('/login');
      return;
    }
    try {
      const isCurrentlyBookmarked = bookmarkedQuizIds.has(quiz!.id);
      await toggleBookmark(user.id, quiz!.id, 'quiz');
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
      console.error('[QuizResult] クイズブックマークトグル失敗:', e);
    }
  };

  // おすすめクイズのブックマークトグル
  const handleRecommendBookmarkToggle = async (targetQuizId: string) => {
    if (!user) {
      router.push('/login');
      return;
    }
    try {
      const isCurrentlyBookmarked = bookmarkedQuizIds.has(targetQuizId);
      await toggleBookmark(user.id, targetQuizId, 'quiz');
      setBookmarkedQuizIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlyBookmarked) {
          next.delete(targetQuizId);
        } else {
          next.add(targetQuizId);
        }
        return next;
      });
    } catch (e) {
      console.error('[QuizResult] おすすめクイズブックマークトグル失敗:', e);
    }
  };

  // おすすめクイズのプレイクリック
  const handleRecommendPlayClick = (targetQuizId: string) => {
    router.push(`/quiz/${targetQuizId}`);
  };

  // 通報ボタンクリック
  const handleReportClick = () => {
    if (!user) {
      router.push('/login');
      return;
    }
    setShowReportModal(true);
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

  // 早押しタイム統計の計算
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
        <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
          <button
            className={`${styles.summaryBookmarkBtn} ${bookmarkedQuizIds.has(quiz.id) ? styles.summaryBookmarkBtnActive : ''}`}
            onClick={handleCurrentQuizBookmarkToggle}
            data-testid="quiz-result-bookmark-btn"
            aria-label="クイズをブックマーク"
            type="button"
          >
            <Bookmark
              size={24}
              color={bookmarkedQuizIds.has(quiz.id) ? '#00ff66' : 'currentColor'}
              fill={bookmarkedQuizIds.has(quiz.id) ? '#00ff66' : 'none'}
            />
          </button>
        </div>

        <div className={styles.scoreCircle}>
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
            >
              {isFollowingAuthor ? (
                <>
                  <UserCheck size={12} /> フォロー中
                </>
              ) : (
                <>
                  <UserPlus size={12} /> フォロー
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
          {(() => {
            const diffVal = typeof quiz.difficulty === 'number' ? quiz.difficulty : parseInt(quiz.difficulty as any || '0', 10);
            const diffNum = isNaN(diffVal) ? 0 : diffVal;
            return (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'monospace' }}>
                難易度:
                <span style={{ color: getDifficultyColor(diffNum) }}>
                  {'★'.repeat(diffNum)}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {'☆'.repeat(Math.max(0, 5 - diffNum))}
                </span>
              </span>
            );
          })()}
        </div>

        <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '300px', marginTop: '8px' }}>
          <Link
            href={`/quiz/${quiz.id}`}
            className="btn btn-primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            data-testid="quiz-replay-btn"
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
          borderLeft: '4px solid #00f5d4',
          marginTop: '8px',
          marginBottom: '8px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '4px' }}>⚡ 平均早押しタイム</span>
            <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#00f5d4' }}>{averagePressTime} <span style={{ fontSize: '1rem' }}>秒</span></span>
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

      {/* 評価フィードバックパネル (オンライン時のみフル利用可能) */}
      <div className={styles.feedbackPanel}>
        {/* 再評価期間中の表示：作成者がリセット申請し、7日間の仮リセット期間中の場合は警告バッジを表示 */}
        {quiz.isReviewMasked && (
          <div className={styles.maskedAlert}>
            <AlertTriangle size={18} style={{ color: '#ffb703', flexShrink: 0 }} />
            <span style={{ fontSize: '0.9rem', color: '#ffb703', fontWeight: 600 }}>
              ⚠️ 修正に伴う再評価期間中（過去の評価や「要改善」バッジは一時的にマスクされています）
            </span>
          </div>
        )}
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
              <ThumbsUp size={16} /> 良問
            </button>
            <button
              className={`${styles.voteBtn} ${voted === 'negative' ? styles.voteActive : ''}`}
              onClick={() => handleReviewVote('negative')}
              disabled={!online || voted !== null || user?.id === quiz.authorId}
            >
              <ThumbsDown size={16} /> 微妙
            </button>
          </div>
        </div>

        {/* 2. 難易度投票 (1 - 5) */}
        <div className={styles.difficultyVoteSection}>
          <span className={styles.voteLabel}>あなたが感じた体感難易度を投票してください (1: 簡単 〜 5: 激難)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontFamily: 'monospace' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>あなたの投票: </span>
            {difficultyVote !== null ? (
              <span>
                <span style={{ color: getDifficultyColor(difficultyVote) }}>
                  {'★'.repeat(difficultyVote)}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {'☆'.repeat(Math.max(0, 5 - difficultyVote))}
                </span>
                <span style={{ marginLeft: '8px', fontWeight: 'bold', color: 'var(--text-main)' }}>({difficultyVote})</span>
              </span>
            ) : (
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>未投票</span>
            )}
          </div>
          <div className={styles.difficultyBar}>
            {Array.from({ length: 5 }, (_, i) => i + 1).map((level) => (
              <button
                key={level}
                className={`${styles.diffCell} ${difficultyVote === level ? styles.diffCellSelected : ''}`}
                style={{
                  borderColor: difficultyVote === level ? getDifficultyColor(level) : 'var(--border-light)',
                  boxShadow: difficultyVote === level ? `0 0 8px ${getDifficultyColor(level)}` : 'none',
                  color: difficultyVote === level ? '#fff' : getDifficultyColor(level),
                  background: difficultyVote === level ? getDifficultyColor(level) : 'rgba(255, 255, 255, 0.02)'
                }}
                onClick={() => handleDifficultyVote(level)}
                disabled={!online}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* 3. 指摘・お礼・通報リアクションバー */}
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
            <MessageSquare size={16} /> {openReports.some((r) => r.questionId === 'unknown') ? 'クイズ全体の指摘 (指摘済)' : 'クイズ全体の指摘'}
          </button>
          <button
            className="btn btn-secondary"
            style={{ flex: 1, borderColor: 'rgba(255, 0, 127, 0.3)', color: '#ff007f' }}
            onClick={handleReportClick}
            disabled={!online}
            data-testid="quiz-report-btn"
          >
            <AlertTriangle size={16} /> クイズを通報
          </button>
        </div>

        {/* リスト連続プレイナビゲーション */}
        {listId && (
          <div className={styles.listNavigation}>
            {isQuestionListFlow ? (
              questionListSessionMissing ? (
                <div style={{ textAlign: 'center', padding: '16px', marginTop: '16px', color: 'var(--text-muted)', background: 'var(--glass-bg)', borderRadius: 'var(--radius-md)' }}>
                  <p>リストの続きを再生できません。</p>
                  <Link href={`/list/${listId}`} className="btn btn-secondary" style={{ marginTop: '12px', display: 'inline-flex' }}>
                    リストの詳細へ
                  </Link>
                </div>
              ) : nextQuestionListUrl ? (
                <button
                  className="btn btn-primary"
                  onClick={handleNextQuestionClick}
                  data-testid="question-list-next"
                  style={{ width: '100%', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <span>次の問題へ</span>
                  <ChevronRight size={18} />
                </button>
              ) : isLastInQuestionList ? (
                <div className={styles.listClearMessage} style={{ background: 'rgba(0, 245, 212, 0.05)', border: '1px solid rgba(0, 245, 212, 0.2)', padding: '20px', borderRadius: 'var(--radius-md)', textAlign: 'center', marginTop: '16px' }}>
                  <p style={{ color: '#00f5d4', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '12px' }}>
                    🎉 問題リストのすべての問題を完遂しました！
                  </p>
                  <Link
                    href={`/list/${listId}`}
                    className="btn btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => clearQuestionListSession()}
                  >
                    リストの詳細に戻る
                  </Link>
                </div>
              ) : null
            ) : listLoading ? (
              <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>
                次のクイズを準備中...
              </div>
            ) : nextQuizId ? (
              <button
                className="btn btn-primary"
                onClick={handleNextQuizClick}
                style={{ width: '100%', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <span>リストの次のクイズに進む</span>
                <ChevronRight size={18} />
              </button>
            ) : isLastInList ? (
              <div className={styles.listClearMessage} style={{ background: 'rgba(0, 245, 212, 0.05)', border: '1px solid rgba(0, 245, 212, 0.2)', padding: '20px', borderRadius: 'var(--radius-md)', textAlign: 'center', marginTop: '16px' }}>
                <p style={{ color: '#00f5d4', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '12px' }}>
                  🎉 おめでとうございます！リストのすべてのクイズを完遂しました！
                </p>
                <Link
                  href={`/list/${listId}`}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  リストの詳細に戻る
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* 問題正誤リストおよび解説表示 (Task 5.1) */}
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
                      <Check size={16} /> 正解
                    </span>
                  ) : (
                    <span className={styles.incorrectLabel}>
                      <X size={16} /> 不正解
                    </span>
                  )}
                  {isCorrect && quickPressTimes && quickPressTimes[q.id] !== undefined && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: 'rgba(0, 245, 212, 0.12)',
                      color: '#00f5d4',
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
                    <MessageSquare size={12} style={{ marginRight: '4px', display: 'inline', verticalAlign: 'text-bottom' }} />
                    {openReports.some((r) => r.questionId === q.id) ? '問題指摘済' : 'この問題を指摘'}
                  </button>
                </div>
              </div>

              <MarkdownContent
                markdown={q.questionText}
                className={styles.questionTextResult}
              />

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
                  <p
                    style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: '1.6' }}
                    dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(q.explanation) }}
                  />
                </div>
              )}

              {/* 連想クイズのヒント履歴表示 */}
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
            </article>
          );
        })}
      </section>

      {/* 同じ作者の他のおすすめクイズ表示 */}
      <section className={styles.recommendSection} data-testid="author-quizzes-section">
        <h2 style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '16px' }}>
          この作者の他のクイズ
        </h2>
        {recommendLoading ? (
          <div className={styles.recommendGrid}>
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} data-testid="skeleton-card" />
            ))}
          </div>
        ) : recommendError ? (
          <p style={{ color: 'var(--text-muted)' }}>{recommendError}</p>
        ) : recommendQuizzes.length > 0 ? (
          <div className={styles.recommendGrid}>
            {recommendQuizzes.map((q) => (
              <QuizCard
                key={q.id}
                quiz={q}
                href={`/quiz/${q.id}`}
                isBookmarked={bookmarkedQuizIds.has(q.id)}
                onBookmarkToggle={handleRecommendBookmarkToggle}
                onPlayClick={handleRecommendPlayClick}
              />
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>他におすすめのクイズはありません。</p>
        )}
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
    </div>
  );
}

export default function QuizResultPage({ params }: PageProps) {
  const resolvedParams = use(params);
  return (
    <React.Suspense fallback={<div className={styles.container} style={{ textAlign: 'center', padding: '100px 0' }}><p style={{ color: 'var(--text-muted)' }}>結果データをロード中...</p></div>}>
      <QuizResultPageContent quizId={resolvedParams.id} />
    </React.Suspense>
  );
}
