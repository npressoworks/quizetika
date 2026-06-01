'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildQuickPressDisplayMarkdown,
  markdownToPlainText,
} from '@/lib/markdown-typewriter';
import {
  QUICK_PRESS_BODY_CHAR_MS,
  QUICK_PRESS_BODY_PAUSE_MS,
  QUICK_PRESS_LABEL,
  QUICK_PRESS_LABEL_CHAR_MS,
  sleep,
} from '@/lib/quick-press-stream-config';

export type QuickPressStreamMode = 'api' | 'local';

type UseQuickPressStreamOptions = {
  enabled: boolean;
  mode: QuickPressStreamMode;
  quizId: string;
  questionId: string;
  /** mode=local のときのみ（テストプレイ等） */
  localBodyMarkdown?: string;
  getIdToken?: () => Promise<string | null>;
  onBodyTimingStart?: () => void;
};

export function useQuickPressStream({
  enabled,
  mode,
  quizId,
  questionId,
  localBodyMarkdown = '',
  getIdToken,
  onBodyTimingStart,
}: UseQuickPressStreamOptions) {
  const [displayMarkdown, setDisplayMarkdown] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const runIdRef = useRef(0);
  const getIdTokenRef = useRef(getIdToken);
  const onBodyTimingStartRef = useRef(onBodyTimingStart);
  const localBodyRef = useRef(localBodyMarkdown);

  getIdTokenRef.current = getIdToken;
  onBodyTimingStartRef.current = onBodyTimingStart;
  localBodyRef.current = localBodyMarkdown;

  const abortActiveIO = useCallback(() => {
    abortRef.current?.abort();
    void readerRef.current?.cancel();
    readerRef.current = null;
    abortRef.current = null;
  }, []);

  /** 進行中の run() を無効化し、ネットワーク受信も止める */
  const cancelStream = useCallback(() => {
    runIdRef.current += 1;
    abortActiveIO();
    setIsStreaming(false);
  }, [abortActiveIO]);

  useEffect(() => {
    if (!enabled) {
      abortActiveIO();
      setIsStreaming(false);
      return;
    }

    const runId = ++runIdRef.current;
    let cancelled = false;

    const isStale = () => cancelled || runId !== runIdRef.current;

    async function streamBodyFromApi(label: string) {
      const token = getIdTokenRef.current
        ? await getIdTokenRef.current()
        : null;
      const params = new URLSearchParams({ quizId, questionId });
      const abort = new AbortController();
      abortRef.current = abort;

      const response = await fetch(`/api/quiz/quick-press-stream?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: abort.signal,
        cache: 'no-store',
      });

      if (!response.ok || !response.body) {
        throw new Error('問題文のストリーム取得に失敗しました');
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      readerRef.current = reader;

      let bodyRaw = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done || isStale()) break;
        if (value) {
          bodyRaw += value;
          setDisplayMarkdown(
            buildQuickPressDisplayMarkdown(
              label,
              bodyRaw,
              markdownToPlainText(bodyRaw).length
            )
          );
        }
      }
    }

    async function streamBodyLocally(label: string, fullBody: string) {
      const plainLength = markdownToPlainText(fullBody).length;
      for (let visible = 1; visible <= plainLength; visible++) {
        if (isStale()) return;
        await sleep(QUICK_PRESS_BODY_CHAR_MS);
        if (isStale()) return;
        setDisplayMarkdown(
          buildQuickPressDisplayMarkdown(label, fullBody, visible)
        );
      }
    }

    async function run() {
      setStreamError(null);
      setDisplayMarkdown('');
      setIsStreaming(true);
      abortActiveIO();

      try {
        for (let i = 1; i <= QUICK_PRESS_LABEL.length; i++) {
          if (isStale()) return;
          await sleep(QUICK_PRESS_LABEL_CHAR_MS);
          if (isStale()) return;
          setDisplayMarkdown(QUICK_PRESS_LABEL.slice(0, i));
        }

        if (isStale()) return;
        await sleep(QUICK_PRESS_BODY_PAUSE_MS);
        if (isStale()) return;

        onBodyTimingStartRef.current?.();

        if (mode === 'local') {
          await streamBodyLocally(QUICK_PRESS_LABEL, localBodyRef.current);
        } else {
          await streamBodyFromApi(QUICK_PRESS_LABEL);
        }
      } catch (err) {
        if (isStale()) return;
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('[useQuickPressStream]', err);
        setStreamError('問題：問題の読み込みに失敗しました。');
        setDisplayMarkdown('問題：問題の読み込みに失敗しました。');
      } finally {
        if (!isStale()) {
          setIsStreaming(false);
          readerRef.current = null;
          abortRef.current = null;
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
      runIdRef.current += 1;
      abortActiveIO();
      setIsStreaming(false);
    };
  }, [enabled, mode, quizId, questionId, abortActiveIO]);

  return {
    displayMarkdown,
    isStreaming,
    streamError,
    cancelStream,
  };
}
