'use client';

import { getTextInputFieldProps, normalizeTextAnswer } from '@/services/text-answer-utils';
import React, { useCallback, useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowBackOutlined,
  CheckOutlined,
  CloseOutlined,
  SecurityOutlined,
} from '@mui/icons-material';
import { parseMarkdownToHtml } from '@/lib/security/sanitize';
import { QuestionTextDisplay } from '@/components/quiz/question-text-display';
import { useQuickPressStream } from '@/hooks/useQuickPressStream';
import { decodeStoredQuestionText } from '@/lib/question-text';
import { useAuth } from '@/context/auth-context';
import { usePlayState, type QuestionElapsedPolicy } from '@/hooks/usePlayState';
import { toQuestionAnswerRecords, formatCorrectAnswer } from '@/services/attempt-answer-display';
import { PostAnswerFeedback } from '@/components/quiz/post-answer-feedback';
import { formatPlayElapsedSeconds } from '@/lib/format-play-elapsed';
import { Quiz, Question } from '@/types';
import {
  TEST_PLAY_QUIZ_ID,
  loadTestPlayPayload,
  prepareQuizForTestPlay,
  saveTestPlayResult,
  canJudgeQuestion,
  TestPlayResult,
  buildTestPlayReturnUrl,
} from '@/lib/test-play';
import { getSupabaseAccessToken } from '@/lib/supabase/auth';
import { PlaySkeleton } from '@/components/quiz/play-skeleton';
import { useAds } from '@/hooks/useAds';
import { VideoAdModal } from '@/components/ads/video-ad-modal';
import { playClasses as styles } from '@/app/quiz/[id]/play/play-classes';
import { ChoiceAnswerPanel } from '@/components/quiz/choice-answer-panel';
import { TrueFalseAnswerPanel } from '@/components/quiz/true-false-answer-panel';
import { SortableSortingList } from '@/components/sorting/sortable-sorting-list';

function TestPlayClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  // 広告制御用のフックとステート
  const { shouldShowVideoAd } = useAds();
  const [showVideoAdModal, setShowVideoAdModal] = useState<boolean>(false);
  const [pendingTransition, setPendingTransition] = useState<(() => void) | null>(null);

  const triggerResultTransition = useCallback((transitionFn: () => void) => {
    if (shouldShowVideoAd()) {
      setPendingTransition(() => transitionFn);
      setShowVideoAdModal(true);
    } else {
      transitionFn();
    }
  }, [shouldShowVideoAd]);

  const handleAdComplete = useCallback(() => {
    setShowVideoAdModal(false);
    if (pendingTransition) {
      pendingTransition();
      setPendingTransition(null);
    }
  }, [pendingTransition]);

  const playMode = (searchParams.get('mode') || 'normal') as 'normal' | 'exam' | 'flashcard';
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [sourcePath, setSourcePath] = useState<string>('/quiz/create');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent('/quiz/test-play/play?mode=normal')}`);
      return;
    }

    if (playMode !== 'normal') {
      router.replace('/quiz/test-play/play?mode=normal');
      return;
    }

    const payload = loadTestPlayPayload(user.id);
    if (!payload) {
      setLoadError('テストプレイデータが見つからないか、有効期限が切れています。');
      setLoading(false);
      return;
    }

    setSourcePath(payload.sourcePath);
    setQuiz(prepareQuizForTestPlay(payload.quizDraft));
    setLoading(false);
  }, [user, authLoading, playMode, router]);

  const [elapsedPolicy, setElapsedPolicy] = useState<QuestionElapsedPolicy>({
    kind: 'standard',
  });

  const {
    currentIdx,
    answeredIds,
    failedIds,
    questionAnswers,
    score,
    elapsedSeconds,
    timeLeft,
    recordAnswer,
    advanceToNext,
    completePlay,
    handleAnswerSubmit,
    feedbackPending,
    lastAnswerResult,
    beginLimitCountdown,
  } = usePlayState({
    quizId: TEST_PLAY_QUIZ_ID,
    userId: user?.id || 'guest',
    mode: 'normal',
    questions: quiz?.questions || [],
    persistSession: false,
    skipJudgmentWhenIncomplete: true,
    manualAdvance: true,
    elapsedPolicy,
  });

  const handlePlayComplete = () => {
    if (!quiz) return;
    const result: TestPlayResult = {
      questionAnswers: toQuestionAnswerRecords(questionAnswers),
      correctCount: score,
      totalQuestions: (quiz.questions ?? []).length,
      elapsedSeconds,
      completedAt: Date.now(),
      failedQuestionIds: failedIds,
    };
    saveTestPlayResult(result);
    triggerResultTransition(() => {
      router.push('/quiz/test-play/result');
    });
  };

  const [isReadingStarted, setIsReadingStarted] = useState(false);
  const [isQuickPressed, setIsQuickPressed] = useState(false);
  const [currentQuickPressTime, setCurrentQuickPressTime] = useState(0);
  const [quickPressTimes, setQuickPressTimes] = useState<Record<string, number>>({});
  const quickPressStartTimeRef = useRef<number | null>(null);
  const quickInputRef = useRef<HTMLInputElement | null>(null);

  const quickPressQuestion =
    quiz?.questions[currentIdx]?.type === 'quick-press'
      ? quiz.questions[currentIdx]
      : undefined;

  const quickPressLocalBody =
    quickPressQuestion != null
      ? decodeStoredQuestionText(quickPressQuestion.questionText, 'quick-press')
      : '';

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
    mode: 'local',
    quizId: TEST_PLAY_QUIZ_ID,
    questionId: quickPressQuestion?.id ?? '',
    localBodyMarkdown: quickPressLocalBody,
    onBodyTimingStart: () => {
      quickPressStartTimeRef.current = Date.now();
    },
    onReadingComplete: handleQuickPressReadingComplete,
  });

  useEffect(() => {
    const q = quiz?.questions[currentIdx];
    if (q?.type !== 'quick-press') {
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
  }, [quiz, currentIdx, isReadingStarted, isQuickPressed, feedbackPending]);

  const [sortingItems, setSortingItems] = useState<{ id: string; text: string; correctOrder: number }[]>([]);
  const [activeHintIdx, setActiveHintIdx] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const [lateralTruth, setLateralTruth] = useState('');
  const [lateralFeedback, setLateralFeedback] = useState<string | null>(null);
  const [lateralChecking, setLateralChecking] = useState(false);

  useEffect(() => {
    setIsReadingStarted(false);
    setIsQuickPressed(false);
    setCurrentQuickPressTime(0);
    setLateralTruth('');
    setLateralFeedback(null);
    setLateralChecking(false);
    quickPressStartTimeRef.current = null;
  }, [currentIdx]);

  /** 水平思考: 本番と同一のAI判定（test-verify-truth API）で真相要約を照合する */
  const handleLateralTruthSubmit = useCallback(
    async (question: Question, truthText: string) => {
      if (!truthText.trim() || lateralChecking) return;
      setLateralChecking(true);
      setLateralFeedback(null);
      try {
        const token = await getSupabaseAccessToken();
        const res = await fetch('/api/quiz/test-verify-truth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            aiContextDetails: question.aiContextDetails ?? '',
            truthKeywords: question.truthKeywords ?? [],
            truthSummary: truthText,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setLateralFeedback(data.message || 'AI判定に失敗しました。もう一度お試しください。');
          return;
        }
        if (data.isCorrect) {
          setLateralFeedback('AI判定 — 正解と判定しました。');
          setTimeout(() => handleAnswerSubmit(truthText), 800);
        } else {
          setLateralFeedback(`AI判定 — 不正解。${data.advice ?? ''}`);
        }
      } catch (e) {
        console.error('[test-verify-truth] 送信エラー:', e);
        setLateralFeedback('通信エラーが発生しました。もう一度お試しください。');
      } finally {
        setLateralChecking(false);
      }
    },
    [lateralChecking, handleAnswerSubmit]
  );

  useEffect(() => {
    if (!quiz || currentIdx >= (quiz.questions ?? []).length) return;
    const currentQuestion = quiz.questions[currentIdx];

    if (currentQuestion.type === 'sorting' && currentQuestion.sortingItems) {
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

  const submitAnswer = (answer: string) => {
    recordAnswer(answer);
  };

  const handleSkipQuestion = () => {
    if (feedbackPending) return;
    recordAnswer('');
  };

  const handleNextQuestion = () => {
    advanceToNext();
  };

  const handleViewResults = () => {
    completePlay();
    handlePlayComplete();
  };

  const handleQuickPress = () => {
    if (isQuickPressed) return;
    setIsQuickPressed(true);
    cancelQuickPressStream();
    let duration = 0;
    if (quickPressStartTimeRef.current !== null) {
      duration = (Date.now() - quickPressStartTimeRef.current) / 1000;
      if (duration < 0) duration = 0;
    }
    setCurrentQuickPressTime(Number(duration.toFixed(2)));
    setTimeout(() => {
      if (quickInputRef.current) {
        quickInputRef.current.disabled = false;
        quickInputRef.current.focus();
      }
    }, 50);
  };

  const getQuestionTypeLabel = (type: Question['type']) => {
    switch (type) {
      case 'multiple-choice': return '選択式';
      case 'true-false': return '〇✕問題';
      case 'text-input': return '記述式';
      case 'quick-press': return '早押し';
      case 'sorting': return '並び替え';
      case 'association': return '連想';
      case 'lateral-thinking': return 'ウミガメのスープ';
      default: return type;
    }
  };

  if (authLoading || loading) {
    return <PlaySkeleton data-testid="quiz-play-skeleton" />;
  }

  if (loadError) {
    return (
      <div className={styles.container}>
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>{loadError}</p>
        <button type="button" className="btn btn-primary" onClick={() => router.push('/quiz/create')}>
          作問画面へ戻る
        </button>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className={styles.container}>
        <p>テストプレイデータを読み込めませんでした。</p>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentIdx];
  const progressPercent = (quiz.questions ?? []).length > 0 ? (answeredIds.length / quiz.questions.length) * 100 : 0;
  const isLastQuestion = currentIdx >= (quiz.questions ?? []).length - 1;
  const judgeable = canJudgeQuestion(currentQuestion);
  const showFeedback = judgeable && feedbackPending && lastAnswerResult;
  const showQuickPressDock =
    judgeable && !feedbackPending && currentQuestion?.type === 'quick-press';
  const showSkipQuestion =
    judgeable &&
    !feedbackPending &&
    (currentQuestion?.type !== 'quick-press' ||
      (isReadingStarted && (isReadingComplete || isQuickPressed)));
  const showSkipInCard = showSkipQuestion && !showQuickPressDock;

  return (
    <div
      className={`${styles.container} ${showQuickPressDock ? styles.containerWithQuickPressDock : ''}`}
    >
      <div
        style={{
          background: 'rgba(127, 0, 255, 0.08)',
          border: '1px solid rgba(127, 0, 255, 0.25)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          fontSize: '0.9rem',
          color: 'var(--text-main)',
        }}
      >
        🔬 <strong>テストプレイモード</strong> — 統計・履歴には記録されません
      </div>

      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => router.push(buildTestPlayReturnUrl(sourcePath))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowBackOutlined sx={{ fontSize: 16 }} />
            編集画面に戻る
          </button>
        </div>
      </div>

      <div className={styles.progressSection}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
        </div>
        <div className={styles.progressText}>
          <span>解答済み: {answeredIds.length} / {(quiz.questions ?? []).length} 問</span>
          <span>経過時間: {formatPlayElapsedSeconds(elapsedSeconds)}</span>
        </div>
      </div>

      <div className={styles.quizCard}>
        <div className={styles.questionMeta}>
          <span className={styles.questionType}>
            第 {currentIdx + 1} 問 ({getQuestionTypeLabel(currentQuestion.type)})
          </span>
          {timeLeft !== null && (
            <span className={`${styles.timer} ${timeLeft <= 5 ? styles.timerWarning : ''}`}>
              ⏱️ 残り {timeLeft} 秒
            </span>
          )}
        </div>

        {!judgeable && (
          <div
            style={{
              background: 'rgba(255, 183, 3, 0.08)',
              border: '1px solid rgba(255, 183, 3, 0.25)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '0.9rem',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
            }}
          >
            <SecurityOutlined sx={{ fontSize: 18, color: '#ffb703' }} style={{ flexShrink: 0 }} />
            <span>
              正解設定が不完全なため、正誤判定をスキップします。
              {currentQuestion.explanation ? ' 解説を確認して次へ進んでください。' : ''}
            </span>
          </div>
        )}

        <QuestionTextDisplay
          question={currentQuestion}
          className={styles.questionText}
          quickPressDisplayTokens={quickPressDisplayTokens}
          quickPressReservedTokens={quickPressReservedTokens}
          isQuickPressReading={isReadingStarted}
        />

        {showFeedback ? (
          <PostAnswerFeedback
            isCorrect={lastAnswerResult.isCorrect}
            explanation={currentQuestion.explanation}
            correctAnswerDisplay={
              !lastAnswerResult.isCorrect && currentQuestion.type !== 'quick-press'
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
            {currentQuestion.type === 'true-false' && (
              <TrueFalseAnswerPanel
                question={currentQuestion}
                onConfirm={submitAnswer}
                disabled={feedbackPending}
              />
            )}

            {currentQuestion.type === 'multiple-choice' && (
              <ChoiceAnswerPanel
                question={currentQuestion}
                onConfirm={submitAnswer}
                initialAnswer={questionAnswers[currentQuestion.id]}
                disabled={feedbackPending}
              />
            )}

            {currentQuestion.type === 'text-input' && (() => {
              const inputProps = getTextInputFieldProps(currentQuestion);
              return (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = (e.currentTarget.elements.namedItem('textAnswer') as HTMLInputElement).value;
                    submitAnswer(normalizeTextAnswer(input));
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
                  <button type="submit" className="btn btn-primary">送信</button>
                </form>
              );
            })()}

            {currentQuestion.type === 'sorting' && (
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
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '20px' }}
                  onClick={() => {
                    const sortedIds = sortingItems.map((item) => item.id).join(',');
                    submitAnswer(sortedIds);
                  }}
                >
                  並び替えを確定して解答する
                </button>
              </div>
            )}

            {currentQuestion.type === 'association' && (
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
                    type="button"
                    className="btn btn-secondary"
                    style={{ width: '100%', marginBottom: '20px' }}
                    onClick={() => setActiveHintIdx((prev) => prev + 1)}
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
                  <button type="submit" className="btn btn-accent">解答を送信</button>
                </form>
              </div>
            )}

            {currentQuestion.type === 'lateral-thinking' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    background: 'rgba(255, 183, 3, 0.08)',
                    border: '1px solid rgba(255, 183, 3, 0.25)',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '0.9rem',
                  }}
                >
                  {judgeable
                    ? '本番と同じAIによる真相判定を利用できます（AI質問チャットは公開後のみ）。'
                    : '真相（裏設定）が未設定のため、AI判定はできません。'}
                </div>
                {judgeable && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleLateralTruthSubmit(currentQuestion, lateralTruth);
                    }}
                  >
                    <textarea
                      className={styles.textInput}
                      style={{ width: '100%', minHeight: '100px', marginBottom: '12px' }}
                      placeholder="真相の要約を入力（本番と同じAI判定）..."
                      value={lateralTruth}
                      onChange={(e) => setLateralTruth(e.target.value)}
                      disabled={lateralChecking}
                    />
                    <button
                      type="submit"
                      className="btn btn-accent"
                      disabled={!lateralTruth.trim() || lateralChecking}
                    >
                      {lateralChecking ? 'AIが判定中...' : '真相を判定する'}
                    </button>
                  </form>
                )}
                {lateralFeedback && (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{lateralFeedback}</p>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleAnswerSubmit('')}
                >
                  {judgeable ? '判定をスキップして次へ' : '次の問題へ'}
                </button>
              </div>
            )}

            {!judgeable && currentQuestion.type !== 'lateral-thinking' && currentQuestion.explanation && (
              <div
                style={{
                  marginTop: '20px',
                  padding: '16px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <strong style={{ display: 'block', marginBottom: '8px' }}>💡 解説:</strong>
                <div className="prose max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(currentQuestion.explanation) }} />
              </div>
            )}

            {!judgeable && currentQuestion.type !== 'lateral-thinking' && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', marginTop: '20px' }}
                onClick={() => handleAnswerSubmit('')}
              >
                判定をスキップして次へ
              </button>
            )}

            {showSkipInCard && (
              <button
                type="button"
                className="btn btn-secondary"
                data-testid="play-skip-question"
                style={{ width: '100%', marginTop: '16px' }}
                onClick={handleSkipQuestion}
              >
                わからない（スキップ）
              </button>
            )}
          </>
        )}
      </div>

      <div className={styles.actionsBar}>
        {currentQuestion.hint && (
          <button type="button" className="btn btn-secondary" onClick={() => setShowHint(true)}>
            💡 ヒントを表示
          </button>
        )}
      </div>

      {showQuickPressDock && currentQuestion.type === 'quick-press' && (
        <div className={styles.quickPressDock}>
          <div className={styles.quickPressDockInner}>
            {showSkipQuestion && (
              <div className={styles.quickPressDockSkipSlot}>
                <button
                  type="button"
                  className={`btn btn-secondary ${styles.quickPressSkipBtn}`}
                  data-testid="play-skip-question"
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
                >
                  🔊 問読みを開始する
                </button>
              ) : !isQuickPressed ? (
                <button
                  type="button"
                  className={`${styles.quickPressBtn} btn`}
                  onClick={handleQuickPress}
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
                    } catch {
                      /* ignore */
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
                  <button type="submit" className="btn btn-primary">
                    送信
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {showHint && (
        <div className={styles.modalOverlay} onClick={() => setShowHint(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>💡 問題のヒント</h3>
            <p className={styles.modalText}>{currentQuestion.hint}</p>
            <button type="button" className="btn btn-primary" onClick={() => setShowHint(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 動画広告モーダル */}
      <VideoAdModal isOpen={showVideoAdModal} onComplete={handleAdComplete} />
    </div>
  );
}

export function TestPlayClientBoundary() {
  return (
    <Suspense fallback={<PlaySkeleton data-testid="quiz-play-skeleton" />}>
      <TestPlayClient />
    </Suspense>
  );
}
