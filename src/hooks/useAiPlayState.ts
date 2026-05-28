'use client';

import { useState } from 'react';
import { AiQuestion } from '@/types';

interface UseAiPlayStateProps {
  attemptId: string;
  userId: string;
  isPremium?: boolean;
  initialHistory?: AiQuestion[];
  initialTurnCount?: number;
}

export function useAiPlayState({
  attemptId,
  userId,
  isPremium = false,
  initialHistory = [],
  initialTurnCount = 0,
}: UseAiPlayStateProps) {
  const [history, setHistory] = useState<AiQuestion[]>(initialHistory);
  const [turnCount, setTurnCount] = useState<number>(initialTurnCount);
  const [pending, setPending] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 質問のキャッシュ検索 (全角半角/スペース等のブレを吸収するため正規化して比較)
  const findCachedAnswer = (text: string): AiQuestion | null => {
    const clean = text.trim().toLowerCase().replace(/[\s\u3000]/g, '');
    return history.find((h) => {
      const cleanH = h.questionText.trim().toLowerCase().replace(/[\s\u3000]/g, '');
      return cleanH === clean && h.answerType !== 'unknown';
    }) || null;
  };

  // 質問送信
  const askQuestion = async (questionText: string) => {
    if (!questionText.trim() || pending) return;
    setErrorMsg(null);

    // 1. 同一質問のキャッシュ照合
    const cached = findCachedAnswer(questionText);
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

    // 2. 質問回数の上限チェック (無料ユーザー: 20回制限)
    if (!isPremium && turnCount >= 20) {
      setErrorMsg('本日の質問上限（20回）に達しました。プレミアムプランで無制限にプレイできます。');
      return;
    }

    setPending(true);

    try {
      const res = await fetch('/api/attempt/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          questionText,
          userId,
          isPremium,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'limit-exceeded') {
          setErrorMsg('本日の質問上限に達しました。');
        } else {
          throw new Error(data.message || 'AI判定APIでエラーが発生しました');
        }
        return;
      }

      // 新しい回答の追加
      const newEntry: AiQuestion = {
        id: `${attemptId}_${Date.now()}`,
        questionText,
        answerType: data.answerType,
        aiComment: data.aiComment,
        isFromCache: data.isFromCache ?? false,
        createdAt: new Date(),
      };

      setHistory((prev) => [...prev, newEntry]);
      
      if (!data.isFromCache) {
        setTurnCount((prev) => prev + 1);
      }
    } catch (e: any) {
      console.error('[useAiPlayState] 質問送信失敗:', e);
      // 通信エラー時バブルの挿入
      const errorEntry: AiQuestion = {
        id: `err_${Date.now()}`,
        questionText,
        answerType: 'unknown',
        aiComment: '通信エラーが発生しました。インターネット接続を確認し、もう一度送信してください。',
        isFromCache: false,
        createdAt: new Date(),
      };
      setHistory((prev) => [...prev, errorEntry]);
    } finally {
      setPending(false);
    }
  };

  return {
    history,
    setHistory,
    turnCount,
    setTurnCount,
    pending,
    errorMsg,
    askQuestion,
  };
}
