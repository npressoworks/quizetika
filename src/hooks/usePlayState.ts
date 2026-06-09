'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Question } from '@/types';
import { LocalAttemptSession, PlayProgressData } from '@/services/attempt-session';
import { isChoiceAnswerCorrect } from '@/services/choice-answer-utils';
import { isTextInputAnswerCorrect } from '@/services/text-answer-utils';
import { canJudgeQuestion, checkTruthKeywordsLocally } from '@/lib/test-play';
import {
  createElapsedSegmentState,
  startElapsedSegment,
  finalizeElapsedSegment,
  getElapsedDisplaySeconds,
  type ElapsedSegmentState,
} from '@/lib/play-elapsed';

export interface AnswerRecordResult {
  isCorrect: boolean;
  judgeable: boolean;
}

export type QuickPressElapsedPhase =
  | 'pre_reading'
  | 'reading'
  | 'post_reading'
  | 'feedback';

export type QuestionElapsedPolicy =
  | { kind: 'standard' }
  | { kind: 'quick-press'; phase: QuickPressElapsedPhase };

export function isSegmentTicking(
  policy: QuestionElapsedPolicy | undefined,
  feedbackPending: boolean
): boolean {
  if (feedbackPending) return false;
  if (!policy || policy.kind === 'standard') return true;
  return policy.phase === 'reading' || policy.phase === 'post_reading';
}

interface UsePlayStateProps {
  quizId: string;
  userId: string;
  mode: 'normal' | 'exam' | 'flashcard';
  questions: Question[];
  /** false のとき localStorage セッションを読み書きしない（テストプレイ用） */
  persistSession?: boolean;
  /** true のとき正解設定が不完全な問題は正誤判定をスキップする */
  skipJudgmentWhenIncomplete?: boolean;
  /** true のとき回答後に自動で次問へ進まない（通常モードのフィードバックフロー） */
  manualAdvance?: boolean;
  /** 通常モードの区間累計経過時間ポリシー（早押し／標準） */
  elapsedPolicy?: QuestionElapsedPolicy;
}

function judgeAnswer(
  answerTextOrChoiceId: string,
  currentQuestion: Question,
  mode: 'normal' | 'exam' | 'flashcard',
  skipJudgmentWhenIncomplete: boolean
): AnswerRecordResult {
  const judgeable = !skipJudgmentWhenIncomplete || canJudgeQuestion(currentQuestion);
  if (!judgeable) {
    return { isCorrect: false, judgeable: false };
  }

  let isCorrect = false;

  if (mode === 'flashcard') {
    isCorrect = answerTextOrChoiceId === 'correct';
  } else if (currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'true-false') {
    isCorrect = isChoiceAnswerCorrect(answerTextOrChoiceId, currentQuestion);
  } else if (currentQuestion.type === 'text-input' || currentQuestion.type === 'association') {
    isCorrect = isTextInputAnswerCorrect(answerTextOrChoiceId, currentQuestion);
  } else if (currentQuestion.type === 'quick-press') {
    const cleanInput = answerTextOrChoiceId.trim().toLowerCase().replace(/\s+/g, '');
    isCorrect =
      currentQuestion.correctTextAnswerList?.some((ans) => {
        try {
          const decoded = decodeURIComponent(escape(atob(ans)));
          return decoded.trim().toLowerCase().replace(/\s+/g, '') === cleanInput;
        } catch {
          return false;
        }
      }) ?? false;
  } else if (currentQuestion.type === 'sorting') {
    const userSortedIds = answerTextOrChoiceId.split(',');
    const sortingItems = currentQuestion.sortingItems ?? [];

    if (userSortedIds.length !== sortingItems.length) {
      isCorrect = false;
    } else {
      isCorrect = userSortedIds.every((id, idx) => {
        const item = sortingItems.find((s) => s.id === id);
        return item?.correctOrder === idx;
      });
    }
  } else if (currentQuestion.type === 'lateral-thinking') {
    isCorrect = checkTruthKeywordsLocally(
      answerTextOrChoiceId,
      currentQuestion.truthKeywords ?? []
    );
  }

  return { isCorrect, judgeable };
}

export function usePlayState({
  quizId,
  userId,
  mode,
  questions,
  persistSession = true,
  skipJudgmentWhenIncomplete = false,
  manualAdvance = false,
  elapsedPolicy,
}: UsePlayStateProps) {
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [playCompleted, setPlayCompleted] = useState<boolean>(false);
  const [feedbackPending, setFeedbackPending] = useState<boolean>(false);
  const [lastAnswerResult, setLastAnswerResult] = useState<AnswerRecordResult | null>(null);

  const isInitialized = useRef<boolean>(false);
  const recordAnswerRef = useRef<(answer: string) => AnswerRecordResult | null>(() => null);
  const segmentStateRef = useRef<ElapsedSegmentState>(createElapsedSegmentState());
  const elapsedPolicyRef = useRef(elapsedPolicy);
  elapsedPolicyRef.current = elapsedPolicy;

  const elapsedPolicyTickKey =
    elapsedPolicy?.kind === 'quick-press'
      ? `quick-press:${elapsedPolicy.phase}`
      : 'standard';

  const syncElapsedDisplay = useCallback(() => {
    if (mode !== 'normal') return;
    const ticking = isSegmentTicking(elapsedPolicyRef.current, feedbackPending);
    setElapsedSeconds(getElapsedDisplaySeconds(segmentStateRef.current, ticking));
  }, [mode, feedbackPending]);

  const finalizeCurrentSegment = useCallback(() => {
    if (mode !== 'normal') return;
    segmentStateRef.current = finalizeElapsedSegment(segmentStateRef.current);
    setElapsedSeconds(segmentStateRef.current.finalizedSeconds);
  }, [mode]);

  useEffect(() => {
    if (!quizId || !userId || isInitialized.current) return;
    isInitialized.current = true;
    if (!persistSession) return;

    const saved = LocalAttemptSession.load(quizId, userId);
    if (saved && saved.mode === mode && saved.totalQuestions === questions.length) {
      setAnsweredIds(saved.answeredQuestionIds);
      setFailedIds(saved.failedQuestionIds);
      setQuestionAnswers(saved.questionAnswers ?? {});
      setScore(saved.currentScore);
      segmentStateRef.current = createElapsedSegmentState(saved.elapsedSeconds);
      setElapsedSeconds(saved.elapsedSeconds);

      const nextIdx = saved.answeredQuestionIds.length;
      if (nextIdx < questions.length) {
        setCurrentIdx(nextIdx);
      } else if (manualAdvance && saved.answeredQuestionIds.length === questions.length && questions.length > 0) {
        setCurrentIdx(questions.length - 1);
        setFeedbackPending(true);
        setLastAnswerResult({ isCorrect: false, judgeable: true });
      } else {
        setCurrentIdx(questions.length - 1);
      }
    }
  }, [quizId, userId, mode, questions, persistSession, manualAdvance]);

  useEffect(() => {
    if (!persistSession || !quizId || !userId || !isInitialized.current) return;

    const progress: PlayProgressData = {
      quizId,
      userId,
      mode,
      startedAt: new Date().toISOString(),
      answeredQuestionIds: answeredIds,
      failedQuestionIds: failedIds,
      questionAnswers,
      currentScore: score,
      totalQuestions: questions.length,
      elapsedSeconds,
    };

    if (!playCompleted && answeredIds.length < questions.length) {
      LocalAttemptSession.save(quizId, userId, progress);
    }
  }, [
    quizId,
    userId,
    mode,
    answeredIds,
    failedIds,
    questionAnswers,
    score,
    elapsedSeconds,
    questions,
    persistSession,
    playCompleted,
  ]);

  const recordAnswer = useCallback(
    (answerTextOrChoiceId: string): AnswerRecordResult | null => {
      if (questions.length === 0 || currentIdx >= questions.length) return null;

      const currentQuestion = questions[currentIdx];

      if (mode !== 'exam' && answeredIds.includes(currentQuestion.id)) return null;

      if (mode === 'normal') {
        finalizeCurrentSegment();
      }

      const result = judgeAnswer(
        answerTextOrChoiceId,
        currentQuestion,
        mode,
        skipJudgmentWhenIncomplete
      );

      const nextAnswered = [...answeredIds];
      if (!nextAnswered.includes(currentQuestion.id)) {
        nextAnswered.push(currentQuestion.id);
        setAnsweredIds(nextAnswered);
      }

      const nextFailed = [...failedIds];
      if (result.judgeable) {
        if (result.isCorrect) {
          setScore((prev) => prev + 1);
        } else if (!nextFailed.includes(currentQuestion.id)) {
          nextFailed.push(currentQuestion.id);
          setFailedIds(nextFailed);
        }
      }

      setQuestionAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: answerTextOrChoiceId,
      }));

      if (manualAdvance) {
        setFeedbackPending(true);
        setLastAnswerResult(result);
        setTimeLeft(null);
      }

      return result;
    },
    [
      questions,
      currentIdx,
      mode,
      answeredIds,
      failedIds,
      skipJudgmentWhenIncomplete,
      manualAdvance,
      finalizeCurrentSegment,
    ]
  );

  recordAnswerRef.current = recordAnswer;

  const beginLimitCountdown = useCallback(() => {
    if (mode !== 'normal' || currentIdx >= questions.length) return;
    const currentQuestion = questions[currentIdx];
    if (currentQuestion?.limitTime) {
      setTimeLeft(currentQuestion.limitTime);
    }
  }, [mode, currentIdx, questions]);

  const advanceToNext = useCallback(() => {
    setFeedbackPending(false);
    setLastAnswerResult(null);

    if (currentIdx < questions.length - 1) {
      setCurrentIdx((prev) => prev + 1);
    }
  }, [currentIdx, questions.length]);

  const completePlay = useCallback(() => {
    setFeedbackPending(false);
    setLastAnswerResult(null);
    setPlayCompleted(true);
  }, []);

  const handleAnswerSubmit = useCallback(
    (answerTextOrChoiceId: string) => {
      const result = recordAnswer(answerTextOrChoiceId);
      if (!result) return;

      if (!manualAdvance) {
        setFeedbackPending(false);
        setLastAnswerResult(null);
        setShowAnswer(false);
        setCurrentIdx((prev) => (prev < questions.length - 1 ? prev + 1 : prev));
      }
    },
    [recordAnswer, manualAdvance, questions.length]
  );

  useEffect(() => {
    if (mode !== 'normal') return;
    if (segmentStateRef.current.segmentStartedAtMs !== null) {
      segmentStateRef.current = finalizeElapsedSegment(segmentStateRef.current);
    }
  }, [currentIdx, mode]);

  useEffect(() => {
    if (mode !== 'normal') return;
    const ticking = isSegmentTicking(elapsedPolicy, feedbackPending);
    if (ticking) {
      if (segmentStateRef.current.segmentStartedAtMs === null) {
        segmentStateRef.current = startElapsedSegment(segmentStateRef.current);
      }
    } else if (segmentStateRef.current.segmentStartedAtMs !== null) {
      segmentStateRef.current = finalizeElapsedSegment(segmentStateRef.current);
    }
    syncElapsedDisplay();
  }, [mode, elapsedPolicyTickKey, feedbackPending, currentIdx, syncElapsedDisplay]);

  useEffect(() => {
    if (answeredIds.length >= questions.length && !manualAdvance) return;

    const timer = setInterval(() => {
      if (mode === 'normal') {
        const ticking = isSegmentTicking(elapsedPolicyRef.current, feedbackPending);
        if (ticking) {
          setElapsedSeconds(
            getElapsedDisplaySeconds(segmentStateRef.current, true)
          );
        }

        setTimeLeft((prev) => {
          if (prev === null || feedbackPending) return prev;
          if (prev <= 1) {
            if (manualAdvance) {
              recordAnswerRef.current?.('');
            } else {
              handleAnswerSubmit('');
            }
            return null;
          }
          return prev - 1;
        });
        return;
      }

      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [mode, answeredIds, questions, manualAdvance, handleAnswerSubmit, feedbackPending, elapsedPolicyTickKey]);

  useEffect(() => {
    setShowAnswer(false);

    if (questions.length === 0 || currentIdx >= questions.length) return;

    const currentQuestion = questions[currentIdx];
    if (mode === 'normal' && currentQuestion?.limitTime) {
      if (currentQuestion.type === 'quick-press') {
        setTimeLeft(null);
      } else {
        setTimeLeft(currentQuestion.limitTime);
      }
    } else {
      setTimeLeft(null);
    }
  }, [currentIdx, questions, mode]);

  const clearSession = () => {
    LocalAttemptSession.clear(quizId, userId);
  };

  const isFinished = manualAdvance
    ? playCompleted
    : answeredIds.length >= questions.length;

  return {
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
  };
}
