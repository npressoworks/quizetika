/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useQuizLeaderboard } from '@/hooks/useQuizLeaderboard';
import { LeaderboardRecord, LeaderboardSelfEntry } from '@/types';

jest.mock('@/services/attempt', () => ({
  getLeaderboard: jest.fn(),
  getMyLeaderboardRank: jest.fn(),
}));

import { getLeaderboard, getMyLeaderboardRank } from '@/services/attempt';

const mockGetLeaderboard = getLeaderboard as jest.Mock;
const mockGetMyLeaderboardRank = getMyLeaderboardRank as jest.Mock;

const firstTop: LeaderboardRecord[] = [
  {
    userId: 'user-top-1',
    displayName: '初回トップ',
    score: 10,
    elapsedSeconds: 30,
    completedAt: new Date('2026-07-01T00:00:00Z'),
  },
];

const replayTop: LeaderboardRecord[] = [
  {
    userId: 'user-top-2',
    displayName: 'リプレイトップ',
    score: 9,
    elapsedSeconds: 40,
    completedAt: new Date('2026-07-02T00:00:00Z'),
  },
];

const firstSelf: LeaderboardSelfEntry = {
  userId: 'user-1',
  displayName: '自分',
  score: 8,
  elapsedSeconds: 50,
  completedAt: new Date('2026-07-03T00:00:00Z'),
  rank: 6,
};

const replaySelf: LeaderboardSelfEntry = {
  userId: 'user-1',
  displayName: '自分',
  score: 7,
  elapsedSeconds: 60,
  completedAt: new Date('2026-07-04T00:00:00Z'),
  rank: 3,
};

describe('useQuizLeaderboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('認証済みユーザーで両ボードのTOP5・自分の順位が取得される', async () => {
    mockGetLeaderboard.mockImplementation((_quizId: string, board: 'first_play' | 'replay') =>
      Promise.resolve(board === 'first_play' ? firstTop : replayTop)
    );
    mockGetMyLeaderboardRank.mockImplementation(
      (_quizId: string, board: 'first_play' | 'replay', _userId: string) =>
        Promise.resolve(board === 'first_play' ? firstSelf : replaySelf)
    );

    const { result } = renderHook(() => useQuizLeaderboard('quiz-1', 'user-1'));

    expect(result.current.firstPlay.loading).toBe(true);
    expect(result.current.replay.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.firstPlay.loading).toBe(false);
      expect(result.current.replay.loading).toBe(false);
    });

    // getLeaderboard は初回プレイ・リプレイの2回、並行して発行される
    expect(mockGetLeaderboard).toHaveBeenCalledTimes(2);
    expect(mockGetLeaderboard).toHaveBeenCalledWith('quiz-1', 'first_play');
    expect(mockGetLeaderboard).toHaveBeenCalledWith('quiz-1', 'replay');

    // getMyLeaderboardRank も初回プレイ・リプレイの2回、並行して発行される
    expect(mockGetMyLeaderboardRank).toHaveBeenCalledTimes(2);
    expect(mockGetMyLeaderboardRank).toHaveBeenCalledWith('quiz-1', 'first_play', 'user-1');
    expect(mockGetMyLeaderboardRank).toHaveBeenCalledWith('quiz-1', 'replay', 'user-1');

    expect(result.current.firstPlay.top).toEqual(firstTop);
    expect(result.current.firstPlay.self).toEqual(firstSelf);
    expect(result.current.replay.top).toEqual(replayTop);
    expect(result.current.replay.self).toEqual(replaySelf);
  });

  it('未ログイン（ゲスト）時は自分の順位の問い合わせを一切発行しない', async () => {
    mockGetLeaderboard.mockImplementation((_quizId: string, board: 'first_play' | 'replay') =>
      Promise.resolve(board === 'first_play' ? firstTop : replayTop)
    );

    const { result } = renderHook(() => useQuizLeaderboard('quiz-1', null));

    await waitFor(() => {
      expect(result.current.firstPlay.loading).toBe(false);
      expect(result.current.replay.loading).toBe(false);
    });

    // ゲストのときは getMyLeaderboardRank が一度も呼ばれない
    expect(mockGetMyLeaderboardRank).toHaveBeenCalledTimes(0);

    // TOP5 の取得は引き続き2回発行され、表示される
    expect(mockGetLeaderboard).toHaveBeenCalledTimes(2);
    expect(result.current.firstPlay.top).toEqual(firstTop);
    expect(result.current.replay.top).toEqual(replayTop);
    expect(result.current.firstPlay.self).toBeNull();
    expect(result.current.replay.self).toBeNull();
  });

  it('一方のボードに自分の記録がなくても、もう一方のボードの自分の順位取得結果に影響しない', async () => {
    mockGetLeaderboard.mockImplementation((_quizId: string, board: 'first_play' | 'replay') =>
      Promise.resolve(board === 'first_play' ? firstTop : replayTop)
    );
    // リプレイ側は自分の記録なし（null）、初回プレイ側は記録あり
    mockGetMyLeaderboardRank.mockImplementation(
      (_quizId: string, board: 'first_play' | 'replay', _userId: string) =>
        Promise.resolve(board === 'first_play' ? firstSelf : null)
    );

    const { result } = renderHook(() => useQuizLeaderboard('quiz-1', 'user-1'));

    await waitFor(() => {
      expect(result.current.firstPlay.loading).toBe(false);
      expect(result.current.replay.loading).toBe(false);
    });

    expect(result.current.firstPlay.self).toEqual(firstSelf);
    expect(result.current.replay.self).toBeNull();
    // 記録なしボードでも TOP5 は独立して表示される
    expect(result.current.replay.top).toEqual(replayTop);
  });

  it('quizId が変化すると再フェッチが発生する', async () => {
    mockGetLeaderboard.mockImplementation((_quizId: string, board: 'first_play' | 'replay') =>
      Promise.resolve(board === 'first_play' ? firstTop : replayTop)
    );
    mockGetMyLeaderboardRank.mockImplementation(
      (_quizId: string, board: 'first_play' | 'replay', _userId: string) =>
        Promise.resolve(board === 'first_play' ? firstSelf : replaySelf)
    );

    const { result, rerender } = renderHook(
      ({ quizId, userId }: { quizId: string; userId: string | null }) =>
        useQuizLeaderboard(quizId, userId),
      { initialProps: { quizId: 'quiz-1', userId: 'user-1' } }
    );

    await waitFor(() => expect(result.current.firstPlay.loading).toBe(false));
    expect(mockGetLeaderboard).toHaveBeenCalledTimes(2);
    expect(mockGetMyLeaderboardRank).toHaveBeenCalledTimes(2);

    rerender({ quizId: 'quiz-2', userId: 'user-1' });

    await waitFor(() => {
      expect(mockGetLeaderboard).toHaveBeenCalledTimes(4);
    });
    expect(mockGetLeaderboard).toHaveBeenCalledWith('quiz-2', 'first_play');
    expect(mockGetLeaderboard).toHaveBeenCalledWith('quiz-2', 'replay');
    expect(mockGetMyLeaderboardRank).toHaveBeenCalledTimes(4);
  });
});
