/**
 * @jest-environment jsdom
 *
 * QuizDualLeaderboard コンポーネント単体テスト (Phase 38 / Task 30.5)
 *
 * Phase 5 時点の `tests/components/quiz-dual-leaderboard.test.tsx` は
 * `quiz` prop へフィクスチャを直接注入する方式のため、実データ経路
 * （`useQuizLeaderboard` 経由の `getLeaderboard` / `getMyLeaderboardRank`）
 * の破損を検出できなかった（`quiz.leaderboardFirstPlay`/`leaderboardReplay`
 * が常に空になるバグ）。このファイルは新しい `quizId` propベースの契約
 * （`useAuth` + `useQuizLeaderboard` をコンポーネント自身が呼び出す）に
 * 対して、実装が要件9.9〜9.14を満たすことを検証する。
 *
 * 旧テストファイルの全面書き換えはタスク30.6が担当する。
 */

import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QuizDualLeaderboard } from '@/components/quiz/quiz-dual-leaderboard';
import type { LeaderboardRecord, LeaderboardSelfEntry } from '@/types';
import type { UseQuizLeaderboardResult } from '@/hooks/useQuizLeaderboard';

const mockUseAuth = jest.fn(() => ({
  user: null as { id: string } | null,
  authUser: null,
  loading: false,
}));

jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseQuizLeaderboard = jest.fn();

jest.mock('@/hooks/useQuizLeaderboard', () => ({
  useQuizLeaderboard: (quizId: string, userId: string | null) =>
    mockUseQuizLeaderboard(quizId, userId),
}));

function entry(
  userId: string,
  score: number,
  elapsedSeconds: number,
  displayName?: string
): LeaderboardRecord {
  return {
    userId,
    displayName: displayName ?? userId,
    score,
    elapsedSeconds,
    completedAt: new Date('2026-07-01T12:00:00Z'),
  };
}

function selfEntry(
  userId: string,
  score: number,
  elapsedSeconds: number,
  rank: number,
  displayName?: string
): LeaderboardSelfEntry {
  return { ...entry(userId, score, elapsedSeconds, displayName), rank };
}

function boardState(
  overrides: Partial<UseQuizLeaderboardResult['firstPlay']> = {}
): UseQuizLeaderboardResult['firstPlay'] {
  return { top: [], self: null, loading: false, ...overrides };
}

describe('QuizDualLeaderboard (Phase 38 / quizId + useQuizLeaderboard 契約)', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null, authUser: null, loading: false });
    mockUseQuizLeaderboard.mockReset();
  });

  test('TOP5データはフックが返した値をそのまま描画する（Phase 5 破損データ経路の回帰確認）', () => {
    const entries = Array.from({ length: 7 }, (_, i) => entry(`user-${i}`, 10 - i, 30 + i));
    mockUseQuizLeaderboard.mockReturnValue({
      firstPlay: boardState({ top: entries.slice(0, 5) }),
      replay: boardState(),
    });

    render(<QuizDualLeaderboard quizId="quiz-1" />);

    expect(mockUseQuizLeaderboard).toHaveBeenCalledWith('quiz-1', null);

    const table = screen.getByTestId('highscore-leaderboard');
    const rows = within(table).getAllByTestId('leaderboard-entry');
    expect(rows).toHaveLength(5);
    expect(within(table).getByText('user-0')).toBeInTheDocument();
    expect(within(table).getByText('10')).toBeInTheDocument();
    expect(within(table).getByText('30 秒')).toBeInTheDocument();
  });

  test('記録がないボードでは空状態を表示し、自分の順位欄も出さない', () => {
    mockUseQuizLeaderboard.mockReturnValue({
      firstPlay: boardState(),
      replay: boardState(),
    });

    render(<QuizDualLeaderboard quizId="quiz-1" />);

    expect(screen.getByTestId('quiz-leaderboard')).toBeInTheDocument();
    expect(screen.getByText('まだ記録がありません。')).toBeInTheDocument();
    expect(screen.queryByTestId('highscore-leaderboard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('leaderboard-my-rank-first')).not.toBeInTheDocument();
    expect(screen.queryByTestId('leaderboard-my-rank-replay')).not.toBeInTheDocument();
  });

  test('自分の記録があるとき、TOP5表とは別枠で初回・リプレイそれぞれの自分の順位行を表示する（TOP5圏外でも省略しない）', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      authUser: null,
      loading: false,
    });
    mockUseQuizLeaderboard.mockReturnValue({
      firstPlay: boardState({
        top: [entry('top-1', 10, 20)],
        self: selfEntry('user-1', 3, 90, 6, '自分'),
      }),
      replay: boardState({
        top: [entry('top-2', 9, 25)],
        self: selfEntry('user-1', 5, 40, 2, '自分'),
      }),
    });

    render(<QuizDualLeaderboard quizId="quiz-1" />);

    expect(mockUseQuizLeaderboard).toHaveBeenCalledWith('quiz-1', 'user-1');

    // 初回タブ（デフォルト表示）: TOP5圏外の自分の順位（#6）が別枠で表示される
    const firstSelfRow = screen.getByTestId('leaderboard-my-rank-first');
    expect(within(firstSelfRow).getByText('#6')).toBeInTheDocument();
    expect(within(firstSelfRow).getByText('自分')).toBeInTheDocument();
    expect(within(firstSelfRow).getByText('3')).toBeInTheDocument();
    expect(within(firstSelfRow).getByText('90 秒')).toBeInTheDocument();

    // 初回側のTOP5表にも影響しないこと
    const firstTable = screen.getByTestId('highscore-leaderboard');
    expect(within(firstTable).getAllByTestId('leaderboard-entry')).toHaveLength(1);

    // リプレイタブへ切り替え、リプレイ用の識別子で自分の順位行を確認
    fireEvent.click(screen.getByTestId('quiz-leaderboard-tab-replay'));
    const replaySelfRow = screen.getByTestId('leaderboard-my-rank-replay');
    expect(within(replaySelfRow).getByText('#2')).toBeInTheDocument();
    expect(screen.queryByTestId('leaderboard-my-rank-first')).not.toBeInTheDocument();
  });

  test('片方のボードにのみ自分の記録がある場合、記録がないボードの自分の順位欄は出さない', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      authUser: null,
      loading: false,
    });
    mockUseQuizLeaderboard.mockReturnValue({
      firstPlay: boardState({
        top: [entry('top-1', 10, 20)],
        self: selfEntry('user-1', 3, 90, 4),
      }),
      replay: boardState({ top: [entry('top-2', 9, 25)], self: null }),
    });

    render(<QuizDualLeaderboard quizId="quiz-1" />);

    expect(screen.getByTestId('leaderboard-my-rank-first')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('quiz-leaderboard-tab-replay'));
    expect(screen.queryByTestId('leaderboard-my-rank-replay')).not.toBeInTheDocument();
  });

  test('未ログイン（ゲスト）の場合、フックへ渡す userId は null になり、いずれのボードも自分の順位欄を表示しない', () => {
    mockUseAuth.mockReturnValue({ user: null, authUser: null, loading: false });
    mockUseQuizLeaderboard.mockReturnValue({
      firstPlay: boardState({ top: [entry('top-1', 10, 20)] }),
      replay: boardState({ top: [entry('top-2', 9, 25)] }),
    });

    render(<QuizDualLeaderboard quizId="quiz-1" />);

    expect(mockUseQuizLeaderboard).toHaveBeenCalledWith('quiz-1', null);
    expect(screen.queryByTestId('leaderboard-my-rank-first')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('quiz-leaderboard-tab-replay'));
    expect(screen.queryByTestId('leaderboard-my-rank-replay')).not.toBeInTheDocument();
  });

  test('ローディング中は自分の順位行を表示せず、ローディング完了後にのみ描画する', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      authUser: null,
      loading: false,
    });
    mockUseQuizLeaderboard.mockReturnValue({
      firstPlay: boardState({
        loading: true,
        self: selfEntry('user-1', 3, 90, 4),
      }),
      replay: boardState({ loading: true }),
    });

    render(<QuizDualLeaderboard quizId="quiz-1" />);

    expect(screen.queryByTestId('leaderboard-my-rank-first')).not.toBeInTheDocument();
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  test('表示名がない場合は名無しさんと表示する', () => {
    const anon = entry('anon', 3, 20);
    anon.displayName = '';
    mockUseQuizLeaderboard.mockReturnValue({
      firstPlay: boardState({ top: [anon] }),
      replay: boardState(),
    });

    render(<QuizDualLeaderboard quizId="quiz-1" />);

    expect(screen.getByText('名無しさん')).toBeInTheDocument();
  });
});
