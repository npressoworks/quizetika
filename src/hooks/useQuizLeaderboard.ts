'use client';

import { useEffect, useState } from 'react';
import { getLeaderboard, getMyLeaderboardRank } from '@/services/attempt';
import { LeaderboardRecord, LeaderboardSelfEntry } from '@/types';

export interface QuizLeaderboardBoardState {
  top: LeaderboardRecord[];
  self: LeaderboardSelfEntry | null;
  loading: boolean;
}

export interface UseQuizLeaderboardResult {
  firstPlay: QuizLeaderboardBoardState;
  replay: QuizLeaderboardBoardState;
}

const INITIAL_BOARD_STATE: QuizLeaderboardBoardState = {
  top: [],
  self: null,
  loading: true,
};

/**
 * クイズ詳細画面の初回プレイ・リプレイ両リーダーボードについて、
 * TOP5と自分の順位の取得を1箇所に集約するフック（design.md Phase 38 `useQuizLeaderboard`）。
 *
 * - TOP5取得（`getLeaderboard`）は常に両ボード並行で発行する。
 * - 自分の順位取得（`getMyLeaderboardRank`）は `userId` が非 null の場合のみ、両ボード並行で発行する
 *   （ゲスト時は無駄な問い合わせを避けるため一切発行しない。要件9.12）。
 */
export function useQuizLeaderboard(
  quizId: string,
  userId: string | null
): UseQuizLeaderboardResult {
  const [firstPlay, setFirstPlay] = useState<QuizLeaderboardBoardState>(INITIAL_BOARD_STATE);
  const [replay, setReplay] = useState<QuizLeaderboardBoardState>(INITIAL_BOARD_STATE);

  useEffect(() => {
    let cancelled = false;
    setFirstPlay((prev) => ({ ...prev, loading: true }));
    setReplay((prev) => ({ ...prev, loading: true }));

    const topPromise = Promise.all([
      getLeaderboard(quizId, 'first_play'),
      getLeaderboard(quizId, 'replay'),
    ]);

    const selfPromise: Promise<[LeaderboardSelfEntry | null, LeaderboardSelfEntry | null]> =
      userId
        ? Promise.all([
            getMyLeaderboardRank(quizId, 'first_play', userId),
            getMyLeaderboardRank(quizId, 'replay', userId),
          ])
        : Promise.resolve([null, null]);

    Promise.all([topPromise, selfPromise])
      .then(([[firstTop, replayTop], [firstSelf, replaySelf]]) => {
        if (cancelled) return;
        setFirstPlay({ top: firstTop, self: firstSelf, loading: false });
        setReplay({ top: replayTop, self: replaySelf, loading: false });
      })
      .catch((e) => {
        console.error('[useQuizLeaderboard]', e);
        if (cancelled) return;
        setFirstPlay({ top: [], self: null, loading: false });
        setReplay({ top: [], self: null, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, [quizId, userId]);

  return { firstPlay, replay };
}
