'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabaseAccessToken } from '@/lib/supabase/auth';
import type { Question } from '@/types';
import type { QuizFormat } from '@/lib/quiz-format';
import type { AiAuthoringUsage } from '@/services/ai-authoring-types';

export type AiGenerationStatus = 'idle' | 'generating' | 'validating' | 'completed';

interface UseAiQuizAuthoringOptions {
  userId: string | undefined;
  isProUser: boolean;
  quizId?: string;
  onAppendQuestions: (questions: Question[]) => void;
  onSetThumbnailUrl: (url: string) => void;
}

export function useAiQuizAuthoring({
  userId,
  isProUser,
  quizId,
  onAppendQuestions,
  onSetThumbnailUrl,
}: UseAiQuizAuthoringOptions) {
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<AiGenerationStatus>('idle');
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [usageQuestions, setUsageQuestions] = useState<AiAuthoringUsage | null>(null);
  const [usageThumbnail, setUsageThumbnail] = useState<AiAuthoringUsage | null>(null);
  const [usageChat, setUsageChat] = useState<AiAuthoringUsage | null>(null);
  const [isUsageLoading, setIsUsageLoading] = useState(false);

  const fetchUsage = useCallback(async () => {
    if (!userId || !isProUser) return;

    setIsUsageLoading(true);
    try {
      const token = await getSupabaseAccessToken();
      const res = await fetch(
        `/api/quiz/ai-authoring-usage?userId=${encodeURIComponent(userId)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setErrorMessage('ログインが必要です');
        } else if (res.status === 403) {
          setErrorMessage(data.message ?? 'Pro プランが必要です');
        }
        return;
      }
      setUsageQuestions(data.questions);
      setUsageThumbnail(data.thumbnail);
      setUsageChat(data.chat);
    } catch {
      setErrorMessage('残り回数の取得に失敗しました');
    } finally {
      setIsUsageLoading(false);
    }
  }, [userId, isProUser]);

  useEffect(() => {
    if (isProUser && userId) {
      fetchUsage();
    }
  }, [isProUser, userId, fetchUsage]);

  const generateQuestions = async (
    prompt: string,
    format: QuizFormat,
    meta?: { title?: string; description?: string; genre?: string }
  ) => {
    if (!userId) {
      setErrorMessage('ログインが必要です');
      return;
    }

    setErrorMessage(null);
    setIsGeneratingQuestions(true);
    setGenerationStatus('generating');

    // 5.5秒後に自動的に検証中ステータスへと移行させるタイマー
    const timerId = setTimeout(() => {
      setGenerationStatus('validating');
    }, 5500);

    try {
      const token = await getSupabaseAccessToken();
      const res = await fetch('/api/quiz/ai-generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt,
          format,
          userId,
          title: meta?.title,
          description: meta?.description,
          genre: meta?.genre,
        }),
      });

      // レスポンスが返ってきたら、検証フェーズに明示的に移行（すでにタイマーで移行していても上書き）
      setGenerationStatus('validating');

      const data = await res.json();

      if (!res.ok) {
        setGenerationStatus('idle');
        if (res.status === 401) {
          setErrorMessage('ログインが必要です');
        } else if (res.status === 403) {
          setErrorMessage(data.message ?? 'Pro プランが必要です');
        } else if (res.status === 429) {
          setErrorMessage(data.message ?? '本日の作問上限に達しました');
          if (data.usage) setUsageQuestions(data.usage);
        } else if (res.status === 422) {
          setErrorMessage(data.message ?? '生成された問題が検証に合格しませんでした');
        } else if (res.status === 503) {
          setErrorMessage(data.message ?? 'AI が応答できませんでした');
        } else {
          setErrorMessage(data.message ?? '問題の生成に失敗しました');
        }
        return;
      }

      onAppendQuestions(data.questions);
      if (data.usage) setUsageQuestions(data.usage);
      
      setGenerationStatus('completed');
      // 3秒後にアイドル状態に戻す
      setTimeout(() => {
        setGenerationStatus('idle');
      }, 3000);
    } catch {
      setGenerationStatus('idle');
      setErrorMessage('問題の生成に失敗しました');
    } finally {
      clearTimeout(timerId);
      setIsGeneratingQuestions(false);
    }
  };

  const generateThumbnail = async (title: string, description: string) => {
    if (!userId) {
      setErrorMessage('ログインが必要です');
      return;
    }

    setErrorMessage(null);
    setIsGeneratingThumbnail(true);

    try {
      const token = await getSupabaseAccessToken();
      const res = await fetch('/api/quiz/ai-generate-thumbnail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title,
          description,
          userId,
          quizId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setErrorMessage('ログインが必要です');
        } else if (res.status === 403) {
          setErrorMessage(data.message ?? 'Pro プランが必要です');
        } else if (res.status === 429) {
          setErrorMessage(data.message ?? '本日のサムネ生成上限に達しました');
          if (data.usage) setUsageThumbnail(data.usage);
        } else if (res.status === 503) {
          setErrorMessage(data.message ?? 'AI が応答できませんでした');
        } else if (res.status === 400) {
          setErrorMessage(data.message ?? 'タイトルと説明文を入力してください');
        } else {
          setErrorMessage(data.message ?? 'サムネイルの生成に失敗しました');
        }
        return;
      }

      onSetThumbnailUrl(data.thumbnailUrl);
      if (data.usage) setUsageThumbnail(data.usage);
    } catch {
      setErrorMessage('サムネイルの生成に失敗しました');
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  return {
    isGeneratingQuestions,
    generationStatus,
    isGeneratingThumbnail,
    errorMessage,
    usageQuestions,
    usageThumbnail,
    usageChat,
    isUsageLoading,
    generateQuestions,
    generateThumbnail,
    clearError: () => setErrorMessage(null),
  };
}
