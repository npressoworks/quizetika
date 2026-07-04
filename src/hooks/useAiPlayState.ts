'use client';

import { useRef, useState } from 'react';
import { AiQuestion } from '@/types';
import { getSupabaseAccessToken } from '@/lib/supabase/auth';
import {
  findCachedAnswer,
  FREE_TIER_PER_QUIZ_LIMIT,
  type TurnsRemaining,
  type AiTurnLimitType,
} from '@/services/ask-ai-utils';

interface UseAiPlayStateProps {
  attemptId: string;
  userId: string;
  hasUnlimitedAiQuestions?: boolean;
  initialHistory?: AiQuestion[];
  initialTurnCount?: number;
}

const DEFAULT_TURNS_REMAINING: TurnsRemaining = {
  perQuiz: FREE_TIER_PER_QUIZ_LIMIT,
  globalDaily: 150,
};

export function useAiPlayState({
  attemptId,
  userId,
  hasUnlimitedAiQuestions = false,
  initialHistory = [],
  initialTurnCount = 0,
}: UseAiPlayStateProps) {
  const [history, setHistory] = useState<AiQuestion[]>(initialHistory);
  const [turnCount, setTurnCount] = useState<number>(initialTurnCount);
  const [turnsRemaining, setTurnsRemaining] = useState<TurnsRemaining | null>(
    hasUnlimitedAiQuestions ? { perQuiz: null, globalDaily: null } : DEFAULT_TURNS_REMAINING
  );
  const [limitType, setLimitType] = useState<AiTurnLimitType | null>(null);
  const [pending, setPending] = useState<boolean>(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const questionLimitReached =
    !hasUnlimitedAiQuestions &&
    (turnsRemaining?.perQuiz === 0 || turnsRemaining?.globalDaily === 0);

  const askQuestion = async (questionText: string) => {
    if (!questionText.trim() || pending || inFlightRef.current) return;
    setErrorMsg(null);
    setLimitType(null);

    const cached = findCachedAnswer(questionText, history);
    if (cached) {
      const cachedEntry: AiQuestion = {
        id: `cache_${Date.now()}`,
        questionText,
        answerType: cached.answerType,
        aiComment: cached.aiComment,
        isFromCache: true,
        createdAt: new Date(),
      };
      setHistory((prev) => [...prev, cachedEntry]);
      return;
    }

    inFlightRef.current = true;
    setPendingQuestion(questionText);
    setPending(true);

    try {
      const token = await getSupabaseAccessToken();
      const res = await fetch('/api/attempt/ask-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          attemptId,
          questionText,
          userId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'limit-exceeded') {
          setLimitType(data.limitType ?? null);
          setErrorMsg(
            data.message ||
              '本日の質問上限に達しました。Pro プランで制限を解除できます。'
          );
          if (data.limitType === 'per-quiz') {
            setTurnsRemaining((prev) => ({
              perQuiz: 0,
              globalDaily: prev?.globalDaily ?? 0,
            }));
          } else if (data.limitType === 'global-daily') {
            setTurnsRemaining((prev) => ({
              perQuiz: prev?.perQuiz ?? 0,
              globalDaily: 0,
            }));
          }
        } else {
          throw new Error(data.message || 'AI判定APIでエラーが発生しました');
        }
        return;
      }

      const newEntry: AiQuestion = {
        id: `${attemptId}_${Date.now()}`,
        questionText,
        answerType: data.answerType,
        aiComment: data.aiComment,
        isFromCache: data.isFromCache ?? false,
        createdAt: new Date(),
      };

      setHistory((prev) => [...prev, newEntry]);

      if (data.turnsRemaining) {
        setTurnsRemaining(data.turnsRemaining);
      }

      if (!data.isFromCache) {
        setTurnCount((prev) => prev + 1);
      }
    } catch (e: unknown) {
      console.error('[useAiPlayState] 質問送信失敗:', e);
      const errorEntry: AiQuestion = {
        id: `err_${Date.now()}`,
        questionText,
        answerType: 'unknown',
        aiComment:
          '通信エラーが発生しました。インターネット接続を確認し、もう一度送信してください。',
        isFromCache: false,
        createdAt: new Date(),
      };
      setHistory((prev) => [...prev, errorEntry]);
    } finally {
      inFlightRef.current = false;
      setPending(false);
      setPendingQuestion(null);
    }
  };

  const isAwaitingResponse = pending || pendingQuestion !== null;

  const perQuizUsed =
    hasUnlimitedAiQuestions || turnsRemaining?.perQuiz == null
      ? turnCount
      : FREE_TIER_PER_QUIZ_LIMIT - turnsRemaining.perQuiz;

  return {
    history,
    setHistory,
    turnCount,
    setTurnCount,
    turnsRemaining,
    limitType,
    questionLimitReached,
    perQuizUsed,
    pending,
    pendingQuestion,
    isAwaitingResponse,
    errorMsg,
    askQuestion,
  };
}
