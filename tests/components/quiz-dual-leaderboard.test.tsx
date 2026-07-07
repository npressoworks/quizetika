/**
 * @jest-environment jsdom
 *
 * QuizDualLeaderboard コンポーネント単体テスト (Phase 38 / Task 30.6)
 *
 * Phase 5 時点のこのファイルは `quiz: Quiz` prop へフィクスチャを直接注入する方式
 * だったため、実データ取得経路（`useQuizLeaderboard` 経由の `getLeaderboard` /
 * `getMyLeaderboardRank`）の破損（`quiz.leaderboardFirstPlay`/`leaderboardReplay`
 * が常に空になるバグ）を検出できなかった。
 *
 * Task 30.6 でこのファイルを、コンポーネントが実際に呼び出す統合取得フック
 * （`useAuth` + `useQuizLeaderboard`）をモックする形式へ全面的に書き換えた
 * （design.md 「## Phase 38」`QuizDualLeaderboard` 詳細ブロックの
 * `data-testid` 契約表、および「### 6. Testing Strategy（Phase 38）」の
 * Component テスト2行に対応）。
 *
 * 検証対象（要件9.1, 9.4, 9.9, 9.10, 9.11, 9.12, 9.14）:
 *   1. TOP5表示（最大5件、列内容）
 *   2. 自分の記録がTOP5圏内の場合でも、TOP5表とは別枠で自分の順位行が表示される（重複表示）
 *   3. 自分の記録がTOP5圏外の場合、自分の順位行が表示される
 *   4. 記録がない場合の空状態表示
 *   5. 自分の記録がないボードでは自分の順位行が表示されない
 *   6. ゲスト時はいずれのボードも自分の順位行が表示されない
 *   7. タブ切替（初回⇄リプレイ）が正しく機能する
 *   8. 表示名欠落時の「名無しさん」フォールバック
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

describe('QuizDualLeaderboard (quizId + useQuizLeaderboard 統合取得フック契約)', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null, authUser: null, loading: false });
    mockUseQuizLeaderboard.mockReset();
  });

  test('TOP5データはフックが返した値をそのまま描画する（最大5件、順位・表示名・正解数・合計時間・達成日）', () => {
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
    expect(within(table).getByText('#1')).toBeInTheDocument();
    expect(within(table).getByText('達成日')).toBeInTheDocument();
    expect(within(table).getByText('user-0')).toBeInTheDocument();
    expect(within(table).getByText('10')).toBeInTheDocument();
    expect(within(table).getByText('30 秒')).toBeInTheDocument();
    const expectedDate = entries[0].completedAt.toLocaleDateString('ja-JP');
    expect(within(rows[0]).getByText(expectedDate)).toBeInTheDocument();
  });

  test('初回・リプレイとも記録がないとき空状態を表示し、自分の順位欄も出さない', () => {
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

  test('自分の記録がTOP5圏内の場合でも、TOP5表とは別枠で自分の順位行が重複表示される', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      authUser: null,
      loading: false,
    });
    mockUseQuizLeaderboard.mockReturnValue({
      firstPlay: boardState({
        top: [entry('user-1', 10, 20, '自分'), entry('top-2', 9, 25)],
        self: selfEntry('user-1', 10, 20, 1, '自分'),
      }),
      replay: boardState(),
    });

    render(<QuizDualLeaderboard quizId="quiz-1" />);

    // TOP5表には圏内の自分のエントリも通常どおり含まれる
    const table = screen.getByTestId('highscore-leaderboard');
    expect(within(table).getAllByTestId('leaderboard-entry')).toHaveLength(2);

    // TOP5表とは別枠で、自分の順位行が重複して表示される
    const selfRow = screen.getByTestId('leaderboard-my-rank-first');
    expect(within(selfRow).getByText('#1')).toBeInTheDocument();
    expect(within(selfRow).getByText('自分')).toBeInTheDocument();
    expect(within(selfRow).getByText('10')).toBeInTheDocument();
    expect(within(selfRow).getByText('20 秒')).toBeInTheDocument();
  });

  test('自分の記録がTOP5圏外の場合、TOP5表には現れず自分の順位行のみが別枠で表示される', () => {
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

    // 初回側のTOP5表には自分の行が含まれない（圏外のため）
    const firstTable = screen.getByTestId('highscore-leaderboard');
    expect(within(firstTable).getAllByTestId('leaderboard-entry')).toHaveLength(1);

    // リプレイタブへ切り替え、リプレイ用の識別子で自分の順位行を確認（ボードごとに独立評価）
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

  test('ローディング中は自分の順位行を表示せず、ローディング完了後にのみ描画する（レイアウトシフト回避）', () => {
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

  test('タブ切替により初回・リプレイそれぞれのTOP5表が独立して表示される', () => {
    mockUseQuizLeaderboard.mockReturnValue({
      firstPlay: boardState({ top: [entry('first-user', 8, 30, '初回太郎')] }),
      replay: boardState({ top: [entry('replay-user', 5, 40, 'リプレイ太郎')] }),
    });

    render(<QuizDualLeaderboard quizId="quiz-1" />);

    // 初回タブがデフォルトで表示される
    expect(screen.getByTestId('highscore-leaderboard')).toBeInTheDocument();
    expect(within(screen.getByTestId('highscore-leaderboard')).getByText('初回太郎')).toBeInTheDocument();
    expect(screen.queryByTestId('replay-leaderboard')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('quiz-leaderboard-tab-replay'));

    const replayTable = screen.getByTestId('replay-leaderboard');
    expect(within(replayTable).getByText('リプレイ太郎')).toBeInTheDocument();
    expect(within(replayTable).getAllByTestId('leaderboard-entry')).toHaveLength(1);
    expect(screen.queryByTestId('highscore-leaderboard')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('quiz-leaderboard-tab-first'));
    expect(screen.getByTestId('highscore-leaderboard')).toBeInTheDocument();
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
