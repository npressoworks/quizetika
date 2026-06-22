/**
 * @jest-environment jsdom
 *
 * QuizDualLeaderboard コンポーネント単体テスト (Task 9.4)
 */

import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QuizDualLeaderboard } from '@/components/quiz/quiz-dual-leaderboard';
import type { LeaderboardRecord, Quiz } from '@/types';



function lbEntry(
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
    completedAt: new Date('2026-01-15T12:00:00Z'),
  };
}

function makeQuiz(
  overrides: Partial<
    Pick<Quiz, 'leaderboard' | 'leaderboardFirstPlay' | 'leaderboardReplay'>
  > = {}
): Quiz {
  return {
    id: 'quiz-1',
    authorId: 'author-1',
    authorName: '作者',
    authorAvatar: '',
    title: 'テストクイズ',
    description: '',
    thumbnailUrl: null,
    difficulty: 5,
    genre: 'テスト',
    tags: [],
    originalTags: [],
    questions: [],
    questionIds: [],
    questionCount: 5,
    status: 'published',
    flagsCount: 0,
    playCount: 0,
    bookmarksCount: 0,
    positiveCount: 0,
    negativeCount: 0,
    tempPositiveCount: 0,
    tempNegativeCount: 0,
    reviewScore: null,
    reviewBadge: null,
    isReviewMasked: false,
    activeResetRequestId: null,
    canonicalGenreId: '',
    canonicalTagIds: [],
    leaderboard: [],
    leaderboardFirstPlay: [],
    leaderboardReplay: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('QuizDualLeaderboard', () => {
  test('初回・リプレイとも記録がないとき空状態を表示する', () => {
    render(<QuizDualLeaderboard quiz={makeQuiz()} />);

    expect(screen.getByTestId('quiz-leaderboard')).toBeInTheDocument();
    expect(screen.getByText('まだ記録がありません。')).toBeInTheDocument();
    expect(screen.queryByTestId('highscore-leaderboard')).not.toBeInTheDocument();
  });

  test('初回プレイに最大5件のエントリを表示する', () => {
    const entries = Array.from({ length: 7 }, (_, i) =>
      lbEntry(`user-${i}`, 10 - i, 30 + i)
    );
    render(
      <QuizDualLeaderboard
        quiz={makeQuiz({ leaderboardFirstPlay: entries })}
      />
    );

    const table = screen.getByTestId('highscore-leaderboard');
    const rows = within(table).getAllByTestId('leaderboard-entry');
    expect(rows).toHaveLength(5);
    expect(within(table).getByText('user-0')).toBeInTheDocument();
    expect(within(table).getByText('10')).toBeInTheDocument();
    expect(within(table).getByText('30 秒')).toBeInTheDocument();
  });

  test('leaderboardFirstPlay が空のとき legacy leaderboard を初回側に表示する', () => {
    render(
      <QuizDualLeaderboard
        quiz={makeQuiz({
          leaderboardFirstPlay: [],
          leaderboard: [lbEntry('legacy-user', 4, 90, 'レガシー太郎')],
        })}
      />
    );

    const table = screen.getByTestId('highscore-leaderboard');
    expect(within(table).getByText('レガシー太郎')).toBeInTheDocument();
    expect(within(table).getByText('4')).toBeInTheDocument();
  });

  test('リプレイタブでリプレイ記録を表示し初回タブでは空状態', () => {
    render(
      <QuizDualLeaderboard
        quiz={makeQuiz({
          leaderboardReplay: [lbEntry('replay-user', 5, 40, 'リプレイ太郎')],
        })}
      />
    );

    fireEvent.click(screen.getByTestId('quiz-leaderboard-tab-replay'));

    const replayTable = screen.getByTestId('replay-leaderboard');
    expect(within(replayTable).getByText('リプレイ太郎')).toBeInTheDocument();
    expect(within(replayTable).getAllByTestId('leaderboard-entry')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('quiz-leaderboard-tab-first'));
    expect(screen.getByText('まだ記録がありません。')).toBeInTheDocument();
  });

  test('表示名がない場合は名無しさんと表示する', () => {
    const entry = lbEntry('anon', 3, 20);
    entry.displayName = '';
    render(
      <QuizDualLeaderboard quiz={makeQuiz({ leaderboardFirstPlay: [entry] })} />
    );

    expect(screen.getByText('名無しさん')).toBeInTheDocument();
  });
});
