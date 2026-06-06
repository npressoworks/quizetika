'use client';

import { getTextInputFieldProps } from '@/services/text-answer-utils';
import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Check,
  X,
  ShieldAlert,
} from 'lucide-react';
import { parseMarkdownToHtml } from '@/lib/security/sanitize';
import { QuestionTextDisplay } from '@/components/quiz/question-text-display';
import { useQuickPressStream } from '@/hooks/useQuickPressStream';
import { decodeStoredQuestionText } from '@/lib/question-text';
import { useAuth } from '@/context/auth-context';
import { usePlayState } from '@/hooks/usePlayState';
import { toQuestionAnswerRecords } from '@/services/attempt-answer-display';
import { Quiz, Question } from '@/types';
import {
  TEST_PLAY_QUIZ_ID,
  loadTestPlayPayload,
  prepareQuizForTestPlay,
  saveTestPlayResult,
  canJudgeQuestion,
  checkTruthKeywordsLocally,
  TestPlayResult,
  buildTestPlayReturnUrl,
} from '@/lib/test-play';
import styles from '@/app/quiz/[id]/play/play.module.css';
import { ChoiceAnswerPanel } from '@/components/quiz/choice-answer-panel';
import { SortableSortingList } from '@/components/sorting/sortable-sorting-list';

function TestPlayPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

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

  const {
    currentIdx,
    answeredIds,
    failedIds,
    questionAnswers,
    score,
    elapsedSeconds,
    timeLeft,
    handleAnswerSubmit,
    isFinished,
  } = usePlayState({
    quizId: TEST_PLAY_QUIZ_ID,
    userId: user?.id || 'guest',
    mode: 'normal',
    questions: quiz?.questions || [],
    persistSession: false,
    skipJudgmentWhenIncomplete: true,
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
    router.push('/quiz/test-play/result');
  };

  const [isReadingStarted, setIsReadingStarted] = useState(false);
  const [isQuickPressed, setIsQuickPressed] = useState(false);
  const [instantFeedback, setInstantFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [currentQuickPressTime, setCurrentQuickPressTime] = useState(0);
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

  const { displayTokens: quickPressDisplayTokens, cancelStream: cancelQuickPressStream } =
    useQuickPressStream({
      enabled: Boolean(quickPressQuestion && isReadingStarted),
      mode: 'local',
      quizId: TEST_PLAY_QUIZ_ID,
      questionId: quickPressQuestion?.id ?? '',
      localBodyMarkdown: quickPressLocalBody,
      onBodyTimingStart: () => {
        quickPressStartTimeRef.current = Date.now();
      },
    });

  const [sortingItems, setSortingItems] = useState<{ id: string; text: string; correctOrder: number }[]>([]);
  const [activeHintIdx, setActiveHintIdx] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const [lateralTruth, setLateralTruth] = useState('');
  const [lateralFeedback, setLateralFeedback] = useState<string | null>(null);

  useEffect(() => {
    setIsReadingStarted(false);
    setIsQuickPressed(false);
    setInstantFeedback(null);
    setUserAnswer('');
    setCurrentQuickPressTime(0);
    setLateralTruth('');
    setLateralFeedback(null);
    quickPressStartTimeRef.current = null;
  }, [currentIdx]);

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
      case 'true-false': return '〇×式';
      case 'text-input': return '記述式';
      case 'quick-press': return '早押し';
      case 'sorting': return '並び替え';
      case 'association': return '連想';
      case 'lateral-thinking': return 'ウミガメのスープ';
      default: return type;
    }
  };

  if (authLoading || loading) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '100px 0' }}>
        <p style={{ color: 'var(--text-muted)' }}>テストプレイを準備中...</p>
      </div>
    );
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

  if (isFinished && currentIdx >= (quiz.questions ?? []).length) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '100px 0' }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>全問終了しました！</p>
        <button type="button" className="btn btn-primary" onClick={handlePlayComplete}>
          結果を確認する
        </button>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentIdx];
  const progressPercent = (quiz.questions ?? []).length > 0 ? (answeredIds.length / quiz.questions.length) * 100 : 0;
  const judgeable = canJudgeQuestion(currentQuestion);

  return (
    <div className={styles.container}>
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
            <ArrowLeft size={16} />
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
          <span>経過時間: {elapsedSeconds} 秒</span>
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
            <ShieldAlert size={18} style={{ color: '#ffb703', flexShrink: 0 }} />
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
          isQuickPressReading={isReadingStarted}
        />

        {(currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'true-false') && (
          <ChoiceAnswerPanel
            question={currentQuestion}
            onConfirm={handleAnswerSubmit}
            initialAnswer={questionAnswers[currentQuestion.id]}
            disabled={answeredIds.includes(currentQuestion.id)}
          />
        )}

        {currentQuestion.type === 'text-input' && (() => {
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
              <button type="submit" className="btn btn-primary">送信</button>
            </form>
          );
        })()}

        {currentQuestion.type === 'quick-press' && (
          <div className={styles.quickPressArea}>
            {!isReadingStarted ? (
              <button
                type="button"
                className={`${styles.startReadingBtn} btn`}
                onClick={() => setIsReadingStarted(true)}
                style={{
                  width: '100%',
                  padding: '24px',
                  fontSize: '1.4rem',
                  fontWeight: 'bold',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #00f5d4, #00bbf9)',
                  color: '#111',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                🔊 問読みを開始する
              </button>
            ) : !isQuickPressed ? (
              <button
                type="button"
                className={`${styles.quickPressBtn} btn`}
                onClick={handleQuickPress}
                style={{
                  width: '100%',
                  padding: '24px',
                  fontSize: '1.4rem',
                  fontWeight: 'bold',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #ff007f, #7f00ff)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
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
                  let isCorrect = false;
                  try {
                    const decodedAnswers = currentQuestion.correctTextAnswerList?.map((ans) =>
                      decodeURIComponent(escape(atob(ans))).trim().toLowerCase().replace(/\s+/g, '')
                    ) || [];
                    const cleanInput = input.trim().toLowerCase().replace(/\s+/g, '');
                    isCorrect = decodedAnswers.includes(cleanInput);
                  } catch {
                    /* ignore */
                  }
                  setInstantFeedback(isCorrect ? 'correct' : 'incorrect');
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
                <button type="submit" className="btn btn-primary">送信</button>
              </form>
            ) : (
              <div className={styles.feedbackArea} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    borderRadius: '8px',
                    background: instantFeedback === 'correct' ? 'rgba(0, 245, 212, 0.08)' : 'rgba(255, 0, 127, 0.08)',
                    border: `1px solid ${instantFeedback === 'correct' ? '#00f5d4' : '#ff007f'}`,
                  }}
                >
                  {instantFeedback === 'correct' ? (
                    <>
                      <CheckCircle size={32} color="#00f5d4" />
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#00f5d4' }}>正解！</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                          早押しタイム: <strong style={{ color: '#00f5d4' }}>{currentQuickPressTime}</strong> 秒
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={32} color="#ff007f" />
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#ff007f' }}>不正解...</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                          正解:{' '}
                          {currentQuestion.correctTextAnswerList?.map((ans) => {
                            try {
                              return decodeURIComponent(escape(atob(ans)));
                            } catch {
                              return '不明';
                            }
                          }).join(', ')}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {currentQuestion.explanation && (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-light)',
                      fontSize: '0.95rem',
                      lineHeight: '1.6',
                    }}
                  >
                    <strong style={{ display: 'block', marginBottom: '8px' }}>💡 解説:</strong>
                    <div dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(currentQuestion.explanation) }} />
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '14px' }}
                  onClick={() => handleAnswerSubmit(userAnswer)}
                >
                  次の問題へ ➔
                </button>
              </div>
            )}
          </div>
        )}

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
                handleAnswerSubmit(sortedIds);
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
              テストプレイでは AI 判定は利用できません。公開後にご確認ください。
              {judgeable
                ? ' 真相キーワードによるローカル判定のみ可能です。'
                : ' 真相キーワードが未設定のため、正誤判定はできません。'}
            </div>
            {judgeable && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const passed = checkTruthKeywordsLocally(
                    lateralTruth,
                    currentQuestion.truthKeywords ?? []
                  );
                  setLateralFeedback(
                    passed
                      ? 'キーワード一致 — 正解と判定しました。'
                      : 'キーワードが一致しませんでした。'
                  );
                  if (passed) {
                    setTimeout(() => handleAnswerSubmit(lateralTruth), 800);
                  }
                }}
              >
                <textarea
                  className={styles.textInput}
                  style={{ width: '100%', minHeight: '100px', marginBottom: '12px' }}
                  placeholder="真相の要約を入力（キーワード部分一致で判定）..."
                  value={lateralTruth}
                  onChange={(e) => setLateralTruth(e.target.value)}
                />
                <button type="submit" className="btn btn-accent" disabled={!lateralTruth.trim()}>
                  真相を判定する
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
            <div dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(currentQuestion.explanation) }} />
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
      </div>

      <div className={styles.actionsBar}>
        {currentQuestion.hint && (
          <button type="button" className="btn btn-secondary" onClick={() => setShowHint(true)}>
            💡 ヒントを表示
          </button>
        )}
      </div>

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
    </div>
  );
}

export default function TestPlayPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container} style={{ textAlign: 'center', padding: '100px 0' }}>
          <p style={{ color: 'var(--text-muted)' }}>テストプレイを準備中...</p>
        </div>
      }
    >
      <TestPlayPageContent />
    </Suspense>
  );
}
