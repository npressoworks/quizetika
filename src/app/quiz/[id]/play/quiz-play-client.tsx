'use client';

import { getTextInputFieldProps } from '@/services/text-answer-utils';
import React, { useCallback, useEffect, useMemo, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Timer, HelpCircle, Send, CheckCircle, AlertTriangle, Play, Check, X, ShieldAlert } from 'lucide-react';
import { parseMarkdownToHtml } from '@/lib/security/sanitize';
import { useAuth } from '@/context/auth-context';
import { usePlayState } from '@/hooks/usePlayState';
import { useAiPlayState } from '@/hooks/useAiPlayState';
import { saveAttempt, createLateralAttemptSession, updateFailedQuestionsCount } from '@/services/attempt';
import { addPendingSyncAttempt, generateLocalId } from '@/services/attempt-session';
import { toQuestionAnswerRecords } from '@/services/attempt-answer-display';
import { Quiz, Attempt, Question } from '@/types';
import { auth } from '@/lib/firebase/config';
import styles from './play.module.css';
import { ChoiceAnswerPanel } from '@/components/quiz/choice-answer-panel';
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
} from '@/lib/question-list-session';
import { PlaySkeleton } from '@/components/quiz/play-skeleton';

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
  const playMode = rawMode as 'normal' | 'exam' | 'flashcard' | 'lateral' | 'list' | 'question-list';
  const effectivePlayMode: 'normal' | 'exam' | 'flashcard' | 'lateral' =
    questionListMode || rawMode === 'list'
      ? 'normal'
      : (rawMode as 'normal' | 'exam' | 'flashcard' | 'lateral');
  const feedbackParam = searchParams.get('feedback');
  const showFeedback = feedbackParam === null ? true : feedbackParam === 'true';
  const questionIdParam = searchParams.get('questionId');
  const startAtQuestionId = searchParams.get('startAtQuestionId');

  const quiz = initialQuiz;
  const [online, setOnline] = useState<boolean>(true);
  const [bookmarkedQuestionIds, setBookmarkedQuestionIds] = useState<Set<string>>(new Set());

  const playQuestions = useMemo(() => {
    if (!quiz?.questions?.length) return [];
    if (questionListMode && questionIdParam) {
      const q = (quiz.questions ?? []).find((x) => x.id === questionIdParam);
      return q ? [q] : [];
    }
    return quiz.questions;
  }, [quiz, questionListMode, questionIdParam]);

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
      router.push('/login');
    }
  }, [authLoading, playMode, user, router]);

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
    handleAnswerSubmit,
    clearSession,
    isFinished,
  } = usePlayState({
    quizId,
    userId: user?.id || 'guest',
    mode: playMode === 'lateral' ? 'normal' : (playMode === 'exam' || playMode === 'flashcard' ? playMode : 'normal'),
    questions: playQuestions,
  });

  const [associationHintIndices, setAssociationHintIndices] = useState<{ [questionId: string]: number }>({});
  const [completing, setCompleting] = useState<boolean>(false);

  useEffect(() => {
    if (!quiz || questionListMode || !startAtQuestionId) return;
    const idx = (quiz.questions ?? []).findIndex((q) => q.id === startAtQuestionId);
    if (idx >= 0) setCurrentIdx(idx);
  }, [quiz, startAtQuestionId, questionListMode, setCurrentIdx]);

  // isFinished が true になったときに自動的に完了処理を走らせる
  useEffect(() => {
    if (isFinished && !completing && playQuestions.length > 0 && !authLoading) {
      setCompleting(true);
      handlePlayComplete();
    }
  }, [isFinished, completing, playQuestions.length, authLoading]);

  // 3. 通常・試験・フラッシュカード完了時の処理
  const handlePlayComplete = async (finalScore = score, finalFailed = failedIds) => {
    if (!quiz) return;

    const listId = searchParams.get('listId') || undefined;
    const isQuestionListPlay = questionListMode && !!listId;
    let currentMode: Attempt['mode'];
    if (isQuestionListPlay) {
      currentMode = 'question-list';
    } else if (listId) {
      currentMode = 'list';
    } else {
      currentMode = playMode === 'lateral' ? 'normal' : (playMode === 'exam' || playMode === 'flashcard' ? playMode : 'normal');
    }

    const attemptData: Omit<Attempt, 'id' | 'completedAt'> = {
      userId: user?.id || 'guest',
      quizId: quiz.id,
      listId,
      mode: currentMode,
      score: finalScore,
      totalQuestions: isQuestionListPlay ? 1 : (quiz.questions ?? []).length,
      elapsedSeconds,
      failedQuestionIds: finalFailed,
      questionAnswers: toQuestionAnswerRecords(questionAnswers),
      aiTurnCount: 0,
      aiTurnLimit: null,
    };

    // セッションデータの削除
    clearSession();

    if (online) {
      // オンライン保存
      try {
        const attemptId = await saveAttempt(attemptData);
        // 不正解問題数を更新
        if (user && finalFailed.length > 0) {
          await updateFailedQuestionsCount(user.id, finalFailed.length);
        }

        // 早押しタイムを localStorage に保存 (キー名に attemptId を含める)
        if (Object.keys(quickPressTimes).length > 0) {
          localStorage.setItem(`quizeum_qp_times_${attemptId}`, JSON.stringify(quickPressTimes));
        }

        // 連想クイズの表示ヒント情報を localStorage に保存
        const revealedHintsData = (quiz.questions ?? []).map((q) => {
          if (q.type === 'association') {
            const maxIdx = associationHintIndices[q.id] ?? 0;
            const hints = q.associationHints?.slice(0, maxIdx + 1) || [];
            return {
              questionId: q.id,
              revealedHints: hints,
              revealedCount: hints.length
            };
          }
          return null;
        }).filter(Boolean);

        if (revealedHintsData.length > 0) {
          localStorage.setItem(`quizeum_attempt_hints_${attemptId}`, JSON.stringify(revealedHintsData));
        }

        const listQuery = listId ? `&listId=${listId}` : '';
        router.push(`/quiz/${quiz.id}/result?attemptId=${attemptId}${listQuery}`);
      } catch (error) {
        console.error('[QuizPlay] 保存失敗:', error);
        // 保存失敗時はオフラインフォールバックとして localStorage に保存
        saveOffline(attemptData);
      }
    } else {
      // オフライン保存
      saveOffline(attemptData);
    }
  };

  const saveOffline = (attemptData: Omit<Attempt, 'id' | 'completedAt'>) => {
    if (!quiz) return;
    const localId = generateLocalId();
    addPendingSyncAttempt({
      ...attemptData,
      localId,
      completedAt: new Date().toISOString(),
    });

    // オフライン時も localStorage に早押しタイムを保存
    if (Object.keys(quickPressTimes).length > 0) {
      localStorage.setItem(`quizeum_qp_times_${localId}`, JSON.stringify(quickPressTimes));
    }

    // オフライン時も localStorage に連想クイズの表示ヒント情報を保存
    const revealedHintsData = (quiz.questions ?? []).map((q) => {
      if (q.type === 'association') {
        const maxIdx = associationHintIndices[q.id] ?? 0;
        const hints = q.associationHints?.slice(0, maxIdx + 1) || [];
        return {
          questionId: q.id,
          revealedHints: hints,
          revealedCount: hints.length
        };
      }
      return null;
    }).filter(Boolean);

    if (revealedHintsData.length > 0) {
      localStorage.setItem(`quizeum_attempt_hints_${localId}`, JSON.stringify(revealedHintsData));
    }

    const listId = searchParams.get('listId');
    const listQuery = listId ? `&listId=${listId}` : '';
    // オフライン状態でのリダイレクト（結果画面にて同期警告が出る）
    router.push(`/quiz/${quiz.id}/result?localId=${localId}${listQuery}`);
  };

  // ────────── ウミガメスープ問題専用ステート ──────────
  const [lateralAttemptId, setLateralAttemptId] = useState<string | null>(null);
  const [truthSummary, setTruthSummary] = useState<string>('');
  const [questionInput, setQuestionInput] = useState<string>('');
  const [showTruthForm, setShowTruthForm] = useState<boolean>(false);
  const [isTruthChecking, setIsTruthChecking] = useState<boolean>(false);
  const [truthAdvice, setTruthAdvice] = useState<string | null>(null);
  const [truthPassed, setTruthPassed] = useState<boolean>(false);

  // 初回ロード時にウミガメスープ用の空の Attempt を自動生成
  useEffect(() => {
    if (playMode === 'lateral' && quiz && user && !lateralAttemptId) {
      const currentUserId = user.id;
      const currentQuizId = quiz.id;
      async function initLateralAttempt() {
        try {
          const questionIds = quiz!.questions.map((q) => q.id);
          const aid = await createLateralAttemptSession(
            currentUserId,
            currentQuizId,
            questionIds
          );
          setLateralAttemptId(aid);
        } catch (e) {
          console.error('[QuizPlay] ウミガメセッション作成エラー:', e);
        }
      }
      initLateralAttempt();
    }
  }, [playMode, quiz, user, lateralAttemptId]);

  // ウミガメスープ用AIプレイステートフック
  const aiPlay = useAiPlayState({
    attemptId: lateralAttemptId || '',
    userId: user?.id || '',
    isPremium: false,
    initialHistory: [],
    initialTurnCount: 0,
  });

  // ウミガメ 質問送信
  const handleQuestionSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionInput.trim() || aiPlay.pending) return;
    await aiPlay.askQuestion(questionInput);
    setQuestionInput('');
  };

  // ウミガメ 真相回答判定送信
  const handleTruthVerify = async () => {
    if (!truthSummary.trim() || isTruthChecking || !lateralAttemptId || !user) return;
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
        setTruthAdvice(data.advice || '真相にはまだ遠いようです。もう一度AIとの対話を見直してみましょう。');
      }
    } catch (e) {
      console.error('[verify-truth] 送信エラー:', e);
      setTruthAdvice('判定サーバーでエラーが発生しました。時間を置いてから再試行してください。');
    } finally {
      setIsTruthChecking(false);
    }
  };

  // ────────── 早押しクイズ（ストリーム表示＆カンニング防止） ──────────
  const [isReadingStarted, setIsReadingStarted] = useState<boolean>(false);
  const [isQuickPressed, setIsQuickPressed] = useState<boolean>(false);
  const [instantFeedback, setInstantFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [userAnswer, setUserAnswer] = useState<string>('');
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

  const {
    displayTokens: quickPressDisplayTokens,
    cancelStream: cancelQuickPressStream,
  } = useQuickPressStream({
    enabled: Boolean(quickPressQuestion && isReadingStarted),
    mode: 'api',
    quizId,
    questionId: quickPressQuestion?.id ?? '',
    getIdToken: getQuickPressIdToken,
    onBodyTimingStart: onQuickPressBodyStart,
  });

  useEffect(() => {
    setIsReadingStarted(false);
    setIsQuickPressed(false);
    setInstantFeedback(null);
    setUserAnswer('');
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

  // ────────── UI レンダリング: ウミガメスープ ──────────
  if (playMode === 'lateral') {
    const lateralQuestion = (quiz.questions ?? []).find((q) => q.type === 'lateral-thinking');
    return (
      <div className={styles.lateralContainer}>
        {/* 左カラム: AIチャット */}
        <div className={styles.chatColumn}>
          <div className={styles.chatHeader}>
            <div className={styles.chatTitle}>👻 ウミガメチャット (AI判定)</div>
            <div className={styles.turnCounter}>質問数: {aiPlay.turnCount} / 20</div>
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

            {/* AIが質問を分析中の表示 (Task 4.2) */}
            {aiPlay.pending && (
              <div className={styles.chatPending}>
                <span>・・・AIが質問を分析中です</span>
              </div>
            )}

            {/* 合格クリアアニメーション (Task 4.3) */}
            {truthPassed && (
              <div className={`${styles.chatBubble} ${styles.bubbleSystem}`}>
                🎉 【合格】素晴らしい！見事に真相を解き明かしました！結果画面へ遷移します...
              </div>
            )}
          </div>

          {/* 入力欄 */}
          <div className={styles.chatInputArea}>
            {aiPlay.errorMsg && (
              <div style={{ color: '#ff007f', fontSize: '0.85rem', marginBottom: '8px' }}>
                ⚠️ {aiPlay.errorMsg}
              </div>
            )}
            <form onSubmit={handleQuestionSend} className={styles.chatInputForm}>
              <input
                type="text"
                className={styles.chatInput}
                placeholder={aiPlay.turnCount >= 20 ? "質問の上限に達しました" : "AIに質問する (例: 男は一人でしたか？)..."}
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                disabled={aiPlay.pending || aiPlay.turnCount >= 20 || truthPassed}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={aiPlay.pending || !questionInput.trim() || aiPlay.turnCount >= 20 || truthPassed}
                data-analytics="quiz-lateral-question-send"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>

        {/* 右カラム: 真相回答判定エリア */}
        <div className={styles.infoColumn}>
          <div className={styles.infoCard}>
            <div className={styles.infoCardTitle}>ウミガメのスープ（水平思考クイズ）</div>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.6' }}>
              出題された不思議な物語の裏にある「真相」を暴いてください。<br />
              チャットでAIに手がかりとなる質問を投げ、状況を把握できたら、以下のフォームから「最終的な真相の要約」を提出してください。
            </p>
          </div>

          <div className={styles.infoCard}>
            <div className={styles.infoCardTitle}>真相を解き明かす</div>
            <div className={styles.verifyTruthPanel}>
              <textarea
                className={styles.verifyTextarea}
                placeholder="あなたが解き明かした真相のストーリーを100文字〜1000文字以内で要約して入力してください..."
                value={truthSummary}
                onChange={(e) => setTruthSummary(e.target.value)}
                disabled={isTruthChecking || truthPassed}
              />
              {truthAdvice && (
                <div style={{ color: '#ffb703', fontSize: '0.85rem', background: 'rgba(255, 183, 3, 0.08)', padding: '12px', borderRadius: '4px', border: '1px solid rgba(255, 183, 3, 0.2)' }}>
                  💡 <strong>AIからのヒント:</strong> {truthAdvice}
                </div>
              )}
              <button
                className="btn btn-accent"
                onClick={handleTruthVerify}
                disabled={!truthSummary.trim() || isTruthChecking || truthPassed}
                style={{ width: '100%', marginTop: '10px' }}
                data-analytics="quiz-lateral-truth-submit"
              >
                {isTruthChecking ? 'AIが真相を判定中...' : '真相を送信する'}
              </button>
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
      case 'true-false': return '〇×式';
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

  // すべて解答完了時のリダイレクト・完了トリガー（自動遷移）
  if (isFinished || completing || (isFinished && currentIdx >= playQuestions.length)) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '100px 0' }}>
        <p style={{ color: 'var(--text-muted)' }}>解答データを送信中...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
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
          <span>経過時間: {elapsedSeconds} 秒</span>
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
          isQuickPressReading={isReadingStarted}
        />

        {/* 1. 選択肢表示 (単一正解=ラジオ / 複数正解=チェックボックス → 確定ボタン) */}
        {(currentQuestion?.type === 'multiple-choice' || currentQuestion?.type === 'true-false') && (
          <ChoiceAnswerPanel
            question={currentQuestion}
            onConfirm={handleAnswerSubmit}
            initialAnswer={questionAnswers[currentQuestion.id]}
            disabled={effectivePlayMode !== 'exam' && answeredIds.includes(currentQuestion.id)}
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
                handleAnswerSubmit(input);
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

        {/* 6. 早押し形式の入力 */}
        {currentQuestion?.type === 'quick-press' && (
          <div className={styles.quickPressArea}>
            {!isReadingStarted ? (
              <button
                type="button"
                className={`${styles.startReadingBtn} btn`}
                onClick={() => setIsReadingStarted(true)}
                data-analytics="quiz-quickpress-reading-start"
                style={{
                  width: '100%',
                  padding: '24px',
                  fontSize: '1.4rem',
                  fontWeight: 'bold',
                  letterSpacing: '2px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #00f5d4, #00bbf9)',
                  color: '#111',
                  border: 'none',
                  boxShadow: '0 0 20px rgba(0, 245, 212, 0.4)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s'
                }}
              >
                🔊 問読みを開始する
              </button>
            ) : !isQuickPressed ? (
              <button
                type="button"
                className={`${styles.quickPressBtn} btn`}
                onClick={handleQuickPress}
                data-analytics="quiz-quickpress-buzz"
                style={{
                  width: '100%',
                  padding: '24px',
                  fontSize: '1.4rem',
                  fontWeight: 'bold',
                  letterSpacing: '2px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #ff007f, #7f00ff)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 0 20px rgba(255, 0, 127, 0.4)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s'
                }}
              >
                🔴 押して回答する！
              </button>
            ) : instantFeedback === null ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = (e.currentTarget.elements.namedItem('quickAnswer') as HTMLInputElement).value;
                  setUserAnswer(input);

                  // ローカルで正誤判定（タイム記録のために両モードで共通実行）
                  let isCorrect = false;
                  try {
                    const decodedAnswers = currentQuestion.correctTextAnswerList?.map(ans =>
                      decodeURIComponent(escape(atob(ans))).trim().toLowerCase().replace(/\s+/g, '')
                    ) || [];
                    const cleanInput = input.trim().toLowerCase().replace(/\s+/g, '');
                    isCorrect = decodedAnswers.includes(cleanInput);
                  } catch (err) {
                    console.error('正解の復号失敗:', err);
                  }

                  if (isCorrect) {
                    // 正解した場合は早押しタイムを記録
                    setQuickPressTimes(prev => ({
                      ...prev,
                      [currentQuestion.id]: currentQuickPressTime
                    }));
                  }

                  if (showFeedback) {
                    // 即時正誤表示ONの場合：ローカルで正誤判定結果を表示
                    setInstantFeedback(isCorrect ? 'correct' : 'incorrect');
                  } else {
                    // 即時正誤表示OFFの場合：そのままフックを呼ぶ
                    handleAnswerSubmit(input);
                  }
                  e.currentTarget.reset();
                }}
                className={styles.inputForm}
              >
                <input
                  type="text"
                  name="quickAnswer"
                  ref={quickInputRef}
                  className={styles.textInput}
                  placeholder="答えを入力してください..."
                  required
                  autoComplete="off"
                  disabled={!isQuickPressed}
                />
                <button type="submit" className="btn btn-primary" data-analytics="quiz-quickpress-answer-submit">送信</button>
              </form>
            ) : (
              // 即時正誤フィードバック表示 & 次の問題へボタン
              <div className={styles.feedbackArea} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px',
                  borderRadius: '8px',
                  background: instantFeedback === 'correct' ? 'rgba(0, 245, 212, 0.08)' : 'rgba(255, 0, 127, 0.08)',
                  border: `1px solid ${instantFeedback === 'correct' ? '#00f5d4' : '#ff007f'}`,
                }}>
                  {instantFeedback === 'correct' ? (
                    <>
                      <CheckCircle size={32} color="#00f5d4" />
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#00f5d4' }}>正解！</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                          早押しタイム: <strong style={{ color: '#00f5d4', fontSize: '1.15rem' }}>{currentQuickPressTime}</strong> 秒
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={32} color="#ff007f" />
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#ff007f' }}>不正解...</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          早押しタイム: {currentQuickPressTime} 秒 (正解時のみ記録されます)
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                          正解: {
                            currentQuestion.correctTextAnswerList?.map(ans => {
                              try {
                                return decodeURIComponent(escape(atob(ans)));
                              } catch {
                                return '不明';
                              }
                            }).join(', ')
                          }
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {currentQuestion.explanation && (
                  <div style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-light)',
                    fontSize: '0.95rem',
                    lineHeight: '1.6'
                  }}>
                    <strong style={{ display: 'block', marginBottom: '8px', color: 'var(--text-main)' }}>💡 解説:</strong>
                    <div dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(currentQuestion.explanation) }} />
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-primary"
                  data-analytics="quiz-quickpress-next"
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    handleAnswerSubmit(userAnswer);
                  }}
                >
                  次の問題へ ➔
                </button>
              </div>
            )}
          </div>
        )}

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
                handleAnswerSubmit(sortedIds);
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
                handleAnswerSubmit(input);
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
        {effectivePlayMode === 'flashcard' && (
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
      </div>

      {/* アクションボタンバー (ヒント表示) */}
      <div className={styles.actionsBar}>
        {currentQuestion?.hint && (
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
