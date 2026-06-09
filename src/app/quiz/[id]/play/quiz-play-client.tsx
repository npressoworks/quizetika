'use client';

import { getTextInputFieldProps } from '@/services/text-answer-utils';
import React, { useCallback, useEffect, useMemo, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Timer, HelpCircle, Send, Play, Check, X, ShieldAlert } from 'lucide-react';
import { parseMarkdownToHtml } from '@/lib/security/sanitize';
import { useAuth } from '@/context/auth-context';
import { usePlayState, type QuestionElapsedPolicy } from '@/hooks/usePlayState';
import { useAiPlayState } from '@/hooks/useAiPlayState';
import { saveAttempt, createLateralAttemptSession, updateFailedQuestionsCount } from '@/services/attempt';
import { addPendingSyncAttempt, generateLocalId, PendingSyncAttempt } from '@/services/attempt-session';
import { setOptimisticAttempt, clearOptimisticAttempt } from '@/lib/optimistic-attempt';
import { PostAnswerFeedback } from '@/components/quiz/post-answer-feedback';
import { toQuestionAnswerRecords } from '@/services/attempt-answer-display';
import { Quiz, Attempt, Question } from '@/types';
import { auth } from '@/lib/firebase/config';
import styles from './play.module.css';
import { ChoiceAnswerPanel } from '@/components/quiz/choice-answer-panel';
import { TrueFalseAnswerPanel } from '@/components/quiz/true-false-answer-panel';
import { QuestionTextDisplay } from '@/components/quiz/question-text-display';
import { MarkdownContent } from '@/components/markdown/markdown-content';
import { useQuickPressStream } from '@/hooks/useQuickPressStream';
import { SortableSortingList } from '@/components/sorting/sortable-sorting-list';
import { formatCorrectAnswer } from '@/services/attempt-answer-display';
import { getBookmarkFeed } from '@/services/bookmark';
import { QuestionBookmarkToggle } from '@/components/bookmark/question-bookmark-toggle';
import {
  readQuestionListSession,
  syncQuestionListSessionIndex,
  buildQuestionListPlayUrl,
} from '@/lib/question-list-session';
import {
  readMyQuizSession,
  syncMyQuizSessionIndex,
} from '@/lib/my-quiz-session';
import { PlaySkeleton } from '@/components/quiz/play-skeleton';
import { useElapsedSeconds } from '@/hooks/useElapsedSeconds';
import { formatPlayElapsedSeconds } from '@/lib/format-play-elapsed';
import { hasUnlimitedAiQuestionsForUser } from '@/lib/pricing-entitlement';
import { FREE_TIER_PER_QUIZ_LIMIT } from '@/services/ask-ai-utils';

interface QuizPlayClientProps {
  quizId: string;
  initialQuiz: Quiz;
}

function QuizPlayClient({ quizId, initialQuiz }: QuizPlayClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const rawMode = searchParams.get('mode') || 'normal';
  const questionListMode = rawMode === 'question-list';
  const myQuizMode = rawMode === 'my-quiz';
  const playMode = rawMode as 'normal' | 'exam' | 'flashcard' | 'lateral' | 'list' | 'question-list' | 'my-quiz';
  const effectivePlayMode: 'normal' | 'exam' | 'flashcard' | 'lateral' =
    questionListMode || myQuizMode || rawMode === 'list'
      ? 'normal'
      : (rawMode as 'normal' | 'exam' | 'flashcard' | 'lateral');
  const questionIdParam = searchParams.get('questionId');
  const startAtQuestionId = searchParams.get('startAtQuestionId');

  const quiz = initialQuiz;
  const [online, setOnline] = useState<boolean>(true);
  const [bookmarkedQuestionIds, setBookmarkedQuestionIds] = useState<Set<string>>(new Set());

  const isNormalFeedbackFlow = playMode === 'normal' && !questionListMode && !myQuizMode;

  const playQuestions = useMemo(() => {
    if (!quiz?.questions?.length) return [];
    if ((questionListMode || myQuizMode) && questionIdParam) {
      const q = (quiz.questions ?? []).find((x) => x.id === questionIdParam);
      return q ? [q] : [];
    }
    return quiz.questions;
  }, [quiz, questionListMode, myQuizMode, questionIdParam]);

  // 1. オンライン・オフライン判定の監視
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOnline(navigator.onLine);
      const goOnline = () => setOnline(true);
      const goOffline = () => setOnline(false);
      window.addEventListener('online', goOnline);
      window.addEventListener('offline', goOffline);
      return () => {
        window.removeEventListener('online', goOnline);
        window.removeEventListener('offline', goOffline);
      };
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (playMode === 'lateral' && !user) {
      const query = searchParams.toString();
      const redirectPath = `/quiz/${quizId}/play${query ? `?${query}` : ''}`;
      router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
    }
  }, [authLoading, playMode, user, router, quizId, searchParams]);

  useEffect(() => {
    if (!user) {
      setBookmarkedQuestionIds(new Set());
      return;
    }
    getBookmarkFeed(user.id)
      .then((feed) => {
        setBookmarkedQuestionIds(new Set(feed.questions.map((e) => e.question.id)));
      })
      .catch(() => setBookmarkedQuestionIds(new Set()));
  }, [user]);

  useEffect(() => {
    if (!questionListMode) return;
    const qIndex = searchParams.get('qIndex');
    const listId = searchParams.get('listId');
    if (qIndex == null || !listId) return;
    const session = readQuestionListSession();
    if (session?.listId === listId) {
      const idx = parseInt(qIndex, 10);
      if (!Number.isNaN(idx)) syncQuestionListSessionIndex(idx);
    }
  }, [questionListMode, searchParams]);

  useEffect(() => {
    if (!myQuizMode) return;
    const qIndex = searchParams.get('qIndex');
    const sessionId = searchParams.get('sessionId');
    if (qIndex == null || !sessionId) return;
    const session = readMyQuizSession();
    if (session?.sessionId === sessionId) {
      const idx = parseInt(qIndex, 10);
      if (!Number.isNaN(idx)) syncMyQuizSessionIndex(idx);
    }
  }, [myQuizMode, searchParams]);

  const myQuizSessionId = searchParams.get('sessionId');
  const myQuizSessionMissing =
    myQuizMode &&
    (!myQuizSessionId ||
      readMyQuizSession()?.sessionId !== myQuizSessionId ||
      playQuestions.length === 0);

  const [isReadingStarted, setIsReadingStarted] = useState<boolean>(false);
  const [isQuickPressed, setIsQuickPressed] = useState<boolean>(false);
  const [elapsedPolicy, setElapsedPolicy] = useState<QuestionElapsedPolicy>({
    kind: 'standard',
  });

  // 通常・模擬試験・フラッシュカード用のプレイフック
  const {
    currentIdx,
    setCurrentIdx,
    answeredIds,
    failedIds,
    questionAnswers,
    score,
    elapsedSeconds,
    timeLeft,
    showAnswer,
    setShowAnswer,
    recordAnswer,
    advanceToNext,
    completePlay,
    handleAnswerSubmit,
    clearSession,
    feedbackPending,
    lastAnswerResult,
    isFinished,
    beginLimitCountdown,
  } = usePlayState({
    quizId,
    userId: user?.id || 'guest',
    mode: playMode === 'lateral' ? 'normal' : (playMode === 'exam' || playMode === 'flashcard' ? playMode : 'normal'),
    questions: playQuestions,
    manualAdvance: isNormalFeedbackFlow,
    elapsedPolicy: isNormalFeedbackFlow ? elapsedPolicy : undefined,
  });

  useEffect(() => {
    const q = playQuestions[currentIdx];
    if (!isNormalFeedbackFlow || q?.type !== 'quick-press') {
      setElapsedPolicy({ kind: 'standard' });
      return;
    }
    if (feedbackPending) {
      setElapsedPolicy({ kind: 'quick-press', phase: 'feedback' });
    } else if (!isReadingStarted) {
      setElapsedPolicy({ kind: 'quick-press', phase: 'pre_reading' });
    } else if (isQuickPressed) {
      setElapsedPolicy({ kind: 'quick-press', phase: 'post_reading' });
    } else {
      setElapsedPolicy({ kind: 'quick-press', phase: 'reading' });
    }
  }, [
    currentIdx,
    isReadingStarted,
    isQuickPressed,
    feedbackPending,
    playQuestions,
    isNormalFeedbackFlow,
  ]);

  const [associationHintIndices, setAssociationHintIndices] = useState<{ [questionId: string]: number }>({});
  const [completing, setCompleting] = useState<boolean>(false);

  useEffect(() => {
    if (!quiz || questionListMode || !startAtQuestionId) return;
    const idx = (quiz.questions ?? []).findIndex((q) => q.id === startAtQuestionId);
    if (idx >= 0) setCurrentIdx(idx);
  }, [quiz, startAtQuestionId, questionListMode, setCurrentIdx]);

  const buildAttemptData = (
    finalScore = score,
    finalFailed = failedIds
  ): Omit<Attempt, 'id' | 'completedAt'> => {
    const listId = searchParams.get('listId') || undefined;
    const sessionId = searchParams.get('sessionId') || undefined;
    const isQuestionListPlay = questionListMode && !!listId;
    const isMyQuizPlay = myQuizMode;
    let currentMode: Attempt['mode'];
    if (isMyQuizPlay) {
      currentMode = 'my-quiz';
    } else if (isQuestionListPlay) {
      currentMode = 'question-list';
    } else if (listId) {
      currentMode = 'list';
    } else {
      currentMode =
        playMode === 'lateral'
          ? 'normal'
          : playMode === 'exam' || playMode === 'flashcard'
            ? playMode
            : 'normal';
    }

    return {
      userId: user?.id || 'guest',
      quizId: quiz!.id,
      listId,
      sessionId: isMyQuizPlay ? sessionId : undefined,
      mode: currentMode,
      score: finalScore,
      totalQuestions: isQuestionListPlay || isMyQuizPlay ? 1 : (quiz!.questions ?? []).length,
      elapsedSeconds,
      failedQuestionIds: finalFailed,
      questionAnswers: toQuestionAnswerRecords(questionAnswers),
      aiTurnCount: 0,
      aiTurnLimit: null,
    };
  };

  const persistAuxiliaryAttemptData = (storageId: string) => {
    if (!quiz) return;

    if (Object.keys(quickPressTimes).length > 0) {
      localStorage.setItem(`quizeum_qp_times_${storageId}`, JSON.stringify(quickPressTimes));
    }

    const revealedHintsData = (quiz.questions ?? [])
      .map((q) => {
        if (q.type === 'association') {
          const maxIdx = associationHintIndices[q.id] ?? 0;
          const hints = q.associationHints?.slice(0, maxIdx + 1) || [];
          return {
            questionId: q.id,
            revealedHints: hints,
            revealedCount: hints.length,
          };
        }
        return null;
      })
      .filter(Boolean);

    if (revealedHintsData.length > 0) {
      localStorage.setItem(`quizeum_attempt_hints_${storageId}`, JSON.stringify(revealedHintsData));
    }
  };

  const migrateAuxiliaryAttemptData = (fromId: string, toId: string) => {
    const qpKey = `quizeum_qp_times_${fromId}`;
    const qpValue = localStorage.getItem(qpKey);
    if (qpValue) {
      localStorage.setItem(`quizeum_qp_times_${toId}`, qpValue);
      localStorage.removeItem(qpKey);
    }

    const hintsKey = `quizeum_attempt_hints_${fromId}`;
    const hintsValue = localStorage.getItem(hintsKey);
    if (hintsValue) {
      localStorage.setItem(`quizeum_attempt_hints_${toId}`, hintsValue);
      localStorage.removeItem(hintsKey);
    }
  };

  const saveOffline = (attemptData: Omit<Attempt, 'id' | 'completedAt'>, localId?: string) => {
    if (!quiz) return;
    const resolvedLocalId = localId ?? generateLocalId();
    const pendingPayload: PendingSyncAttempt = {
      ...attemptData,
      localId: resolvedLocalId,
      completedAt: new Date().toISOString(),
    };
    addPendingSyncAttempt(pendingPayload);
    persistAuxiliaryAttemptData(resolvedLocalId);

    const listId = searchParams.get('listId');
    const listQuery = listId ? `&listId=${listId}` : '';
    router.push(`/quiz/${quiz.id}/result?localId=${resolvedLocalId}${listQuery}`);
  };

  const handlePlayComplete = async (finalScore = score, finalFailed = failedIds) => {
    if (!quiz) return;

    const attemptData = buildAttemptData(finalScore, finalFailed);
    clearSession();

    if (online) {
      try {
        const attemptId = await saveAttempt(attemptData);
        if (user && finalFailed.length > 0) {
          await updateFailedQuestionsCount(user.id, finalFailed.length);
        }
        persistAuxiliaryAttemptData(attemptId);

        const listId = searchParams.get('listId');
        const listQuery = listId ? `&listId=${listId}` : '';
        router.push(`/quiz/${quiz.id}/result?attemptId=${attemptId}${listQuery}`);
      } catch (error) {
        console.error('[QuizPlay] 保存失敗:', error);
        saveOffline(attemptData);
      }
    } else {
      saveOffline(attemptData);
    }
  };

  const handlePlayCompleteOptimistic = () => {
    if (!quiz) return;

    completePlay();
    const attemptData = buildAttemptData();
    clearSession();

    const localId = generateLocalId();
    const pendingPayload: PendingSyncAttempt = {
      ...attemptData,
      localId,
      completedAt: new Date().toISOString(),
    };

    setOptimisticAttempt(localId, pendingPayload);
    persistAuxiliaryAttemptData(localId);

    const listId = searchParams.get('listId');
    const listQuery = listId ? `&listId=${listId}` : '';
    router.push(`/quiz/${quiz.id}/result?localId=${localId}${listQuery}`);

    if (online) {
      void (async () => {
        try {
          const attemptId = await saveAttempt(attemptData);
          if (user && failedIds.length > 0) {
            await updateFailedQuestionsCount(user.id, failedIds.length);
          }
          migrateAuxiliaryAttemptData(localId, attemptId);
          clearOptimisticAttempt(localId);
          router.replace(`/quiz/${quiz.id}/result?attemptId=${attemptId}${listQuery}`);
        } catch (error) {
          console.error('[QuizPlay] バックグラウンド保存失敗:', error);
          addPendingSyncAttempt(pendingPayload);
          clearOptimisticAttempt(localId);
        }
      })();
    } else {
      addPendingSyncAttempt(pendingPayload);
    }
  };

  // exam / flashcard / question-list: 全問完了時に自動で結果保存
  useEffect(() => {
    if (isNormalFeedbackFlow) return;
    if (isFinished && !completing && playQuestions.length > 0 && !authLoading) {
      setCompleting(true);
      void handlePlayComplete();
    }
  }, [isFinished, completing, playQuestions.length, authLoading, isNormalFeedbackFlow]);

  const submitAnswer = (answer: string) => {
    if (isNormalFeedbackFlow) {
      recordAnswer(answer);
      return;
    }
    handleAnswerSubmit(answer);
  };

  const handleSkipQuestion = () => {
    if (!isNormalFeedbackFlow || feedbackPending) return;
    recordAnswer('');
  };

  const handleNextQuestion = () => {
    advanceToNext();
  };

  const handleViewResults = () => {
    handlePlayCompleteOptimistic();
  };

  // ────────── ウミガメスープ問題専用ステート ──────────
  const [lateralAttemptId, setLateralAttemptId] = useState<string | null>(null);
  const [truthSummary, setTruthSummary] = useState<string>('');
  const [questionInput, setQuestionInput] = useState<string>('');
  const [lateralInputMode, setLateralInputMode] = useState<'question' | 'truth'>('question');
  const [isTruthChecking, setIsTruthChecking] = useState<boolean>(false);
  const [truthAdvice, setTruthAdvice] = useState<string | null>(null);
  const [truthPassed, setTruthPassed] = useState<boolean>(false);
  const [truthGaveUp, setTruthGaveUp] = useState<boolean>(false);
  const [isGivingUp, setIsGivingUp] = useState<boolean>(false);
  const [lateralListNextUrl, setLateralListNextUrl] = useState<string | null>(null);
  const lateralListId = searchParams.get('listId');
  const lateralPlayEnded = truthPassed || truthGaveUp;
  const lateralInputLocked = lateralPlayEnded || isGivingUp;
  const lateralElapsedSeconds = useElapsedSeconds(
    playMode === 'lateral' && !!user && !lateralPlayEnded
  );

  // 初回ロード時にウミガメスープ用の空の Attempt を自動生成
  useEffect(() => {
    if (playMode === 'lateral' && quiz && user && !lateralAttemptId) {
      const currentUserId = user.id;
      const currentQuizId = quiz.id;
      async function initLateralAttempt() {
        try {
          const questionIds = quiz!.questions.map((q) => q.id);
          const listIdParam = searchParams.get('listId');
          const aid = await createLateralAttemptSession(
            currentUserId,
            currentQuizId,
            questionIds,
            listIdParam
          );
          setLateralAttemptId(aid);
        } catch (e) {
          console.error('[QuizPlay] ウミガメセッション作成エラー:', e);
        }
      }
      initLateralAttempt();
    }
  }, [playMode, quiz, user, lateralAttemptId, searchParams]);

  const hasUnlimitedAiQuestions = hasUnlimitedAiQuestionsForUser(user);

  // ウミガメスープ用AIプレイステートフック
  const aiPlay = useAiPlayState({
    attemptId: lateralAttemptId || '',
    userId: user?.id || '',
    hasUnlimitedAiQuestions,
    initialHistory: [],
    initialTurnCount: 0,
  });

  useEffect(() => {
    if (!truthGaveUp || !lateralListId || !quiz) return;
    const activeListId = lateralListId;

    const questionListModeActive = searchParams.get('mode') === 'question-list';
    if (questionListModeActive) {
      const session = readQuestionListSession();
      if (session?.listId === activeListId) {
        const nextIndex = session.currentIndex + 1;
        if (nextIndex < session.entries.length) {
          setLateralListNextUrl(buildQuestionListPlayUrl(session, nextIndex));
        }
      }
      return;
    }

    async function resolveNextQuizUrl() {
      try {
        const { getQuizList } = await import('@/services/quiz-list');
        const listData = await getQuizList(activeListId);
        if (!listData?.quizIds) return;
        const currentIdx = listData.quizIds.indexOf(quiz.id);
        if (currentIdx !== -1 && currentIdx < listData.quizIds.length - 1) {
          const nextQuizId = listData.quizIds[currentIdx + 1];
          setLateralListNextUrl(
            `/quiz/${nextQuizId}/play?listId=${activeListId}&mode=list`
          );
        }
      } catch (err) {
        console.error('[QuizPlay] リスト次問題URL解決失敗:', err);
      }
    }

    resolveNextQuizUrl();
  }, [truthGaveUp, lateralListId, quiz, searchParams]);

  const chatHistoryEndRef = useRef<HTMLDivElement>(null);

  // 送信・回答表示時にチャット末尾へスクロール
  useEffect(() => {
    if (playMode !== 'lateral') return;
    chatHistoryEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [playMode, aiPlay.history, aiPlay.pending, aiPlay.pendingQuestion, lateralPlayEnded, truthGaveUp, isTruthChecking, truthSummary]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lateralInputLocked) return;

    if (lateralInputMode === 'question') {
      if (!questionInput.trim() || aiPlay.isAwaitingResponse) return;
      const text = questionInput.trim();
      setQuestionInput('');
      await aiPlay.askQuestion(text);
      return;
    }

    await handleTruthVerify();
  };

  // ウミガメ 真相回答判定送信
  const handleTruthVerify = async () => {
    if (!truthSummary.trim() || isTruthChecking || lateralInputLocked || !lateralAttemptId || !user) return;
    setIsTruthChecking(true);
    setTruthAdvice(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/attempt/verify-truth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          attemptId: lateralAttemptId,
          userId: user.id,
          truthSummary,
          displayName: user.displayName,
          elapsedSeconds: lateralElapsedSeconds,
        }),
      });

      const data = await res.json();
      if (data.isCorrect) {
        setTruthPassed(true);
        // クリアアニメーション後、結果画面へ遷移
        setTimeout(() => {
          router.push(`/quiz/${quiz?.id}/result?attemptId=${lateralAttemptId}`);
        }, 3000);
      } else {
        setTruthAdvice(data.advice || null);
      }
    } catch (e) {
      console.error('[verify-truth] 送信エラー:', e);
      setTruthAdvice('判定サーバーでエラーが発生しました。時間を置いてから再試行してください。');
    } finally {
      setIsTruthChecking(false);
    }
  };

  const handleGiveUpLateral = async () => {
    if (isGivingUp || lateralPlayEnded || !lateralAttemptId || !user) return;

    const confirmed = window.confirm(
      '諦めますか？\nこのプレイは不合格として記録され、チャットと真相提出はできなくなります。'
    );
    if (!confirmed) return;

    setIsGivingUp(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/attempt/give-up-lateral', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          attemptId: lateralAttemptId,
          userId: user.id,
          elapsedSeconds: lateralElapsedSeconds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || '諦め処理に失敗しました');
      }

      if (!data.completed) {
        throw new Error('諦め処理に失敗しました');
      }
      setTruthAdvice(null);
      setTruthGaveUp(true);
    } catch (e) {
      console.error('[give-up-lateral] 送信エラー:', e);
      window.alert('諦め処理に失敗しました。時間を置いてから再試行してください。');
    } finally {
      setIsGivingUp(false);
    }
  };

  // ────────── 早押しクイズ（ストリーム表示＆カンニング防止） ──────────
  const [currentQuickPressTime, setCurrentQuickPressTime] = useState<number>(0);
  const [quickPressTimes, setQuickPressTimes] = useState<{ [questionId: string]: number }>({});
  const quickPressStartTimeRef = useRef<number | null>(null);
  const quickInputRef = useRef<HTMLInputElement | null>(null);

  const quickPressQuestion =
    quiz?.questions[currentIdx]?.type === 'quick-press'
      ? quiz.questions[currentIdx]
      : undefined;

  const getQuickPressIdToken = useCallback(
    async () => (await auth.currentUser?.getIdToken()) ?? null,
    []
  );

  const onQuickPressBodyStart = useCallback(() => {
    quickPressStartTimeRef.current = Date.now();
  }, []);

  const handleQuickPressReadingComplete = useCallback(() => {
    beginLimitCountdown();
  }, [beginLimitCountdown]);

  const {
    displayTokens: quickPressDisplayTokens,
    reservedTokens: quickPressReservedTokens,
    cancelStream: cancelQuickPressStream,
    isReadingComplete,
  } = useQuickPressStream({
    enabled: Boolean(quickPressQuestion && isReadingStarted),
    mode: 'api',
    quizId,
    questionId: quickPressQuestion?.id ?? '',
    getIdToken: getQuickPressIdToken,
    onBodyTimingStart: onQuickPressBodyStart,
    onReadingComplete: handleQuickPressReadingComplete,
  });

  useEffect(() => {
    setIsReadingStarted(false);
    setIsQuickPressed(false);
    setCurrentQuickPressTime(0);
    quickPressStartTimeRef.current = null;
  }, [currentIdx]);

  const handleQuickPress = () => {
    if (isQuickPressed) return;
    setIsQuickPressed(true);
    cancelQuickPressStream();

    // 問題本文が表示され始めてからボタンを押すまでのタイムを計測
    let duration = 0;
    if (quickPressStartTimeRef.current !== null) {
      duration = (Date.now() - quickPressStartTimeRef.current) / 1000;
      if (duration < 0) duration = 0;
    }
    setCurrentQuickPressTime(Number(duration.toFixed(2)));

    // 入力エリアを活性化してフォーカスする
    setTimeout(() => {
      if (quickInputRef.current) {
        quickInputRef.current.disabled = false;
        quickInputRef.current.focus();
      }
    }, 50);
  };

  // ────────── 並び替え・連想クイズ用一時ステート ──────────
  const [sortingItems, setSortingItems] = useState<{ id: string; text: string; correctOrder: number }[]>([]);
  const [activeHintIdx, setActiveHintIdx] = useState<number>(0);

  // 問題インデックス変化時の初期化
  useEffect(() => {
    if (!quiz || currentIdx >= quiz.questions.length) return;
    const currentQuestion = quiz.questions[currentIdx];

    if (currentQuestion.type === 'sorting' && currentQuestion.sortingItems) {
      // 初期状態ではランダムシャッフル
      const items = [...currentQuestion.sortingItems];
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      setSortingItems(items);
    }

    if (currentQuestion.type === 'association') {
      setActiveHintIdx(0);
    }
  }, [currentIdx, quiz]);

  // 4. ヒント表示モーダル制御
  const [showHint, setShowHint] = useState<boolean>(false);

  if (authLoading) {
    return <PlaySkeleton data-testid="quiz-play-skeleton" />;
  }

  if (!quiz) {
    return (
      <div className={styles.container}>
        <p>クイズが見つかりませんでした。</p>
      </div>
    );
  }

  if (myQuizSessionMissing) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '48px 20px' }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
          マイクイズのセッションが見つかりません。再度マイクイズから開始してください。
        </p>
        <Link href="/my-quiz" className="btn btn-primary">
          マイクイズへ戻る
        </Link>
      </div>
    );
  }

  // ────────── UI レンダリング: ウミガメスープ ──────────
  if (playMode === 'lateral') {
    const lateralQuestion = (quiz.questions ?? []).find((q) => q.type === 'lateral-thinking');
    return (
      <div className={styles.lateralContainer}>
        {/* 左カラム: AIチャット */}
        <div className={styles.chatColumn}>
          <div className={styles.chatHeader}>
            <div className={styles.chatTitle}>👻 ウミガメチャット (AI判定)</div>
            <div className={styles.chatHeaderMeta}>
              <span className={styles.turnCounter}>
                質問数:{' '}
                {hasUnlimitedAiQuestions
                  ? aiPlay.turnCount
                  : `${aiPlay.perQuizUsed} / ${FREE_TIER_PER_QUIZ_LIMIT}`}
              </span>
              <span className={styles.elapsedCounter}>
                <Timer size={14} aria-hidden="true" />
                経過時間: {formatPlayElapsedSeconds(lateralElapsedSeconds)}
              </span>
            </div>
          </div>

          <div className={styles.chatHistory}>
            {/* 初期メッセージ */}
            <div className={`${styles.chatBubble} ${styles.bubbleAi}`}>
              {lateralQuestion ? (
                <MarkdownContent markdown={lateralQuestion.questionText} />
              ) : null}
              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                ※ 質問は「はい」か「いいえ」で回答可能なクローズドクエスチョンで行うと解決に近づきます。
              </div>
            </div>

            {/* 対話履歴 */}
            {aiPlay.history.map((msg) => (
              <React.Fragment key={msg.id}>
                {/* ユーザー質問 */}
                <div className={`${styles.chatBubble} ${styles.bubbleUser}`}>
                  {msg.questionText}
                </div>
                {/* AI回答 */}
                <div className={`${styles.chatBubble} ${styles.bubbleAi}`}>
                  {msg.aiComment}
                  {msg.answerType && (
                    <div className={styles.aiResponseMeta}>
                      {msg.answerType === 'yes' && <span className={styles.responseYes}>🟢 はい (YES)</span>}
                      {msg.answerType === 'no' && <span className={styles.responseNo}>🔴 いいえ (NO)</span>}
                      {msg.answerType === 'irrelevant' && <span className={styles.responseIrrelevant}>🟡 関係ありません (IRRELEVANT)</span>}
                      {msg.answerType === 'unknown' && <span className={styles.responseUnknown}>⚪ 判断できません</span>}
                      {msg.isFromCache && <span className={styles.cacheBadge}>📋 既存の回答</span>}
                    </div>
                  )}
                </div>
              </React.Fragment>
            ))}

            {/* 送信直後のユーザー質問（API応答待ち中） */}
            {aiPlay.pendingQuestion && (
              <div className={`${styles.chatBubble} ${styles.bubbleUser}`}>
                {aiPlay.pendingQuestion}
              </div>
            )}

            {/* AIが質問を分析中の表示 (Task 4.2) */}
            {aiPlay.pending && (
              <div className={styles.chatPending}>
                <span>・・・AIが質問を分析中です</span>
              </div>
            )}

            {isTruthChecking && truthSummary.trim() && (
              <div className={`${styles.chatBubble} ${styles.bubbleUser}`}>
                <span className={styles.truthSubmitLabel}>【真相解答】</span>
                {truthSummary}
              </div>
            )}
            {isTruthChecking && (
              <div className={styles.chatPending}>
                <span>・・・AIが真相を判定中です</span>
              </div>
            )}

            {/* 合格クリアアニメーション (Task 4.3) */}
            {truthPassed && (
              <div className={`${styles.chatBubble} ${styles.bubbleSystem}`}>
                🎉 【合格】素晴らしい！見事に真相を解き明かしました！結果画面へ遷移します...
              </div>
            )}
            {truthGaveUp && (
              <div className={`${styles.chatBubble} ${styles.bubbleSystem}`}>
                プレイを終了しました。下のボタンから結果画面へ進めます。
              </div>
            )}
            {truthGaveUp && (
              <div className={styles.lateralGiveUpNav}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    router.push(`/quiz/${quiz?.id}/result?attemptId=${lateralAttemptId}`)
                  }
                  data-analytics="quiz-lateral-give-up-result"
                >
                  結果画面へ
                </button>
                {lateralListNextUrl && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => router.push(lateralListNextUrl)}
                    data-analytics="quiz-lateral-give-up-next"
                  >
                    次の問題へ
                  </button>
                )}
              </div>
            )}
            <div ref={chatHistoryEndRef} aria-hidden="true" />
          </div>

          {/* 入力欄（質問 / 真相解答を切り替え） */}
          <div className={styles.chatInputArea}>
            {aiPlay.errorMsg && lateralInputMode === 'question' && (
              <div className={styles.chatInputError}>
                ⚠️ {aiPlay.errorMsg}{' '}
                <Link href="/pricing" className={styles.limitProLink}>
                  Pro プランを見る
                </Link>
              </div>
            )}
            {truthAdvice && !lateralPlayEnded && lateralInputMode === 'truth' && (
              <div className={styles.truthAdviceBanner}>
                💡 <strong>判定結果:</strong> {truthAdvice}
              </div>
            )}
            <div className={styles.chatModeToggle} role="tablist" aria-label="入力モード">
              <button
                type="button"
                role="tab"
                aria-selected={lateralInputMode === 'question'}
                className={`${styles.chatModeBtn} ${lateralInputMode === 'question' ? styles.chatModeBtnActive : ''}`}
                onClick={() => setLateralInputMode('question')}
                disabled={lateralInputLocked}
                data-analytics="quiz-lateral-mode-question"
              >
                質問する
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={lateralInputMode === 'truth'}
                className={`${styles.chatModeBtn} ${lateralInputMode === 'truth' ? styles.chatModeBtnActive : ''}`}
                onClick={() => setLateralInputMode('truth')}
                disabled={lateralInputLocked}
                data-analytics="quiz-lateral-mode-truth"
              >
                回答する
              </button>
            </div>
            <form onSubmit={handleChatSubmit} className={styles.chatInputForm}>
              {lateralInputMode === 'question' ? (
                <>
                  <input
                    type="text"
                    className={styles.chatInput}
                    placeholder={
                      aiPlay.questionLimitReached
                        ? '質問の上限に達しました。「回答する」から真相を提出できます'
                        : 'AIに質問する (例: 男は一人でしたか？)...'
                    }
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    disabled={
                      aiPlay.isAwaitingResponse ||
                      aiPlay.questionLimitReached ||
                      lateralInputLocked
                    }
                  />
                  <button
                    type="submit"
                    className={`btn btn-primary ${lateralPlayEnded || isGivingUp ? styles.lateralLockedBtn : ''}`}
                    disabled={
                      aiPlay.isAwaitingResponse ||
                      !questionInput.trim() ||
                      aiPlay.questionLimitReached ||
                      lateralInputLocked
                    }
                    aria-busy={aiPlay.isAwaitingResponse}
                    data-analytics="quiz-lateral-question-send"
                  >
                    <Send size={16} />
                  </button>
                </>
              ) : (
                <div className={styles.chatTruthForm}>
                  <textarea
                    className={styles.chatTruthTextarea}
                    placeholder="解き明かした真相のストーリーを100文字〜1000文字以内で要約して入力してください..."
                    value={truthSummary}
                    onChange={(e) => setTruthSummary(e.target.value)}
                    disabled={isTruthChecking || lateralInputLocked}
                    maxLength={1000}
                  />
                  <button
                    type="submit"
                    className={`btn btn-accent ${styles.chatTruthSubmitBtn} ${lateralPlayEnded || isGivingUp ? styles.lateralLockedBtn : ''}`}
                    disabled={!truthSummary.trim() || isTruthChecking || lateralInputLocked}
                    data-analytics="quiz-lateral-truth-submit"
                  >
                    {isTruthChecking ? '判定中...' : '真相を送信する'}
                  </button>
                </div>
              )}
            </form>
            {!lateralPlayEnded && (
              <button
                type="button"
                className={`btn btn-outline ${styles.giveUpBtn}`}
                onClick={handleGiveUpLateral}
                disabled={isGivingUp || isTruthChecking || !lateralAttemptId}
                data-analytics="quiz-lateral-give-up"
              >
                {isGivingUp ? '処理中...' : '諦める'}
              </button>
            )}
          </div>
        </div>

        {/* 右カラム: 真相回答判定エリア */}
        <div className={styles.infoColumn}>
          <div className={styles.infoCard}>
            <div className={styles.infoCardTitle}>ウミガメのスープ（水平思考クイズ）</div>
            <div className={styles.lateralRules}>
              <p className={styles.lateralRulesLead}>
                不思議な出来事の<strong>真相</strong>を推理して解き明かすパズルです。
              </p>
              <ul className={styles.lateralRulesList}>
                <li>謎を読み、<strong>「質問する」</strong>でAIに質問して手がかりを集めましょう</li>
                <li>AIは<strong>「はい」「いいえ」「関係ありません」「判断できません」</strong>で答えます</li>
                <li>「男は一人でしたか？」のように、<strong>はい／いいえで答えられる質問</strong>がおすすめです</li>
                <li>
                  質問は1回<strong>100文字以内</strong>・無料プランは<strong>同一クイズ30回/日</strong>
                  ・<strong>全クイズ横断150回/日</strong>（上限後も真相の提出はできます）
                </li>
                <li>真相が見えたら<strong>「回答する」</strong>で<strong>100〜1000文字</strong>の要約を送信</li>
                <li>解けないときは<strong>「諦める」</strong>でプレイを終了できます（真相は表示されません）</li>
              </ul>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ────────── UI レンダリング: 通常・試験・フラッシュカード ──────────
  const getQuestionTypeLabel = (type: string | undefined) => {
    if (!type) return '';
    switch (type) {
      case 'multiple-choice': return '選択式';
      case 'true-false': return '〇✕式';
      case 'text-input': return '記述式';
      case 'quick-press': return '早押し';
      case 'sorting': return '並び替え';
      case 'association': return '連想';
      case 'lateral-thinking': return 'ウミガメのスープ';
      default: return type;
    }
  };

  const currentQuestion = quiz.questions[currentIdx];
  const progressPercent = playQuestions.length > 0 ? (answeredIds.length / playQuestions.length) * 100 : 0;
  const isLastQuestion = currentIdx >= playQuestions.length - 1;
  const showNormalFeedback =
    isNormalFeedbackFlow && feedbackPending && lastAnswerResult && currentQuestion;

  const showQuickPressDock =
    isNormalFeedbackFlow &&
    !feedbackPending &&
    currentQuestion?.type === 'quick-press';

  const showSkipQuestion =
    isNormalFeedbackFlow &&
    !feedbackPending &&
    (currentQuestion?.type !== 'quick-press' ||
      (isReadingStarted && (isReadingComplete || isQuickPressed)));

  const showSkipInCard = showSkipQuestion && !showQuickPressDock;

  if (!isNormalFeedbackFlow && (isFinished || completing)) {
    return <PlaySkeleton data-testid="quiz-play-completing" />;
  }

  return (
    <div
      className={`${styles.container} ${showQuickPressDock ? styles.containerWithQuickPressDock : ''}`}
    >
      {/* プレイ画面ヘッダー情報 */}
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href={`/quiz/${quiz.id}`} className={styles.backBtn} onClick={clearSession}>
            <ArrowLeft size={16} />
            中断する
          </Link>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>| モード: {playMode}</span>
        </div>

        <div className={styles.statusIndicator}>
          {online ? (
            <span className={styles.online}>🟢 オンライン (同期保護中)</span>
          ) : (
            <span className={styles.offline}>🔴 オフライン (ローカル保存されます)</span>
          )}
        </div>
      </div>

      {/* 進行状況バー */}
      <div className={styles.progressSection}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progressPercent}%` }}></div>
        </div>
        <div className={styles.progressText}>
          <span>解答済み: {answeredIds.length} / {playQuestions.length} 問</span>
          <span data-testid="play-elapsed-seconds">
            <Timer size={14} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            経過時間: {formatPlayElapsedSeconds(elapsedSeconds)}
          </span>
        </div>
      </div>

      {/* 問題表示カード */}
      <div className={styles.quizCard}>
        <div className={styles.questionMeta} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span className={styles.questionType}>
              第 {currentIdx + 1} 問 ({getQuestionTypeLabel(currentQuestion?.type)})
            </span>
            {effectivePlayMode === 'normal' && timeLeft !== null && (
              <span className={`${styles.timer} ${timeLeft <= 5 ? styles.timerWarning : ''}`}>
                ⏱️ 残り {timeLeft} 秒
              </span>
            )}
          </div>
          {currentQuestion && (
            <QuestionBookmarkToggle
              questionId={currentQuestion.id}
              initialBookmarked={bookmarkedQuestionIds.has(currentQuestion.id)}
              onToggle={(bookmarked) => {
                setBookmarkedQuestionIds((prev) => {
                  const next = new Set(prev);
                  if (bookmarked) next.add(currentQuestion.id);
                  else next.delete(currentQuestion.id);
                  return next;
                });
              }}
            />
          )}
        </div>

        <QuestionTextDisplay
          question={currentQuestion}
          className={styles.questionText}
          quickPressDisplayTokens={quickPressDisplayTokens}
          quickPressReservedTokens={quickPressReservedTokens}
          isQuickPressReading={isReadingStarted}
        />

        {showNormalFeedback ? (
          <PostAnswerFeedback
            isCorrect={lastAnswerResult.isCorrect}
            explanation={currentQuestion.explanation}
            correctAnswerDisplay={
              !lastAnswerResult.isCorrect &&
              currentQuestion.type !== 'quick-press'
                ? formatCorrectAnswer(currentQuestion) || undefined
                : undefined
            }
            isLastQuestion={isLastQuestion}
            onNext={handleNextQuestion}
            onViewResults={handleViewResults}
            quickPressTime={
              currentQuestion.type === 'quick-press'
                ? quickPressTimes[currentQuestion.id] ?? currentQuickPressTime
                : undefined
            }
          />
        ) : (
          <>
        {/* 1. 選択肢表示 (単一正解=ラジオ / 複数正解=チェックボックス → 確定ボタン) */}
        {currentQuestion?.type === 'true-false' && (
          <TrueFalseAnswerPanel
            question={currentQuestion}
            onConfirm={submitAnswer}
            disabled={
              isNormalFeedbackFlow
                ? feedbackPending
                : effectivePlayMode !== 'exam' && answeredIds.includes(currentQuestion.id)
            }
          />
        )}

        {currentQuestion?.type === 'multiple-choice' && (
          <ChoiceAnswerPanel
            question={currentQuestion}
            onConfirm={submitAnswer}
            initialAnswer={questionAnswers[currentQuestion.id]}
            disabled={
              isNormalFeedbackFlow
                ? feedbackPending
                : effectivePlayMode !== 'exam' && answeredIds.includes(currentQuestion.id)
            }
          />
        )}

        {/* 2. 記述式の入力 */}
        {currentQuestion?.type === 'text-input' && (() => {
          const inputProps = getTextInputFieldProps(currentQuestion);
          return (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = (e.currentTarget.elements.namedItem('textAnswer') as HTMLInputElement).value;
                submitAnswer(input);
                e.currentTarget.reset();
              }}
              className={styles.inputForm}
            >
              <input
                type={inputProps.type}
                name="textAnswer"
                className={styles.textInput}
                placeholder={inputProps.placeholder}
                inputMode={inputProps.inputMode}
                maxLength={inputProps.maxLength}
                minLength={inputProps.minLength}
                required
                autoComplete="off"
              />
              <button type="submit" className="btn btn-primary" data-analytics="quiz-answer-text-submit">送信</button>
            </form>
          );
        })()}

        {/* 4. 並び替えクイズのUI */}
        {currentQuestion?.type === 'sorting' && (
          <div className={styles.sortingArea}>
            <p className={styles.sortingHint}>ドラッグハンドルで要素を正しい順序に並べ替えてください。</p>
            <SortableSortingList
              items={sortingItems}
              listClassName={styles.sortingList}
              onReorder={(items) =>
                setSortingItems(
                  items.map((item, idx) => ({
                    id: item.id,
                    text: item.text,
                    correctOrder: item.correctOrder ?? idx,
                  }))
                )
              }
              renderItemContent={(item) => (
                <span className={styles.sortingItemText}>{item.text}</span>
              )}
            />
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '20px' }}
              data-analytics="quiz-answer-sorting-submit"
              onClick={() => {
                const sortedIds = sortingItems.map((item) => item.id).join(',');
                submitAnswer(sortedIds);
              }}
            >
              並び替えを確定して解答する
            </button>
          </div>
        )}

        {/* 5. 連想クイズのUI */}
        {currentQuestion?.type === 'association' && (
          <div className={styles.associationArea}>
            <div className={styles.associationHintsList}>
              {currentQuestion.associationHints
                ?.slice(0, activeHintIdx + 1)
                .map((hint, idx) => (
                  <div key={idx} className={styles.associationHintItem}>
                    <span className={styles.associationHintLabel}>ヒント {idx + 1}:</span>
                    <span className={styles.associationHintText}>{hint}</span>
                  </div>
                ))}
            </div>

            {currentQuestion.associationHints && activeHintIdx < currentQuestion.associationHints.length - 1 && (
              <button
                className="btn btn-secondary"
                style={{ width: '100%', marginBottom: '20px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)' }}
                onClick={() => {
                  setActiveHintIdx((prev) => {
                    const next = prev + 1;
                    setAssociationHintIndices((prevIndices) => ({
                      ...prevIndices,
                      [currentQuestion.id]: next
                    }));
                    return next;
                  });
                }}
              >
                次のヒントを表示する (残り {currentQuestion.associationHints.length - 1 - activeHintIdx} 件)
              </button>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = (e.currentTarget.elements.namedItem('associationAnswer') as HTMLInputElement).value;
                submitAnswer(input);
                e.currentTarget.reset();
              }}
              className={styles.inputForm}
            >
              <input
                type="text"
                name="associationAnswer"
                className={styles.textInput}
                placeholder="連想される答えを入力してください..."
                required
                autoComplete="off"
              />
              <button type="submit" className="btn btn-accent" data-analytics="quiz-answer-association-submit">解答を送信</button>
            </form>
          </div>
        )}

        {/* 3. フラッシュカードのフリップ動作 */}
        {effectivePlayMode === 'flashcard' && currentQuestion && (
          <div className={styles.flashcardArea}>
            {!showAnswer ? (
              <button className="btn btn-accent" onClick={() => setShowAnswer(true)} data-analytics="quiz-flashcard-reveal">
                答えを見る
              </button>
            ) : (
              <div className={styles.cardBack}>
                <div className={styles.correctAnswer}>
                  正解: {formatCorrectAnswer(currentQuestion) || currentQuestion.correctTextAnswerList?.[0] || '正解'}
                </div>
                <p className={styles.explanation} dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(currentQuestion.explanation) }} />

                <div className={styles.flashcardActionGrid} style={{ marginTop: '20px' }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, background: '#00f5d4', color: '#111' }}
                    data-analytics="quiz-flashcard-correct"
                    onClick={() => {
                      // 自己申告: 分かった (正解)
                      handleAnswerSubmit('correct');
                    }}
                  >
                    <Check size={18} /> 分かった (正解)
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{ flex: 1, borderColor: '#ff007f', color: '#ff007f' }}
                    data-analytics="quiz-flashcard-incorrect"
                    onClick={() => {
                      // 自己申告: 分からなかった (不正解)
                      handleAnswerSubmit('incorrect');
                    }}
                  >
                    <X size={18} /> 分からなかった (不正解)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {showSkipInCard && (
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="play-skip-question"
            data-analytics="quiz-play-skip"
            style={{ width: '100%', marginTop: '16px' }}
            onClick={handleSkipQuestion}
          >
            わからない（スキップ）
          </button>
        )}
          </>
        )}
      </div>

      {/* アクションボタンバー (ヒント表示) */}
      <div className={styles.actionsBar}>
        {currentQuestion?.hint && !showNormalFeedback && (
          <button className="btn btn-secondary" onClick={() => setShowHint(true)}>
            💡 ヒントを表示
          </button>
        )}
      </div>

      {/* 模擬試験用の問題ナビゲーション */}
      {effectivePlayMode === 'exam' && (
        <div className={styles.examNavGrid}>
          {(quiz.questions ?? []).map((q, idx) => {
            const isAnswered = answeredIds.includes(q.id);
            return (
              <button
                key={q.id}
                className={`${styles.examNavBtn} ${currentIdx === idx ? styles.examNavBtnActive : ''} ${isAnswered ? styles.examNavBtnAnswered : ''}`}
                onClick={() => setCurrentIdx(idx)}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      )}

      {showQuickPressDock && currentQuestion?.type === 'quick-press' && (
        <div className={styles.quickPressDock}>
          <div className={styles.quickPressDockInner}>
            {showSkipQuestion && (
              <div className={styles.quickPressDockSkipSlot}>
                <button
                  type="button"
                  className={`btn btn-secondary ${styles.quickPressSkipBtn}`}
                  data-testid="play-skip-question"
                  data-analytics="quiz-play-skip"
                  onClick={handleSkipQuestion}
                >
                  わからない（スキップ）
                </button>
              </div>
            )}
            <div className={styles.quickPressDockActionSlot}>
              {!isReadingStarted ? (
                <button
                  type="button"
                  className={`${styles.startReadingBtn} btn`}
                  onClick={() => setIsReadingStarted(true)}
                  data-analytics="quiz-quickpress-reading-start"
                >
                  🔊 問読みを開始する
                </button>
              ) : !isQuickPressed ? (
                <button
                  type="button"
                  className={`${styles.quickPressBtn} btn`}
                  onClick={handleQuickPress}
                  data-analytics="quiz-quickpress-buzz"
                >
                  🔴 押して回答する！
                </button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = (e.currentTarget.elements.namedItem('quickAnswer') as HTMLInputElement).value;

                    let isCorrect = false;
                    try {
                      const decodedAnswers =
                        currentQuestion.correctTextAnswerList?.map((ans) =>
                          decodeURIComponent(escape(atob(ans))).trim().toLowerCase().replace(/\s+/g, '')
                        ) || [];
                      const cleanInput = input.trim().toLowerCase().replace(/\s+/g, '');
                      isCorrect = decodedAnswers.includes(cleanInput);
                    } catch (err) {
                      console.error('正解の復号失敗:', err);
                    }

                    if (isCorrect) {
                      setQuickPressTimes((prev) => ({
                        ...prev,
                        [currentQuestion.id]: currentQuickPressTime,
                      }));
                    }

                    submitAnswer(input);

                    e.currentTarget.reset();
                  }}
                  className={styles.quickPressDockForm}
                >
                  <input
                    type="text"
                    name="quickAnswer"
                    ref={quickInputRef}
                    className={styles.textInput}
                    placeholder="答えを入力してください..."
                    required
                    autoComplete="off"
                  />
                  <button type="submit" className="btn btn-primary" data-analytics="quiz-quickpress-answer-submit">
                    送信
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ヒントモーダルダイアログ */}
      {showHint && (
        <div className={styles.modalOverlay} onClick={() => setShowHint(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>💡 問題のヒント</h3>
            <p className={styles.modalText}>{currentQuestion?.hint}</p>
            <button className="btn btn-primary" onClick={() => setShowHint(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function QuizPlayClientBoundary(props: QuizPlayClientProps) {
  return (
    <Suspense fallback={<PlaySkeleton data-testid="quiz-play-skeleton" />}>
      <QuizPlayClient {...props} />
    </Suspense>
  );
}
